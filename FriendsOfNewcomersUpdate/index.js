/*jshint esversion: 6 */
const _        = require('lodash');
const async    = require('async');
const path     = require('path');
const util     = require('util');
const aws      = require('aws-sdk');

aws.config.loadFromPath(path.join(__dirname, '..', 'shared/aws.json'));
const config = require(path.join(__dirname, '..', 'shared/config.js'));
const wildapricot = require(path.join(__dirname, '..', 'shared/wildapricot.js'));

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
    name: 'fons_update',
    streams: [
        {
            stream: process.stderr,
            level: 'info'
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, '.', 'logs/fons_update.log'),
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

    // send the FoN query to the API
    apiClient.methods.listContacts(args, function(contactData, response) {
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
                            log.trace("%d initial contacts retrieved", contactData.Contacts.length);
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
const actions = ['updateRenewalDate'];
var processed = 0;
var updated = 0;
var skipped = 0;
var errors = 0;

/*************************
 * process member record *
 *************************/
const processContact = function(contact, index, callback) {
    log.trace("%d >>> Processing contact ID %s with renewal date %s",
        index + 1, contact.id, contact.renewalDate);
    processed++;

    // Check if the member registered for a recent event
    const eventArgs = {
        path: { accountId: config.accountId },
        parameters: {
            contactId: contact.id,
            includeWaitList: true
        }
    };

    /****************************************
     * Get the member's event registrations *
     ****************************************/
    apiClient.methods.listContactEventRegs(eventArgs, function(eventRegsData, response) {
        if (!_.isNil(eventRegsData) && _.isArray(eventRegsData) && eventRegsData.length > 0) {
            // sort the registrations by date
            eventRegsData.sort(compareEventRegDates);

            // compare the latest event registration to the current renewal date
            var latestRegDate = new Date(eventRegsData[eventRegsData.length - 1].RegistrationDate);
            var renewalDate = new Date(contact.renewalDate);

            /*************************************
             * TEST BLOCK for test user 47506410 *
             *************************************/
            //if (eventArgs.parameters.contactId == "47506410") {
            //    renewalDate.setYear(latestRegDate.getYear() - 1);
            //    log.trace("*** TEST CODE: Updated renewal date: %s", renewalDate);
            //}
            /******************
             * END TEST BLOCK *
             ******************/

            if (latestRegDate > renewalDate) {
                log.trace("%d >>> Updating renewal date to %s for %s %s (contact ID: %s)", updated,
                formatDate(latestRegDate), contact.firstName, contact.lastName, contact.id);

                const renewalUpdateArgs = {
                    path: { accountId: config.accountId, contactId: contact.id.toString() },
                    data: {
                        "Id": contact.id,
                        "FieldValues": [
                            {
                                "FieldName": "Renewal due",
                                "SystemCode": contact.renewalDateSysCode,
                                "Value": latestRegDate
                            }
                        ]
                    }
                };

                /*****************************
                 * Update the contact record *
                 *****************************/
                apiClient.methods.updateContact(renewalUpdateArgs, function(contactDataUpd, response) {
                    if (!_.isNil(contactDataUpd) && !_.isNil(contactDataUpd.Id)) {
                        updated++;
                        log.trace("%d >>> Renewal date successfully updated for %s %s (contact ID: %s)",
                            index + 1, contactDataUpd.FirstName, contactDataUpd.LastName,
                            contactDataUpd.Id);
                        setTimeout(function() {
                            callback();
                        }, 1000);
                    } else {
                        errors++;
                        const msg = util.format("%d >>> Failed to %s renewal date for contact ID %s",
                            index + 1, contact.action.substring(0, contact.action.indexOf('RenewalDate' + 1)),
                            contact.id);
                        log.error(msg);
                        setTimeout(function() {
                            callback();
                        }, 500);
                    }
                });
            } else {
                skipped++;
                log.trace("Skipping update for %s %s (contact ID: %s)", contact.firstName, contact.lastName, contact.id);
                callback();
            }
        } else {
            skipped++;
            log.trace("No event registrations for %s %s (contact ID: %s)", contact.firstName, contact.lastName, contact.id);
            callback();
        }
    });
};

const compareEventRegDates = function(regA, regB) {
    var dateA = new Date(regA.RegistrationDate);
    var dateB = new Date(regB.RegistrationDate);
    if (dateA > dateB) return 1;
    if (dateB > dateA) return -1;

    return 0;
};

/*************************
 * Process member records *
 *************************/
const processContacts = function(fons, action) {
    if (actions.indexOf(action) < 0) {
        throw new Error(util.format("Unsupported action (%s)", action));
    }

    // This should match the results from the "Friends of Newcomers"
    // saved search in WildApricot
    log.info("%d FoNs to process", fons.length);

    // For each FoN
    var fonRecords = [];
    for (var n = 0; n < fons.length; n++) {
        var fon = fons[n];
        var renewalDate = fon.FieldValues.filter(function(field) {
            return field.FieldName === 'Renewal due';
        })[0].Value;
        if (!_.isNil(renewalDate)) {
            renewalDate = renewalDate.substring(0,10);
        }
        const renewalDueSysCode = fon.FieldValues.filter(function(field) {
            return field.FieldName === 'Renewal due';
        })[0].SystemCode;

        switch(action) {
            case "updateRenewalDate":
                fonRecords.push({
                    action: action,
                    renewalDate: fon.FieldValues.filter(function(field) {
                        return field.FieldName == 'Renewal due';
                    })[0].Value,
                    status: fon.FieldValues.filter(function(field) {
                        return field.FieldName == 'Membership status';
                    })[0].Value.Label,
                    renewalDateSysCode: renewalDueSysCode,
                    firstName: fon.FirstName,
                    lastName: fon.LastName,
                    id: fon.Id
                });
                break;

            default:
                log.warn("This should not happen -- requested action is '%s'", action);
        }
    }

    if (fonRecords.length > 0) {
        async.eachOfSeries(fonRecords, processContact, function(err) {
            if (err) {
                //throw err;    // continue even if one update fails.
                log.error(err);
            } else {
                // Create sendEmail params
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
                                Data: util.format("<p>Renewal date checked for %d alum%s who registered for an open event:</p><ul><li>%d updated</li><li>%d skipped</li><li>%d error%s</li>",
                                    processed, (processed > 1 ? "ni" : (processed == 1 ? "" : "ni")),
                                    updated, skipped, errors, (errors == 1 ? "" : "s"))
                            },
                            Text: {
                                Charset: "UTF-8",
                                Data: util.format("Renewal date checked for %d alum%s who registered for an open event:\n%d updated\n%d skipped\n%d error%s",
                                    processed, (processed > 1 ? "ni" : (processed == 1 ? "" : "ni")),
                                    updated, skipped, errors, (errors == 1 ? "" : "s"))
                            }
                        },
                        Subject: {
                            Charset: 'UTF-8',
                            Data: 'Renewal Date Database Update for Existing Alumni'
                        }
                    },
                    Source: emailFrom,
                    ReplyToAddresses: [
                        'no-reply@sbnewcomers.org'
                    ]
                };

                // Create the promise and SES service object
                var sendPromise = new aws.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();
                log.info("Renewal date processed for %d alum%s who recently registered for an open event with %d updated, %d skipped, and %d error%s",
                    processed, (processed > 1 ? "ni" : (processed == 1 ? "" : "ni")),
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

// format date
function formatDate(d) {
    var month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

var today = new Date().toISOString().substring(0, 10);    // keep the yyyy-mm-dd portion

/*******************************
 * set query filter parameters *
 *******************************/
const fonArgs = {
    path: { accountId: config.accountId },
    parameters: {
        $select: "'First name','Last name','Renewal due','Membership status','Membership enabled'",
        //$filter: "'Id' eq '47506410'"                   // Tester Newbie
        $filter: "'Membership level ID' eq '694456'"    // Friends of Newcomers
    }
};

/***********
 * run it! *
 ***********/
getContacts(fonArgs, 'updateRenewalDate');
