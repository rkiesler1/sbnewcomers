# Export Events to Google Calendar

A Node.js script that uses the WildApricot and Google Calendar APIs to export events from WildApricot to a Google Calendar that anyone with a Google account can subscribe to and see SBNC events on any Google connected device.

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/ExportEventsToGCalendar
   npm install
   ```

## Executing the Script

### Manually

Execute the following commands:

```bash
node index.js
```

### On a Schedule

Add the following `cron` jobs to `/etc/cron.hourly`:

```bash
# run hourly at 30 minutes after the hour
30 0-23 * * * cd /home/ec2-user/sbnewcomers/ExportEventsToGCalendar && \
  ~/.nvm/versions/node/v8.12.0/bin/node /home/ec2-user/sbnewcomers/ExportEventsToGCalendar/index.js
```

## Viewing the Log

To view the current log file, execute the following commands:

On Mac/Linux

```bash
./node_modules/.bin/bunyan ./logs/event_export.log -o short
```

On Windows

```bash
.\node_modules\.bin\bunyan .\logs\event_export.log -o short
```