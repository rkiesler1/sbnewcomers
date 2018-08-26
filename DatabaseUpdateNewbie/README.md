# Database Update for Newbies
A Node.js script that uses the WildApricot API to execute a daily query of members who joined in the past 90 days and set an appropriate flag in the members' database. The script also resets the newbie flag for all members with the flag who have been with SB Newcomers for more than 90 days.

## Requirements

* [Node.js](https://nodejs.org/en/download/) v8.11.4 or later
* NPM v6.4.0 or later (run `npm install -g npm@latest` after installing Node.js)
* [Python](https://www.python.org/downloads/) 2.7.15 or later

## Prerequisites

You __***must***__ have Administrator rights on WildApricot. Contact the [Technology Committee](mailto:technology@sbnewcomers.org) for assistance.

## Running

1. Copy `.env_sample` to `.env`

2. Edit `.env` and update with your SBNC login credentials
   ```
   wildapricot_user_id=<your_sbnc_user_id>
   wildapricot_password=<your_sbnc_password>
   ```
   The `wildapricot_client_id, wildapricot_client_secret and wildapricot_account_id` values should not change, unless someone has modified or deleted the SBNCAPI authorized application (see the Settings >> Security >> Authorized applications option on WildApricot). If that does happen, create a new authorized application ([HOWTO](https://gethelp.wildapricot.com/en/articles/180-authorizing-external-applications)) or contact the [Technology Committee](mailto:technology@sbnewcomers.org) for assistance.

3. Execute the following commands:
   ```bash
   npm install
   node index.js
   ```

## Viewing the Log

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/newbie_update.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\newbie_update.log -o short
```