var dotenv = require('dotenv');
var cfg = {};

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    dotenv.config({path: '.env'});
} else {
    dotenv.config({path: '.env.test', silent: true});
}

cfg.accountId = process.env.wildapricot_account_id;
cfg.userId = process.env.wildapricot_user_id;
cfg.password = process.env.wildapricot_password;
cfg.clientId = process.env.wildapricot_client_id;
cfg.secret = process.env.wildapricot_client_secret;
cfg.scope = process.env.wildapricot_scope;

var requiredConfig = [cfg.accountId, cfg.userId, cfg.password, cfg.clientId,  cfg.secret];
var isConfigured = requiredConfig.every(function(configValue) {
    return configValue || false;
});

if (!isConfigured) {
    var errorMessage =
        'wildapricot_account_id, wildapricot_user_id, wildapricot_password, wildapricot_client_id, and wildapricot_client_secret must be set.';
    throw new Error(errorMessage);
}

// Export configuration object
module.exports = cfg;