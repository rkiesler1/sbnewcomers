# Database Update for Newbies
A Node.js script that uses the WildApricot API to execute a daily query of members who joined in the past 90 days and set an appropriate flag in the members' database. The script also resets the newbie flag for all members with the flag who have been with SB Newcomers for more than 90 days.

## Requirements

* [Node.js](https://nodejs.org/en/download/) v8.12.0 or later
* NPM v6.4.1 or later
* [Python](https://www.python.org/downloads/) 2.7.15 or later
* Git v2.14 or later

## Prerequisites

* You __***must***__ have Administrator rights on WildApricot. Contact the Technology Committee ([:email:](mailto:technology@sbnewcomers.org)) for assistance.
* Recipient e-mail address for reporting (e.g., technology@sbnewcomers.org) __***must***__ be verified in the Amazon Simple E-mail Service (SES) console ([HOWTO](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses-procedure.html)).

## Linux Setup

1. Execute the following commands to install all prerequisites:
   ```bash
   yum install git
   git --version
   curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.0/install.sh | bash
   . ~/.nvm/nvm.sh
   nvm install 8.12.0
   node -v
   npm -v
   ```

2. Execute the following commands:
   ```bash
   git clone https://github.com/rkiesler1/sbnewcomers.git
   cd sbnewcomers/DatabaseUpdateNewbie
   ```

3. Copy the file `.env_sample` to `.env`

4. Edit the file `.env` and update with your SBNC login credentials
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

5. Copy the file `aws_sample.json` to `aws.json`

6. Edit the file `aws.json` and update with your AWS access key and secret key. If you need more assistance, contact the Technology Committee ([:email:](mailto:technology@sbnewcomers.org)).
   ```javascript
   {
      "accessKeyId": "<your_aws_access_key>",
      "secretAccessKey": "<your_aws_secret_key>",
      "region": "us-west-2"
   }
   ```

7. Execute the following commands:
   ```bash
   npm install
   ```

## Executing the Script

### Manually

###
Execute the following commands:
```bash
node index.js
```

Add the following `cron` jobs to `/etc/cron.daily`:
```bash
0 7 * * * cd /home/ec2-user/sbnewcomers/DatabaseUpdateNewbie && ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/DatabaseUpdateNewbie/index.js
0 8 * * * > /var/spool/mail/ec2-user
```

### On a Schedule


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