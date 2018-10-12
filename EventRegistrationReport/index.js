/*jshint esversion: 6 */
const _    = require('lodash');

// command-line
const args = require('optimist').argv,
      help = 'Usage: node index.js [options]\n' +
        'Options:\n' +
        ' -e, --event ID    Generate registration report for event ID\n';

if (args.h || args.help) {
    console.log(help);
    process.exit(0);
}

var eventId = (args.e ? args.e : (args.event ? args.event : null));
if (_.isNil(eventId)) {
    console.log(help);
    process.exit(0);
}

const async    = require('async');
const path     = require('path');
const util     = require('util');

const config = require(path.join(__dirname, '..', 'shared/config.js'));
const wildapricot = require(path.join(__dirname, '..', 'shared/wildapricot.js'));

// configure logging
var fs = require('fs');
var logsDir = path.join(__dirname, './logs');

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
                path: path.join(__dirname, '.', 'logs/event_reg.log'),
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

const tableTop = "<style>\n" +
    "table, td, th {\n" +
    "\tborder: 1px solid;\n" +
    "\tborder-collapse: collapse;\n" +
    "}\n" +
    "th {text-align: left; vertical-align: top;}\n" +
    "</style>\n" +
    "<table>\n" +
    "\t<tr>\n" +
    "\t\t<th>Check in</th>\n" +
    "\t\t<th>Registrant<br/>Name, Email, Organization</th>\n" +
    "\t\t<th>Membership<br/>Status, Renewal due, Level</th>\n" +
    "\t\t<th>Registration<br/>Type, Amount, Date, Invoice</th>\n" +
    "\t\t<th>Payment status</th>\n" +
    "\t</tr>\n";
const tableBottom = "</table>";

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
            }
        }
        return 1;
    });
}

/*******************************
 * Get event registration info *
 *******************************/
var attendees = [];
function getEventRegistrations(args) {
    const interval = 10000;

    // send the member contacts query to the API
    apiClient.methods.listEventRegs(args, function(eventData, response) {
        if (!_.isNil(eventData) && _.isArray(eventData) && eventData.length > 0) {
            // good response -- get attendees
            attendees = _.map(eventData, "Contact");
            if (_.isArray(attendees) && attendees.length === eventData.length) {
                // get IDs to pass into getContacts...
                var ids = _.map(attendees, "Id");
                const memberArgs = {
                    path: { accountId: config.accountId },
                    parameters: {
                        $filter: "'Id' in [" + ids.toString() + "]"
                    }
                };

                getContacts(memberArgs);

                var wait = setInterval(function() {
                    if (contacts.length === 0 && !done) {
                        log.trace("Getting contact data...");
                    } else {
                        var html = tableTop;
                        for (var i = 0; i < attendees.length; i++) {
                            var attendee = eventData[i];
                            var email = attendee.RegistrationFields.filter(function(field) {
                                return field.FieldName === "e-Mail";
                            })[0].Value.toLowerCase();
                            var regType = attendee.RegistrationType.Name;
                            var regFee = util.format("$%d.00", attendee.RegistrationFee);
                            var df = {year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
                            var regDate = new Date(attendee.RegistrationDate).toLocaleTimeString("en-US", df);
                            var invoice = attendee.Invoice;
                            if (!_.isNil(invoice)) {
                                var invoiceArgs = {
                                    path: {
                                        accountId: config.accountId,
                                        invoiceId: invoice.Id
                                    }
                                };
                                /*
                                apiClient.methods.listInvoice(invoiceArgs, function(invoiceData, invResp) {
                                    var row = "<tr>\n" +
                                        "\t<td style='text-align: center;'>&#9634;</td>\n" + // checkin
                                        "\t<td>" + attendee.DisplayName + "<br/><a href='mailto:" + email + "'>" + email + "</a></td>\n" +
                                        "\t<td></td>\n" +
                                        "\t<td><b>" + regType + " - " + regFee + "</b><br/>" + regDate +
                                            "<br/>Invoice #" + invoiceData.DocumentNumber + "</td>\n" +
                                        "\t<td></td>\n" +
                                        "</tr>";
                                    html += row;
                                });
                                */
                                var contact = contacts.filter(function(contact){
                                    return contact.Id === attendee.Contact.Id;
                                })[0];
                                var row = "<tr>\n" +
                                    "\t<td style='text-align: center;'>&#9634;</td>\n" + // checkin
                                    "\t<td>" + attendee.DisplayName + "<br/><a href='mailto:" + email + "'>" + email + "</a></td>\n" +
                                    "\t<td>" + contact.Status + " member<br/>" + "</td>\n" +
                                    "\t<td><b>" + regType + " - " + regFee + "</b><br/>" + regDate + "</td>\n" +
                                    "\t<td></td>\n" +
                                    "</tr>";
                                html += row;
                            }
                        }
                        html += tableBottom;
                        console.log(html);
                        clearInterval(wait);
                    }
                }, 10000);

            }
        }
    });
}

/*****************
 * Error handler *
 *****************/
process.on('uncaughtException', (err) => {
    log.error(1, `${err}`);
});

/************************
 * set query parameters *
 ************************/

// members -- 91+ days since join date
const eventArgs = {
    path: { accountId: config.accountId },
    parameters: {
        eventId: eventId
    }
};

/***********
 * run it! *
 ***********/
getEventRegistrations(eventArgs);