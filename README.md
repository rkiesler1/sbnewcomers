# sbnewcomers
Repository for all projects by SB Newcomers Technology committee members

## Requirements

* [Node.js](https://nodejs.org/en/download/) v8.12.0 or later
* NPM v6.4.1 or later
* [Python](https://www.python.org/downloads/) 2.7.15 or later
* Git v2.14 or later

## Prerequisites

* You __***must***__ have Administrator rights on WildApricot. Contact the Technology Committee ([:email:](mailto:technology@sbnewcomers.org)) for assistance.
* Recipient e-mail address for reporting (e.g., technology@sbnewcomers.org) __***must***__ be verified in the Amazon Simple E-mail Service (SES) console ([HOWTO](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses-procedure.html)).

## Linux Setup

Execute the following commands to install all prerequisites:
```bash
yum install git
git --version
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 8.12.0
node -v
npm -v
```

## Projects

* [Database Update for Newbies](./DatabaseUpdateNewbie) - A Node.js script that uses the WildApricot API to execute a daily query of members who joined in the past 90 days and set an appropriate flag in the members' database. The script also resets the newbie flag for all members with the flag who have been with SB Newcomers for more than 90 days.