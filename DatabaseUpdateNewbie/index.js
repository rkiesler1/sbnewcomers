/*jshint esversion: 6 */
const _       = require('lodash');
const async   = require('async');
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
            level: 'debug'
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, '.', 'logs/newbie_update.log'),
                period: '1d',          // daily rotation
                totalFiles: 1000,      // keep up to 1000 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '1m',       // Rotate log files larger than 1 megabyte
                totalSize: '1g',       // Don't keep more than 1gb of archived log files
                gzip: true             // Compress the archive log files to save space
            }),
            level: 'debug'
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
                    var resId = contactData.ResultId;
                    log.info("Request processing (result ID: %s) ... keep checking for results every %d seconds",
                        resId, interval / 1000);
                    setTimeout(getContacts, interval, args, action);
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
                        log.info("Request complete. Retrieving contacts with action %s ... (result ID: %s)",
                            action, resId);
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
        return 1;
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
        const memberSince = newbie.FieldValues.filter(function(field) {
            return field.FieldName === 'Member since';
        })[0].Value;
        const newbieFlag = newbie.FieldValues.filter(function(field) {
            return field.FieldName === 'New member';
        })[0].Value;
        const newbieStatusSysCode = newbie.FieldValues.filter(function(field) {
            return field.FieldName === 'New member';
        })[0].SystemCode;
        const newbieStatusUpd = newbie.FieldValues.filter(function(field) {
            return field.FieldName === 'New member updated on';
        })[0].Value;
        const newbieStatusUpdSysCode = newbie.FieldValues.filter(function(field) {
            return field.FieldName === 'New member updated on';
        })[0].SystemCode;

        var logMsg;
        switch(action) {
            case "setNewbieFlag":
                // If the newbie flag isn't set yet, set it
                if (_.isNil(newbieFlag)) {
                    const newbieUpdateArgs = {
                        path: { accountId: config.accountId, contactId: newbie.Id.toString() },
                        data: {
                            "Id": newbie.Id,
                            "FieldValues": [
                                {
                                    "FieldName": "New member",
                                    "SystemCode": newbieStatusSysCode,
                                    "Value": "Yes"
                                },
                                {
                                    "FieldName": "New member updated on",
                                    "SystemCode": newbieStatusUpdSysCode,
                                    "Value": formatDate(new Date())
                                }
                            ]
                        }
                    };
                    apiClient.methods.updateContact(newbieUpdateArgs, function(contactDataUpd, response) {
                        log.info("Newbie status %s for %s %s (ID: %s | status: %s | joined on: %s)",
                            (_.isNil(newbieStatusUpd) ? "set" : "reset"),
                            contactDataUpd.FirstName, contactDataUpd.LastName,
                            contactDataUpd.Id, contactDataUpd.Status, memberSince);
                    });
                } else {
                    log.debug("Newbie status for %s %s (ID: %s | status: %s | joined on: %s) already set to '%s' on %s",
                        newbie.FirstName, newbie.LastName, newbie.Id, newbie.Status,
                        memberSince, newbieFlag.Label, newbieStatusUpd);
                }
                break;

            case "clearNewbieFlag":
                // If the newbie flag is set, clear it
                const memberUpdateArgs = {
                    path: { accountId: config.accountId, contactId: newbie.Id.toString() },
                    data: {
                        "Id": newbie.Id,
                        "FieldValues": [
                            {
                                "FieldName": "New member",
                                "SystemCode": newbieStatusSysCode,
                                "Value": "No"
                            },
                            {
                                "FieldName": "New member updated on",
                                "SystemCode": newbieStatusUpdSysCode,
                                "Value": formatDate(new Date())
                            }
                        ]
                    }
                };
                apiClient.methods.updateContact(memberUpdateArgs, function(contactDataUpd, response) {
                    log.info("Newbie flag cleared for %s %s (ID: %s | status: %s | joined on: %s)",
                        contactDataUpd.FirstName, contactDataUpd.LastName, contactDataUpd.Id, contactDataUpd.Status, memberSince);
                });
            break;

            default:
                log.warn("This should not happen -- requested action is '%s'", action);
        }
    }, function (err) {
        if (err) { throw err; }
    });
};

/*****************
 * Error handler *
 *****************/
process.on('uncaughtException', (err) => {
    log.error(1, `${err}`);
});

// format date
function formatDate(d) {
    var month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

// calculate today - 90 days for newbie status
var today = new Date();
today.setDate(today.getDate() - 90);
todayMinus90 = today.toISOString().substring(0, 10);    // keep the yyyy-mm-dd portion

/*******************************
 * set query filter parameters *
 *******************************/

// newbies -- 1-90 days from join date
const newbieArgs = {
    path: { accountId: config.accountId },
    parameters: {
        $filter: "'Id' eq '47506410'" /*+ " AND " +
                 "'Membership status' ne 'Lapsed' AND 'Membership status' ne 'PendingNew' AND 'Member since' gt " +
                 todayMinus90*/

    }
};

// members -- 91+ days since join date
const memberArgs = {
    path: { accountId: config.accountId },
    parameters: {
        $filter: "'Id' eq '47506410'" /*+ " AND " +
                 "'Membership status' ne 'Lapsed' AND 'Membership status' ne 'PendingNew' AND 'Member since' le " +
                 todayMinus90*/
    }
};

/***********
 * run it! *
 ***********/
getContacts(newbieArgs, 'setNewbieFlag');
getContacts(memberArgs, 'clearNewbieFlag');
