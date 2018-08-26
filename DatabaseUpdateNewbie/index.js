/*jshint esversion: 6 */
const _       = require('lodash');
const path    = require('path');
const util    = require('util');

const config = require(path.join(__dirname, '.', 'config.js'));
const wildapricot = require(path.join(__dirname, '.', 'wildapricot.js'));

// configure logging
var fs = require('fs');
var logsDir = path.join(__dirname, './logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const bunyan  = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
var log = bunyan.createLogger({
    name: 'wildapricot',
    streams: [
        {
            stream: process.stderr,
            level: "debug"
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, './logs/newbie_update.log'),
                period: '1d',          // daily rotation
                totalFiles: 1000,      // keep up to 1000 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '1m',       // Rotate log files larger than 1 megabyte
                totalSize: '1g',       // Don't keep more than 1gb of archived log files
                gzip: true             // Compress the archive log files to save space
            }),
            level: "debug"
        }
    ],
    level : bunyan.DEBUG
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

/******************************
 * Search the member database *
 ******************************/
function getContacts(args, action) {
    const interval = 10000;

    // send the newbie query to the API
    apiClient.methods.listContacts(args, function(contactData, response) {
        if (!_.isNil(contactData) && !_.isNil(contactData.State)) {
            // good response
            switch (contactData.State) {
                case "Waiting":
                case "Processing":
                    // asyncrounous request may take a few seconds to complete
                    log.info("Request processing -- keep checking for results every %d seconds", interval / 1000);
                    setTimeout(getContacts, interval, args);
                    break;
                    case "Complete":
                    // process results
                    if (!_.isNil(contactData.Contacts)) {
                        if (_.isArray(contactData.Contacts)) {
                            processContacts(contactData.Contacts, action);
                        }
                    } else {
                        // query complete -- get the results (an extra API call)
                        var resId = contactData.ResultId;
                        log.info("Request complete. Retrieving contacts... (result ID: %s)", resId);
                        var resArgs = _.clone(args);
                        resArgs.parameters = {resultId: resId};
                        setTimeout(getContacts, 1000, resArgs, action); // delay one more second...
                    }
                    break;

                case "Failed":
                    // query failed -- this should not happen unless the parameters were changed
                    log.error(contactData);
                    break;

                default:
                    log.debug("This should not happen unless the API is changed -- retrned state is '%s'",
                        contactData.State);
            }
        }
    });
}

/**************************
 * Update a member record *
 **************************/
const processContacts = function(contacts, action) {
    // allowable actions
    const actions = ['setNewbieFlag', 'clearNewbieFlag'];
    if (actions.indexOf(action) < 0) {
        throw new Error(util.format("Unsupported action (%s)", action));
    }
    // filter out extra records for Committee chairs, webmasters, etc.
    const newbies = contacts.filter(function(contact) {
        return contact.MembershipLevel.Name === 'Newcomer Member';
    });

    // This should match the results from the "Newbies since [specify] date]"
    // saved search in WildApricot
    log.info("%d contacts retrieved", newbies.length);

    // For each newbie
    _.each(newbies, function(newbie) {
        switch(action) {
            case "setNewbieFlag":
                // If the newbie flag isn't set yet, set it
                log.info("Newbie %s %s (ID: %s | status: %s) joined on %s",
                    newbie.FirstName, newbie.LastName, newbie.Id, newbie.Status,
                    newbie.FieldValues.filter(function(field) {
                        return field.FieldName === 'Member since';
                    })[0].Value);
                break;

            case "clearNewbieFlag":
                // If the newbie flag is set, clear it
                log.info("Member %s %s (ID: %s | status: %s) joined on %s",
                    newbie.FirstName, newbie.LastName, newbie.Id, newbie.Status,
                    newbie.FieldValues.filter(function(field) {
                        return field.FieldName === 'Member since';
                    })[0].Value);
                break;

            default:
                log.debug("This should not happen -- requested action is '%s'", action);
        }
    });
};

/*****************
 * Error handler *
 *****************/
process.on('uncaughtException', (err) => {
    log.error(1, `${err}`);
});

// calculate today - 90 days for newbie status
var today = new Date();
today.setDate(today.getDate() - 90);
todayMinus90 = today.toISOString().substring(0, 10);    // keep the yyyy-mm-dd portion

// set query filter parameters
const newbieArgs = {
    path: { accountId: config.accountId },
    parameters: {
        $filter: "'Membership status' ne 'Lapsed' AND 'Membership status' ne 'PendingNew' AND 'Member since' gt " +
            todayMinus90
    }
};

const memberArgs = {
    path: { accountId: config.accountId },
    parameters: {
        $filter: "'Membership status' ne 'Lapsed' AND 'Membership status' ne 'PendingNew' AND 'Member since' le " +
            todayMinus90
    }
};

// run it!
getContacts(newbieArgs, 'setNewbieFlag');
getContacts(memberArgs, 'clearNewbieFlag');