# Deployment and rollback

Deliverable 15. The site URL and Apps Script URL stay the same. The order below is safe: the new site works with the old script, and the old site works with the new script, so nothing breaks between steps.

## Before you start

In the Sheet: **File > Make a copy**. Name it with today's date. This is your recovery point.

## 1. Update the Apps Script

1. Sheet > **Extensions > Apps Script**. Open `Code.gs`.
2. **Copy the current code into a text file and keep it.** This is your rollback.
3. Replace everything with `apps-script/Code.gs` from this release. Save.
4. Choose `setupSheet` in the function menu and click **Run**. Allow the permissions if asked. New tabs appear; existing tabs are untouched.
5. **Deploy > Manage deployments >** pencil icon **> Version: New version > Deploy.** Do not create a new deployment: that would change the URL.

Check: open `YOUR_EXEC_URL?action=ping`. You should see `"api":3`.

## 2. Publish the site

Merge the branch into `main`. Vercel builds it. Open the site, refresh, and check that the sidebar and logo appear and your projects load.

## 3. Check saving works

1. Open a task, add a note, and save. The status should read Saved.
2. Refresh. The note is still there.
3. Check the Sheet's `AuditLog` tab has a new row.
4. Remove the test note's effect if you wish; the log entry stays.

## 4. Turn on backups

Sheet menu: **Control Tower > Turn on daily backup**. This also starts the morning overdue check.

## 5. Turn on sign-in

Follow [SETUP_SIGN_IN.md](../SETUP_SIGN_IN.md). **Do this soon: until then the data is open to anyone with the link.**

## Rollback

| Problem | What to do |
|---|---|
| The site misbehaves | In Vercel: Deployments, choose the previous one, **Promote to Production**. Data is unaffected |
| The script misbehaves | Apps Script: **Deploy > Manage deployments >** pencil **> Version:** choose the previous version **> Deploy** |
| Locked out after sign-in | Sheet menu: **Control Tower > Turn off sign-in** |
| Data looks wrong | Use the Sheet's **File > Version history**, or your copy from the start |

The old site keeps working with the new script as long as sign-in is off. New tabs can stay; the old script ignores them.

## Later releases

`npm test`, then `npm run test:e2e` (needs `npm i --no-save playwright`), then `node build.js`, then commit.
