/*jshint esversion: 6 */
/*jslint node: true */
'use strict';

const _      = require('lodash');
const async  = require('async');
const bunyan  = require('bunyan');
const Client = require('node-rest-client').Client;

var log = bunyan.createLogger({
    name: 'wildapricot',
    streams: [
        {
            stream: process.stderr,
            level: "debug"
        },
        {
            path: './newbie_update.log'
        }
    ],
    level : bunyan.DEBUG /* bunyan.INFO */
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
            log.info("OAuth token: %s", accessToken);
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
