# Deployment and rollback

The site address stays the same. The steps can be done in this order without the site going down.

## 1. Publish the site

Push to `main` on GitHub. Vercel builds it in about 2 minutes. The site then saves through the working link, even before step 2.

Check: open the site, sign in, add a note to a task and refresh. The note should still be there, and in the Sheet.

## 2. Update the Apps Script

This turns on assignment emails, the audit log, Trash and field-level saving.

1. In the Sheet: **File > Make a copy**. This is your recovery point.
2. **Extensions > Apps Script.** Replace everything in `Code.gs` with `apps-script/Code.gs`, and save.
3. Choose `setupSheet` in the function menu and click **Run**. Allow the permissions, including sending email.
4. Go to the Sheet tab and click **OK** on the message.
5. **Deploy > Manage deployments.** For every **Web app** entry: pencil icon, **Version: New version**, **Deploy**. Do not use **New deployment**, because that changes the link.
6. In the **Users** tab, click A2. **File > Import > Upload**, choose your team file, and pick **Replace data at selected cell**.
7. Refresh the Sheet. Click **Control Tower > Replace AK with Ankit Khanna**, then **Control Tower > Send a test email to me**.

Check: open the script's `/exec?action=ping` address. You should see `"api":3`, and no Sheet address.

## 3. Turn on Google sign-in, when you are ready

Follow [SETUP_SIGN_IN.md](../SETUP_SIGN_IN.md). Make the repository private as well.

## Rollback

| Problem | What to do |
|---|---|
| The site misbehaves | Vercel: **Deployments**, choose the previous one, **Promote to Production** |
| The script misbehaves | Apps Script: **Deploy > Manage deployments >** pencil icon, choose the previous version, **Deploy** |
| Locked out after Google sign-in | Sheet menu: **Control Tower > Turn off sign-in** |
| Data looks wrong | Sheet: **File > Version history**, or your copy from step 2 |

## Later releases

`npm test`, then `npm run test:e2e` (needs `npm i --no-save playwright`), then `node build.js`, then commit.
