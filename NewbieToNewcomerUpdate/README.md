# Newbie to Newcomer Update

A Node.js script that uses the WildApricot API to execute a daily query of members who have been active in the club for more than 90 day and change their membership level from "Newbie" to "Regular".

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/NewbieToNewcomerUpdate
   npm install
   ```

## Executing the Script

### Manually

Execute the following commands:

```bash
node index.js
```

### On a Schedule

Add the following `cron` jobs to `/etc/cron.daily` (will execute at 3am Pacific):

```bash
0 10 * * * cd /home/ec2-user/sbnewcomers/NewbieToNewcomerUpdate && \
  ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/NewbieToNewcomerUpdate/index.js
```

## Viewing the Log

To view the current log file, execute the following commands:

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/newbie_to_newcomer.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\newbie_to_newcomer.log -o short
```