# Database Update for Newbies

><span style="color:#e1341e">Database Update for Newbies is deprectaed</span><br>
This script is now deprecated due to the change in how membership levels are handled.

A Node.js script that uses the WildApricot API to execute a daily query of members who joined in the past 90 days and set an appropriate flag in the members' database. The script also resets the newbie flag for all members with the flag who have been with SB Newcomers for more than 90 days.

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/DatabaseUpdateNewbie
   npm install
   ```

## Executing the Script

### Manually

Execute the following commands:

```bash
node index.js
```

### On a Schedule

Add the following `cron` jobs to `/etc/cron.daily`:

```bash
0 7 * * * cd /home/ec2-user/sbnewcomers/DatabaseUpdateNewbie && \
  ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/DatabaseUpdateNewbie/index.js
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