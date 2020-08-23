# Member Since Field Copy

><span style="color:#e1341e">Member Since Field Copy is deprectaed</span><br>
This script is now deprecated due to the change in how membership levels are handled.

A Node.js script that uses the WildApricot API to copy the `Member since` system field value to a custom read-only that can be used for display purposes in member list reports.

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/MemberSinceFieldCopy
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
30 7 * * * cd /home/ec2-user/sbnewcomers/MemberSinceFieldCopy && \
  ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/MemberSinceFieldCopy/index.js
```

## Viewing the Log

To view the current log file, execute the following commands:

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/member_since_copy.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\member_since_copy.log -o short
```
