/*jshint esversion: 6 */
/*jslint node: true */
'use strict';

const _      = require('lodash');
const async  = require('async');
const path   = require('path');
const Client = require('node-rest-client').Client;

// configure logging
const bunyan = require('bunyan');
const RotatingFileStream = require('bunyan-rotating-file-stream');
var log = bunyan.createLogger({
    name: 'wildapricot',
    streams: [
        {
            stream: process.stderr,
            level: "info"
        },
        {
            stream: new RotatingFileStream({
                path: path.join(__dirname, '.', 'logs/wild_apricot_client.log'),
                period: '1d',          // daily rotation
                totalFiles: 500,       // keep up to 500 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '1m',       // Rotate log files larger than 1 megabyte
                totalSize: '1g',       // Don't keep more than 1gb of archived log files
                gzip: true             // Compress the archive log files to save space
            }),
            level: "trace"
        }
    ],
    level : bunyan.TRACE
});

var options         = {
    tokenHost: 'https://oauth.wildapricot.org',
    tokenEndpoint: '/auth/token',
    resourceHost: 'https://api.wildapricot.org',
    resourceEndpoint: '/v2.1' },
    client          = null,
    accessToken     = null,
    scope           = null,
    tokenExpiresAt  = new Date();

function authenticate(callback) {
    var args = {
        'data': ['grant_type=password&username=', options.user, '&password=', options.pass, '&scope=', options.scope].join(''),
        'headers':{
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    client.post(options.tokenHost + options.tokenEndpoint, args, function (data, response) {
        if (data && data.error) {
            log.error(data);
            throw new Error(data.error + (data.error_description ? ': ' + data.error_description : ''));
        } else if (data && data.access_token) {
            accessToken = data.access_token;
            log.trace("OAuth token: %s", accessToken);
            tokenExpiresAt = new Date();
            tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + data.expires_in);
        }
        if (_.isFunction(callback)) callback();
    });
}

function isTokenExpired() {
    return (new Date() > tokenExpiresAt);
}

function getHeaders() {
    return {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
    };
}

function wrapMethods() {
    // Wrap all of our registered WildApricot methods so we can silently inject the authentication headers
    _.each(client.methods, function (method, methodName) {
        client.methods[methodName] = _.wrap(method, function (originalMethod, args, callback) {
            if (!args) args = {};
            if (!args.headers) args.headers = {};

            async.series([
                function (cb) {
                    if (!accessToken || isTokenExpired()) {
                        authenticate(cb);
                    } else {
                        cb();
                    }
                },
                function (cb) {
                    _.extend(args.headers, getHeaders());
                    cb();
                }
            ], function () {
                originalMethod(args, callback);
            });
        });
    });
}

function registerClientMethods() {
    var baseURL = options.resourceHost + options.resourceEndpoint;

    // Contacts: https://api.wildapricot.org/v2.1/accounts/:accountId/contacts/:contactId
    client.registerMethod('listContacts',  baseURL + '/accounts/${accountId}/contacts', 'GET');
    client.registerMethod('listContact',   baseURL + '/accounts/${accountId}/contacts/${contactId}', 'GET');
    client.registerMethod('updateContact', baseURL + '/accounts/${accountId}/contacts/${contactId}', 'PUT');

    // Event registrations: https://api.wildapricot.org/v2.1/accounts/:accountId/eventregistrations?eventId=:eventId
    client.registerMethod('listEventRegs', baseURL + '/accounts/${accountId}/eventregistrations', 'GET');

    // Event registrations: https://api.wildapricot.org/v2.1/accounts/:accountId/eventregistrations?contactId=:contactId
    client.registerMethod('listContactEventRegs', baseURL + '/accounts/${accountId}/eventregistrations', 'GET');

    // Event: https://api.wildapricot.org/v2.1/accounts/:accountId/events?eventId=:eventId
    client.registerMethod('listEvents', baseURL + '/accounts/${accountId}/events', 'GET');
    client.registerMethod('listEvent', baseURL + '/accounts/${accountId}/events/${eventId}', 'GET');

    // Invoice: https://api.wildapricot.org/v2.1/accounts/:accountId/Invoices/:invoiceId",
    client.registerMethod('listInvoice', baseURL + '/accounts/${accountId}/Invoices/${invoiceId}', 'GET');

    wrapMethods();
}

var exports = module.exports = {};

exports.init = function (_options) {
    var requiredOptions = ['user', 'pass', 'client', 'secret', 'scope'],
        missingOptions = _.difference(requiredOptions, _.keys(_options));

    if (missingOptions.length) {
        throw new Error('The following options are required: ' + missingOptions.join(', '));
    }

    _.extend(options, _options);

    client = new Client({
        user: _options.client,
        password: _options.secret
    });
    scope = _options.scope;

    registerClientMethods();

    return client;
};
