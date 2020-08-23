/*jshint esversion: 6 */
const _        = require('lodash');
const async    = require('async');
const path     = require('path');
const util     = require('util');
const aws      = require('aws-sdk');

aws.config.loadFromPath(path.join(__dirname, '..', 'shared/aws.json'));
const config = require(path.join(__dirname, '..', 'shared/config.js'));
const wildapricot = require(path.join(__dirname, '..', 'shared/wildapricot.js'));
console.log(config);

// configure mail
const emailTo = "HelpDesk@sbnewcomers.org";
//const emailTo = "rkiesler@gmail.com";
const emailFrom = "HelpDesk@sbnewcomers.org";

// configure logging
var fs = require('fs');
var logsDir = path.join(__dirname, './logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const bunyan  = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
var log = bunyan.createLogger({
    name: 'newbie_to_newcomer',
    streams: [
        {
            stream: process.stderr,
            level: 'trace'
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, '.', 'logs/newbie_to_newcomer.log'),
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

/******************************
 * Search the member database *
 ******************************/
function getContacts(args, action) {
    const interval = 10000;

    // send the newbie query to the API
    var contactReq = apiClient.methods.listContacts(args, function(contactData, response) {
        if (!_.isNil(contactData) && !_.isNil(contactData.State)) {
            // good response
            var resId;
            switch (contactData.State) {
                case "Waiting":
                case "Processing":
                    // asyncrounous request may take a few seconds to complete
                    resId = contactData.ResultId;
                    log.trace("Request processing (result ID: %s) ... keep checking for results every %d seconds",
                        resId, interval / 1000);
                    setTimeout(getContacts, interval, args, action);
                    break;

                case "Complete":
                    // process results
                    if (!_.isNil(contactData.Contacts)) {
                        if (_.isArray(contactData.Contacts)) {
                            log.trace("%s contacts retrieved",
                                contactData.Contacts.length > 0 ?
                                contactData.Contacts.length : "No");
                        }
                        if (contactData.Contacts.length > 0) {
                            processContacts(contactData.Contacts.filter(function(contact) {
                                return contact.FieldValues.filter(function(field) {
                                    return field.FieldName === 'Membership enabled';
                                })[0].Value == true;
                            }), action);
                        }
                    } else {
                        // query complete -- get the results (an extra API call)
                        resId = contactData.ResultId;
                        log.trace("Request complete (result ID: %s) -- retrieving contacts with action %s ...",
                        resId, action);
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
                    log.trace("This should not happen unless the API is changed -- returned state is '%s'",
                        contactData.State);
            }
        }
        return 1;
    });
}

// allowable actions
const actions = ['newbieToNewcomerUpdate'];
var processed = 0;
var updated = 0;
var skipped = 0;
var errors = 0;

/*************************
 * process member record *
 *************************/
const processContact = function(contact, index, callback) {
    log.trace("%d >>> Processing contact ID %s (%s %s)",
        index + 1, contact.id, contact.firstName, contact.lastName);
    processed++;

    // Update membership level
    log.trace("%d >>> Updating membership level to '%s' for %s %s (contact ID: %s)",
        updated, contact.membershipLevel, contact.firstName, contact.lastName, contact.id);

    const levelUpdateArgs = {
        path: { accountId: config.accountId, contactId: contact.id.toString() },
        data: {
            "Id": contact.id,
            "MembershipLevel": {
                "Id": contact.membershipLevelId /*,
                "Url": "https://api.wildapricot.org/v2.1/accounts/287727/MembershipLevels/1041308",
                "Name": "Regular"*/
            } /*,
            "FieldValues": [
                {
                    "FieldName": "Membership status",
                    "SystemCode": contact.membershipStatusSysCode,
                    "Value": contact.status
                }
            ]*/
        }
    };

    /*****************************
     * Update the contact record *
     *****************************/
    apiClient.methods.updateContact(levelUpdateArgs, function(contactDataUpd, response) {
        if (!_.isNil(contactDataUpd) && !_.isNil(contactDataUpd.Id)) {
            updated++;
            log.trace("%d >>> Membership level successfully updated to for %s %s (contact ID: %s)",
                index + 1, contactDataUpd.FirstName, contactDataUpd.LastName,
                contactDataUpd.Id);
            setTimeout(function() {
                callback();
            }, 1000);
        } else {
            errors++;
            const msg = util.format("%d >>> Failed to update membership level for %s %s (contact ID %s) -- %s (%s)",
                index + 1, contact.firstName, contact.lastName, contact.id,
                response.statusMessage, response.statusCode);
            log.error(msg);
            setTimeout(function() {
                callback();
            }, 1000);
        }
    });
};

/*************************
 * Process member records *
 *************************/
const processContacts = function(newbies, action) {
    if (actions.indexOf(action) < 0) {
        throw new Error(util.format("Unsupported action (%s)", action));
    }

    // This should match the results from the "Friends of Newcomers"
    // saved search in WildApricot
    log.info("%d newbies to process", newbies.length);

    // For each alumni
    var newbieRecords = [];
    for (var n = 0; n < newbies.length; n++) {
        var newbie = newbies[n];

        switch(action) {
            case "newbieToNewcomerUpdate":
                newbieRecords.push({
                    action: action,
                    membershipLevel: 'NewcomerMember', // TODO: lookup id?
                    membershipLevelId: lookupMembershipLevel('NewcomerMember'),
                    membershipStatusSysCode: newbie.FieldValues.filter(function(field) {
                        return field.FieldName == 'Membership status';
                    })[0].SystemCode,
                    status: 'Active',
                    firstName: newbie.FirstName,
                    lastName: newbie.LastName,
                    id: newbie.Id
                });
                break;

            default:
                log.warn("This should not happen -- requested action is '%s'", action);
        }
    }

    if (newbieRecords.length > 0) {
        async.eachOfSeries(newbieRecords, processContact, function(err) {
            if (err) {
                //throw err;    // continue even if one update fails.
                log.error(err);
            } else {
                // Create sendEmail params
                var listText, contact = "";
                var listHtml = "<ul>";
                newbieRecords.map(record => {
                    contact = util.format("%s %s (%d)", record.firstName, record.lastName, record.id);
                    listText += ("\n" + contact);
                    listHtml += ("<li>" + contact + "</li>");
                });
        
                var params = {
                    Destination: {
                        ToAddresses: [
                            emailTo
                        ]
                    },
                    Message: {
                        Body: {
                            Html: {
                                Charset: "UTF-8",
                                Data: util.format("%s processed for %d newbie%s with %d updated, %d skipped, and %d error%s %s",
                                    action, processed, (processed > 1 ? "s" : (processed == 1 ? "" : "s")),
                                    updated, skipped, errors, (errors == 1 ? "" : "s"), listHtml)
                            },
                            Text: {
                                Charset: "UTF-8",
                                Data: util.format("%s processed for %d newbie%s with %d updated, %d skipped, and %d error%s\n%s",
                                    action, processed, (processed > 1 ? "s" : (processed == 1 ? "" : "s")),
                                    updated, skipped, errors, (errors == 1 ? "" : "s"), listText)
                            }
                        },
                        Subject: {
                            Charset: "UTF-8",
                            Data: util.format("%sNewbie to Newcomer update",
                                errors > 0 ? "*** ERRORS: " : "")
                        }
                    },
                    Source: emailFrom,
                    ReplyToAddresses: [
                        'no-reply@sbnewcomers.org'
                    ]
                };

                // Create the promise and SES service object
                var sendPromise = new aws.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();
                log.info("%s processed for %d newbie%s with %d updated, %d skipped, and %d error%s",
                    action, processed, (processed > 1 ? "s" : (processed == 1 ? "" : "s")),
                    updated, skipped, errors, (errors == 1 ? "" : "s"));

                // Handle promise's fulfilled/rejected states
                sendPromise.then(
                    function (data) {
                        // reset counters
                        processed = 0;
                        errors = 0;
                        //console.log(data.MessageId);
                    }).catch(
                    function (err) {
                        console.error(err, err.stack);
                    }
                );
            }
        });
    }

    return processed;
};

/*****************
 * Error handler *
 *****************/
process.on('uncaughtException', (err) => {
    log.error(1, `${err}`);
});

/*******************************
 * set query filter parameters *
 *******************************/
var today = new Date();
today.setDate(today.getDate() + 641);
var todayPlus640 = today.toISOString().substring(0, 10);    // keep the yyyy-mm-dd portion
console.log("Today + 640 days: " + todayPlus640);

/****************************
 * Membership levels lookup *
 ****************************/
var levels = []; // populated below by apiClient.methods.listMembershipLevels
function lookupMembershipLevel(ml) {
    return levels.filter(level => {return level.name == ml; })[0].id;
}

var args = {
    path: { accountId: config.accountId },
    parameters: { $async: false }
};
apiClient.methods.listMembershipLevels(args, function(levelData, response) {
    if (!_.isNil(levelData)) {
        // good response
        if (_.isArray(levelData)) {
            log.trace("%d initial membership levels retrieved", levelData.length);
        }
        if (levelData.length > 0) {
            for (var n = 0; n < levelData.length; n++) {
                var level = levelData[n];
                levels.push({
                    id: level.Id,
                    name: level.Name
                });
            }

            /***********************
             * run the main script *
             ***********************/
            const newbieArgs = {
                path: { accountId: config.accountId },
                parameters: {
                    $select: "'First name','Last name','Membership status','Membership enabled','Member since', 'Renewal due",
                    $filter: "'Membership status' eq 'Active'" +
                             " AND 'Membership level ID' eq " + lookupMembershipLevel('NewbieNewcomer') +
                             " AND 'Renewal due' le '" + todayPlus640 + "'"
                }
            };
            getContacts(newbieArgs, 'newbieToNewcomerUpdate');
        }
    }
});
