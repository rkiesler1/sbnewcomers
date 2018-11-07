# New Event Registration Report

A Node.js Web application that uses the WildApricot API to generate a new event registration report that includes a visual indicator of a Newbie stats (&#x2605;). The report also lists all members who are on the waiting list on a separate section.

The application is invoked from a simple Web form that was added to the Chairs Area. To display the form, click the CHAIRS AREA &#187; NEW EVENT REGISTRATION REPORT menu.

<kbd style="border: 1px solid; width: 600px;">![New Event Registration Report](/../screenshots/menu.png?raw=true "New Event Registration Report")</kbd>

The form prompts the user to enter the event ID for which they want to generate the report for.

<kbd style="border: 1px solid; width: 600px;">![Web Form](/../screenshots/webform.png?raw=true "Web Form")</kbd>

Hovering over the [sample]() link will pop up a helper image that shows where the user can get the ID number from.

<kbd style="border: 1px solid; width: 600px;">![Helper Popup](https://www.sbnewcomers.org/resources/Pictures/Events/event_info.png "Helper Popup")</kbd>

## Linux Setup

1. Execute the following commands:

   ```bash
   cd sbnewcomers/EventRegReportWeb
   npm install
   ```

## Running the Web Application

### Manually

Execute the following commands:

```bash
npm start
```

### As a Linux Service

1. Install NGINX reverse proxy

   ```bash
   sudo yum install epel-release
   sudo yum update
   sudo yum install nginx
   ```

2. Verify the NGINX installation

   ```bash
   sudo nginx -v
   ```

3. Configure NGINX

   ```bash
   sudo vi /etc/ngnix/nginxnginx.conf
   ```

   Add this following to the `http` section:

   ```nginx
   http {
       server_names_hash_bucket_size 64;
       ...
   }
   ```

   Add a proxy pass to the default location:

   ```nginx
   location / {
      proxy_pass   http://127.0.0.1:3000;
   }
   ```

4. Start NGINX

   ```bash
   sudo /etc/init.d/nginx start
   ```

5. Install the PM2 process manager

   ```bash
   npm install -g pm2
   pm2 startup
   ```

6. Start the Web application

   ```bash
   pm2 start npm -- start
   ```

7. Configure the security group of the EC2 instance to open HTTP port 80 for access from WildApricot.

8. Test the Web application by navigating to http://<hostname>.compute.amazonaws.com. You should be greated with a simple page:

<kbd style="border: 1px solid; width: 600px;">![Express](/../screenshots/express.png?raw=true "Express")</kbd>

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