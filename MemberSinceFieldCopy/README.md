# Member Since Field Copy

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
0 7 * * * cd /home/ec2-user/sbnewcomers/MemberSinceFieldCopy && `which node` /home/ec2-user/sbnewcomers/MemberSinceFieldCopy/index.js
```
