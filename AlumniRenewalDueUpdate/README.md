# Renewal Date Update for Alumni

A Node.js script that uses the WildApricot API to execute a daily query of members who 'graduated' in the past 24 hours and set the renewal date in the database to 730 days from the previous renewal date.

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/AlumniRenewalDueUpdate
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
0 10 * * * cd /home/ec2-user/sbnewcomers/AlumniRenewalDueUpdate && \
  ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/AlumniRenewalDueUpdate/index.js
```

## Viewing the Log

To view the current log file, execute the following commands:

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/alumni_update.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\alumni_update.log -o short
```