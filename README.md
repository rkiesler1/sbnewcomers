# sbnewcomers

Repository for all projects by SB Newcomers Technology committee members

## Requirements

* [Node.js](https://nodejs.org/en/download/) v10.5.3 or later
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
   nvm install 10.5.3
   npm install -g npm@latest
   node -v
   npm -v
   ```

2. Execute the following commands:

   ```bash
   git clone https://github.com/rkiesler1/sbnewcomers.git
   cd sbnewcomers/shared
   npm install
   ```

3. Copy the file `.env_sample` to `.env`

4. Edit the file `.env` and update with your SBNC login credentials:

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

## Scripts

* [Database Update for Newbies](./DatabaseUpdateNewbie) - A Node.js script that uses the WildApricot API to execute a daily query of members who joined in the past 90 days and set an appropriate flag in the members' database. The script also resets the newbie flag for all members with the flag who have been with SB Newcomers for more than 90 days.

* [Member Since Field Copy](./MemberSinceFieldCopy) - A Node.js script that uses the WildApricot API to copy the `Member since` system field value to a custom read-only that can be used for display purposes in member list reports.

## Scheduled Execution

When using a task scheduler (e.g., `cron` on Linux) to execute scripts on a schedule, be mindful of the [WildApricot API limits](https://gethelp.wildapricot.com/en/articles/182#limits) which permit up to 60 calls per minute. Each individual script already takes that into account, but executing two or more scripts on an overlapping schedule will exceed the limits and result in API errors.
