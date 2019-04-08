# Database Update for Friends of Newcomers

A Node.js script that uses the WildApricot API to execute a daily query of FoN members who registered recently for open events and updates the renewal date for the member to avoid archiving.

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/FriendsOfNewcomersUpdate
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
<<<<<<< HEAD
30 7 * * * cd /home/ec2-user/sbnewcomers/FriendsOfNewcomersUpdate && \
=======
0 8 * * * cd /home/ec2-user/sbnewcomers/FriendsOfNewcomersUpdate && \
>>>>>>> 0eb5976e7364fcadf673128726a16aa9330222e7
  ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/FriendsOfNewcomersUpdate/index.js
```

## Viewing the Log

To view the current log file, execute the following commands:

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/fons_update.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\fons_update.log -o short
```
