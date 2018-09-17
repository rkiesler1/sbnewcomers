# Database Update for Newbies
A Node.js script that uses the WildApricot API to execute a daily query of members who joined in the past 90 days and set an appropriate flag in the members' database. The script also resets the newbie flag for all members with the flag who have been with SB Newcomers for more than 90 days.

## Requirements

* [Node.js](https://nodejs.org/en/download/) v8.11.4 or later
* NPM v6.4.0 or later (run `npm install -g npm@latest` after installing Node.js)
* [Python](https://www.python.org/downloads/) 2.7.15 or later

## Prerequisites

* You __***must***__ have Administrator rights on WildApricot. Contact the Technology Committee ([:email:](mailto:technology@sbnewcomers.org)) for assistance.
* Recipient e-mail address for reporting (e.g., technology@sbnewcomers.org) __***must***__ be verified in the Amazon Simple E-mail Service (SES) console ([HOWTO](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses-procedure.html)).

## Running

1. Copy the file `.env_sample` to `.env`

2. Edit the file `.env` and update with your SBNC login credentials
   ```ini
   wildapricot_user_id=<your_sbnc_user_id>
   wildapricot_password=<your_sbnc_password>
   wildapricot_client_id=<sbniapi_client_id>
   wildapricot_client_secret=<sbniapi_client_secret>
   ```

   The values for `wildapricot_client_id` and `wildapricot_client_secret` can be obtained from the SBNCAPI authorized application (see the **Settings >> Security >> Authorized applications** option on WildApricot). If the SBNCAPI application is ever deleted, a new authorized application can be created in its place ([HOWTO](https://gethelp.wildapricot.com/en/articles/180-authorizing-external-applications)).

   The values for `wildapricot_account_id` and `wildapricot_scope` should not change.

   <kbd style="border: 1px solid; width: 600px;">![Authorized Application](/../screenshots/application.png?raw=true "Authorized Application")</kbd>

   If you need more assistance, contact the Technology Committee ([:email:](mailto:technology@sbnewcomers.org)).

3. Copy the file `aws_sample.json` to `aws.json`

4. Edit the file `aws.json` and update with your AWS access key and secret key. If you need more assistance, contact the Technology Committee ([:email:](mailto:technology@sbnewcomers.org)).
   ```javascript
   {
      "accessKeyId": "<your_aws_access_key>",
      "secretAccessKey": "<your_aws_secret_key>",
      "region": "us-west-2"
   }
   ```

5. Execute the following commands:
   ```bash
   npm install
   node index.js
   ```

## Viewing the Log

To view the current log file, execute the following commands:

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/newbie_update.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\newbie_update.log -o short
```