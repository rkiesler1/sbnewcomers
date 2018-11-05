/*jshint esversion: 6 */
var express = require('express');
var router = express.Router();

const _    = require('lodash');
const async    = require('async');
const path     = require('path');
const util     = require('util');

const config = require(path.join(__dirname, '../..', 'shared/config.js'));
const wildapricot = require(path.join(__dirname, '../..', 'shared/wildapricot.js'));

// configure logging
var fs = require('fs');
var logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const bunyan  = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
var log = bunyan.createLogger({
    name: 'eventreg',
    streams: [
        {
            stream: process.stderr,
            level: 'trace'
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, '..', 'logs/event_reg.log'),
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

var hbs = require('hbs');
hbs.registerHelper({
    eq: function(v1, v2) {
        return v1 === v2;
    },
    ne: function(v1, v2) {
        return v1 !== v2;
    },
    lt: function(v1, v2) {
        return v1 < v2;
    },
    gt: function(v1, v2) {
        return v1 > v2;
    },
    lte: function(v1, v2) {
        return v1 <= v2;
    },
    gte: function(v1, v2) {
        return v1 >= v2;
    },
    and: function(v1, v2) {
        return v1 && v2;
    },
    or: function(v1, v2) {
        return v1 || v2;
    }
});

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

/* POST event registration report page. */
router.post('/', function(req, res, next) {

    /************************
     * Global error handler *
     ************************/
    var errorMsg;
    var warnMsg;

    /*****************
     * Error handler *
     *****************/
    process.on('uncaughtException', (err) => {
        errorMsg = `${err}`;
        log.error(1, errorMsg);
        res.render('event', {
            title: 'SBNC Event Registration Report',
            error: errorMsg
        });
        return;
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
    var contacts = [];
    var done = false;
    function getContacts(args) {
        const interval = 10000;

        // send the newbie query to the API
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
                        setTimeout(getContacts, interval, args);
                        break;

                    case "Complete":
                        // process results
                        if (!_.isNil(contactData.Contacts)) {
                            if (_.isArray(contactData.Contacts)) {
                                log.trace("%d contacts retrieved", contactData.Contacts.length);
                                contacts = contactData.Contacts;
                                done = true;
                            }
                        } else {
                            // query complete -- get the results (an extra API call)
                            resId = contactData.ResultId;
                            log.info("Request complete (result ID: %s) -- retrieving contacts ...", resId);
                            var resArgs = _.clone(args);
                            resArgs.parameters = {resultId: resId};
                            setTimeout(getContacts, 1000, resArgs); // delay one more second...
                        }
                        break;

                    case "Failed":
                        // query failed -- this should not happen unless the parameters were changed
                        log.error(contactData);
                        break;

                    default:
                        log.trace("This should not happen unless the API is changed -- returned state is '%s'",
                            contactData.State);
                } // switch
            } // contactData != null
            return 1;
        });
    }

    /********************
     * Get invoice info *
     ********************/
    function getInvoice(attendee, index, callback) {
        var regType = attendee.RegistrationType.Name;

        if (regType === "Board Members") {
            // no need to get invoice -- free
            log.trace("%s is a board member -- free", attendee.DisplayName);
            if (callback) return callback();
        } else {
            if (attendee.RegistrationFee > 0 && attendee.PaidSum === attendee.RegistrationFee) {
                // no need to get invoice -- paid
                log.trace("%s already paid", attendee.DisplayName);
                if (callback) return callback();
            }
        }

        var invoice = attendee.Invoice;
        if (!_.isNil(invoice)) {
            var invoiceArgs = {
                path: {
                    accountId: config.accountId,
                    invoiceId: invoice.Id
                }
            };
            apiClient.methods.listInvoice(invoiceArgs, function(invoiceData, invResp) {
                if (!_.isNil(invoiceData) && !_.isNil(invoiceData.DocumentNumber)) {
                    attendee.invoiceNumber = invoiceData.DocumentNumber;
                    const msg = util.format("%d) invoice #%s for %s (ID: %s)",
                        index + 1, attendee.invoiceNumber, attendee.DisplayName, attendee.Id);
                    log.trace(msg);
                } else {
                    const msg = util.format("%d) >>> Failed to get invoice info for %s (ID: %s)",
                        index + 1, attendee.DisplayName, attendee.Id);
                    log.error(msg);
                }
                if (callback) {
                    setTimeout(function() {
                        callback();
                    }, 1000);
                }
            });
        } else {
            const msg = util.format("%d) no invoice for %s (ID: %s)",
            index + 1, attendee.DisplayName, attendee.Id);
            log.trace(msg);
            callback();
        }
    }

    /*******************************
     * Get event registration info *
     *******************************/
    var attendees = [];
    var event;
    function getEventRegistrations(args) {
        const interval = 10000;

        // send the member contacts query to the API
        apiClient.methods.listEventRegs(args, function(eventData, response) {
            if (!_.isNil(eventData) && _.isArray(eventData) && eventData.length > 0) {
                // good response -- get attendees
                attendees = _.map(eventData, "Contact");
                event = _.map(eventData, "Event")[0];
                if (_.isArray(attendees) && attendees.length === eventData.length) {
                    // get IDs to pass into getContacts...
                    var ids = _.map(attendees, "Id");
                    const memberArgs = {
                        path: { accountId: config.accountId },
                        parameters: {
                            $filter: "'Id' in [" + ids.toString() + "]",
                            $fields: "'First name','Last name','Membership status','Member since','New member',Member since readonly','Membership level','Role','Renewal due'"
                        }
                    };

                    getContacts(memberArgs);
                    var wait = setInterval(function() {
                        if (contacts.length === 0 && !done) {
                            log.trace("Getting contact info...");
                        } else {
                            // TODO: only get invoice if paid status is not "paid"
                            // if no invoice set to "Free" othewise "Due"
                            // call synchronously to avoid usage limits
                            async.eachOfSeries(eventData, getInvoice, function(err) {
                                if (err) {
                                    //throw err;    // continue even if one update fails.
                                    log.error(err);
                                } else {
                                    // continue
                                    renderHtml(attendees, eventData);
                                }
                            });

                            clearInterval(wait);
                        }
                    }, 10000);
                }
            }
        });
    }

    function renderHtml(attendees, eventData) {
        var displayAttendees = [];
        var df = {year: 'numeric', month: 'short', day: 'numeric' };
        var dtf = {year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };

        for (var i = 0; i < attendees.length; i++) {
            var attendee = eventData[i];
            attendee.email = attendee.RegistrationFields.filter(function(field) {
                return field.FieldName === "e-Mail";
            })[0].Value.toLowerCase();
            var regType = attendee.RegistrationType.Name;
            var regFee = util.format("$%d.00", attendee.RegistrationFee);
            var paid = util.format("$%d.00", attendee.PaidSum);
            var regDate = new Date(attendee.RegistrationDate).toLocaleTimeString("en-US", dtf);

            var contact = contacts.filter(function(contact){
                return contact.Id === attendee.Contact.Id;
            })[0];
            attendee.contactInfo = contact;

            var newbieStatus = contact.FieldValues.filter(function(field) {
                return field.FieldName === "New member";
            });
            if (!_.isNil(newbieStatus) && newbieStatus.length > 0) {
                attendee.newbieStatus = newbieStatus[0];
            } else {
                attendee.newbieStatus = "No";
            }
            var renewDate = contact.FieldValues.filter(function(field) {
                return field.FieldName === "Renewal due";
            });
            if (!_.isNil(renewDate) && renewDate.length > 0) {
                attendee.renewDate = new Date(renewDate[0].Value).toLocaleDateString("en-US", df);
            } else {
                attendee.renewDate = "";
            }
            var paidStatus;
            if (regType === "Board Members") {
                paidStatus = "Free";
            } else {
                if (attendee.RegistrationFee > 0 && attendee.PaidSum === attendee.RegistrationFee) {
                    paidStatus = "Paid";
                } else {
                    if (null == attendee.invoiceNumber || undefined == attendee.invoiceNumber) {
                        paidStatus = "Free";
                    } else {
                        paidStatus = "Due";
                    }
                }
            }
            attendee.paidStatus = paidStatus;
            attendee.contact = contact;
            attendee.regType = regType;
            attendee.regFee = regFee;
            attendee.regDate = regDate;
            /*
                "\t<td nowrap=\"nowrap\"><span class=\"em\">" + regType + " - " + regFee + "</span><br/>" + regDate +
                    (attendee.invoiceNumber ? "<br/>Invoice #" + attendee.invoiceNumber : "") + "</td>\n" +
                "\t<td>" + paidStatus + "</td>\n" +
                "</tr>\n";
            if (!_.isNil(attendee.Memo) && attendee.Memo.trim().length > 0) {
                row += "<tr class=\"memo\"><td colspan=\"5\">Note:&nbsp;" + attendee.Memo + "</td></tr>\n";
            }
            html += row;*/
            displayAttendees.push(attendee);
        }

        // test
        /*
        attendees = [
            {
                DisplayName: "Roy Kiesler",
                email: "rkiesler@gmail.com",
                newbieStatus: {
                    Value: {
                        Label: "Yes"
                    }
                }
            }
        ];*/
        res.render('event', {
            title: 'SBNC Event Registration Report',
            eventName: event.Name,
            eventDate: new Date(event.StartDate).toLocaleTimeString("en-US", dtf),
            attendees: displayAttendees
        });
    }

    /***************************
     * POST REQUEST PROCESSING *
     ***************************/
    if (!_.isNil(req.body.eventId) && !_.isEmpty(req.body.eventId)) {
        // set query parameters
        const eventArgs = {
            path: { accountId: config.accountId },
            parameters: {
                eventId: req.body.eventId
            }
        };

        getEventRegistrations(eventArgs);

    } else {
        errorMsg = "Missing required eventId parameter";
        res.render('event', {
            title: 'SBNC Event Registration Report',
            error: errorMsg
        });
        return;
    }
});

module.exports = router;
