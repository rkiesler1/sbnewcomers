const aws      = require('aws-sdk');
const action = "setNewbieFlag";

console.log("********* email ***********");
// Set the region
aws.config.loadFromPath('./aws.json');
console.log(aws.config);

// Create sendEmail params
var params = {
    Destination: {
        ToAddresses: [
            'rkiesler@gmail.com'    // TODO: sub w/ technology
        ]
    },
    Message: {
        Body: {
            Html: {
                Charset: "UTF-8",
                Data: action + " complete"
            },
            Text: {
                Charset: "UTF-8",
                Data: action + " complete"
            }
        },
        Subject: {
            Charset: 'UTF-8',
            Data: 'Newbie Flag Database Update'
        }
    },
    Source: 'rkiesler@gmail.com',   // TODO: sub w/ technology
    ReplyToAddresses: [
        'no-reply@sbnewcomers.org'
    ]
};

// Create the promise and SES service object
var sendPromise = new aws.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

// Handle promise's fulfilled/rejected states
sendPromise.then(
    function (data) {
        console.log(data.MessageId);
    }).catch(
    function (err) {
        console.error(err, err.stack);
    }
);
