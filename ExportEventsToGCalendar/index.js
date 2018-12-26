/*jshint esversion: 6 */
const deasync  = require('deasync');
const fs       = require('fs');
const _        = require('lodash');
const path     = require('path');
const util     = require('util');
const readline = require('readline');
const {
    google
} = require('googleapis');

const config = require(path.join(__dirname, '..', 'shared/config.js'));
const wildapricot = require(path.join(__dirname, '..', 'shared/wildapricot.js'));

// configure logging
var logsDir = path.join(__dirname, './logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const bunyan  = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
var log = bunyan.createLogger({
    name: 'event_export',
    streams: [
        {
            stream: process.stderr,
            level: 'info'
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, '.', 'logs/event_export.log'),
                period: '1d',          // daily rotation
                totalFiles: 1000,      // keep up to 1000 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '1m',       // Rotate log files larger than 1 megabyte
                totalSize: '1g',       // Don't keep more than 1gb of archived log files
                gzip: true             // Compress the archive log files to save space
            }),
            level: 'trace'
        }
    ],
    level : bunyan.TRACE
});

/*****************************
 * initialize the API client *
 *****************************/
var apiClient = wildapricot.init({
    account: config.accountId,
    user: config.userId,
    pass: config.password,
    client: config.clientId,
    secret: config.secret,
    scope: config.scope
});

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar']; // .readonly
// use 'https://www.googleapis.com/auth/calendar' for writes
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile(path.join(__dirname, '.', 'credentials.json'), (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Calendar API.
    authorize(JSON.parse(content), exportEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {
        client_secret,
        client_id,
        redirect_uris
    } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function exportEvents(auth) {
    // get SBNC events
    var eventArgs = {
        path: { accountId: config.accountId },
        parameters: {
            $filter: "'StartDate' ge '" + (new Date()).toISOString() + "'",
            $sort: "StartDate asc"
        }
    };
    apiClient.methods.listEvents(eventArgs, function(eventData, eventResp) {
        if (!_.isNil(eventData) && !_.isNil(eventData.Events) &&
             _.isArray(eventData.Events) && eventData.Events.length > 0) {
            var events = eventData.Events;
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var eventId = event.Url.substring(event.Url.lastIndexOf("/") + 1);
                if (!_.isNil(event.AccessLevel) && event.AccessLevel === "Public")
                {
                    var rule = null;
                    if (!_.isNil(event.Sessions) && _.isArray(event.Sessions) && event.Sessions.length > 0) {
                        const msg = util.format("Event %d is recurring %d times", eventId, event.Sessions.length);
                        log.trace(msg);
                        rule = ruleFromSessions(event.Sessions);
                        log.trace("RRULE: " + rule);
                    }
                    // connect to Google calendar
                    const calendar = google.calendar({
                        version: 'v3',
                        auth
                    });

                    // new or existing gCal event?
                    var eventName = util.format("%s (%d)", event.Name, eventId);
                    var gEvent = findEvent(calendar, eventId);
                    var start, end;
                    if (!_.isNil(gEvent) && gEvent.summary === eventName) {
                        // existing -- did the dates change?
                        if (gEvent.start.dateTime === event.StartDate &&
                            gEvent.end.dateTime === event.EndDate) {
                                // unchanged
                                const msg = util.format("Skipping unchanged event %s", eventName);
                                log.info(msg);
                        } else {
                            // special case -- recurring event (since we changed the end date)
                            if (!_.isNil(rule) && gEvent.start.dateTime === event.StartDate &&
                                gEvent.end.dateTime != event.EndDate && gEvent.recurrence[0] === rule) {
                                    const msg = util.format("Skipping unchanged recurring event %s", eventName);
                                    log.info(msg);
                            } else {
                                const msg = util.format("Updating event %s", eventName);
                                log.info(msg);
                                gEvent.start.dateTime = event.StartDate;
                                gEvent.end.dateTime = event.EndDate;
                                if (!_.isNil(rule)) {
                                    gEvent.recurrence = [rule];
                                    // ensure end time is on same day as start time
                                    start = new Date(event.StartDate);
                                    end = new Date(event.EndDate);
                                    end.setDate(start.getDate());
                                    end.setMonth(start.getMonth());
                                    end.setFullYear(start.getFullYear());
                                    gEvent.end.dateTime = end.toISOString();
                                }
                                calendar.events.patch({
                                    auth: auth,
                                    calendarId: 'primary',
                                    eventId: gEvent.id,
                                    resource: gEvent,
                                }, eventUpdateHandler);
                            }
                        }
                    } else {
                        // new event
                        const msg = util.format("Adding event %s", eventName);
                        log.info(msg);
                        gEvent = {
                            'summary': eventName,
                            'description' : util.format("https://www.sbnewcomers.org/event-%d", eventId),
                            'location': event.Location,
                            'start': {
                                'dateTime': event.StartDate,
                                'timeZone': 'America/Los_Angeles',
                            },
                            'end': {
                                'dateTime': event.EndDate,
                                'timeZone': 'America/Los_Angeles',
                            },
                        };
                        if (!_.isNil(rule)) {
                            gEvent.recurrence = [rule];
                            if (!_.isNil(rule)) {
                                gEvent.recurrence = [rule];
                                // ensure end time is on same day as start time
                                start = new Date(event.StartDate);
                                end = new Date(event.EndDate);
                                end.setDate(start.getDate());
                                end.setMonth(start.getMonth());
                                end.setFullYear(start.getFullYear());
                                gEvent.end.dateTime = end.toISOString();
                            }
                        }

                        calendar.events.insert({
                            auth: auth,
                            calendarId: 'primary',
                            resource: gEvent,
                        }, eventCreateHandler);
                    }
                } else {
                    const msg = util.format("Ignoring event %d with access level '%s'", eventId, event.AccessLevel);
                    log.trace(msg);
                }
            }
        } else {
            log.error("listEvents returned no data");
        }
    });
}

Date.dateDiff = function(datepart, fromdate, todate) {
    datepart = datepart.toLowerCase();
    var diff = todate - fromdate;
    var divideBy = { w:604800000,
                     d:86400000,
                     h:3600000,
                     n:60000,
                     s:1000 };

    return Math.floor( diff/divideBy[datepart]);
};

/**
 * Create an RFC 5545 compliant rule from event sessions
 * @param {*} sessions list of recurring sessions for an event
 */
function ruleFromSessions(sessions) {
    // determine frequency
    if (sessions.length > 1) {
        var start = new Date(sessions[0].StartDate);
        var next = new Date(sessions[1].StartDate);

        var diff = Date.dateDiff('w', start, next);
        if (diff < 1) {
            diff = Date.dateDiff('d', start, next);
            if (diff < 1) {
                const msg = "difference of less than one day -- cannot create RRULE";
                return log.error(msg);
            } else {
                const rule = "RRULE:FREQ=DAILY;UNTIL=" + sessions[sessions.length - 1].StartDate.substring(0, 19).replace(/\-/g, "").replace(/\:/g, "");
                return rule + "Z";
            }
        } else {
            const rule = "RRULE:FREQ=WEEKLY;UNTIL=" + sessions[sessions.length - 1].StartDate.substring(0, 19).replace(/\-/g, "").replace(/\:/g, "");
            return rule + "Z";
        }
    } else {
        const msg = "Single session only -- cannot create RRULE";
        return log.error(msg);
    }
}

function findEvent(calendar, eventId) {
    var results = null;
    calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        q: util.format('(%d)', eventId),
    }, (err, res) => {
        if (err) return log.error('gCalendar API returned an error: ' + err);
        results = res.data.items;
        if (results.length > 1) {
            const msg = util.format("Duplicate events for event ID %d", eventId);
            log.warn(msg);
        }
    });
    while (null == results) {deasync.sleep(100);}
    return results[0];
}

function eventFindHandler(err, event) {
    if (err) {
        log.error('Error finding event in the calendar: ' + err);
        return;
    }
    log.trace('Event found: %s', event.data.summary);
}

function eventCreateHandler(err, event) {
    if (err) {
        log.error('Error creating event in the calendar: ' + err);
        return;
    }
    log.info('Event created: %s', event.data.summary);
}

function eventUpdateHandler(err, event) {
    if (err) {
        log.error('Error updating the calendar: ' + err);
        return;
    }
    log.info('Event updated: %s', event.data.summary);
}