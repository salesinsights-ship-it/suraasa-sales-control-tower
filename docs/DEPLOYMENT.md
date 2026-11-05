# Deployment and rollback

The order matters. The new site refuses to talk to an older script, so update the script first. Until you reach step 7, today's site and today's data behave as they do now.

**Before you start:** have the Google account that owns the Sheet open. Allow about 40 minutes.

## 1. Publish the code

Merge the pull request from `feature/automated-task-assignment`, or open its Vercel preview first (see step 8).

## 2. Back up the Sheet

In the Sheet: **File > Make a copy**. This is your recovery point.

## 3. Create the Google client ID

Follow [SETUP_SIGN_IN.md](../SETUP_SIGN_IN.md), steps 1 and 2.

## 4. Update the script

1. In the Sheet: **Extensions > Apps Script**.
2. Replace everything in `Code.gs` with `apps-script/Code.gs` from this project, and save.
3. Choose `setupSheet` in the function menu and click **Run**. Allow the permissions, including sending email.
4. Go to the Sheet tab and click **OK** on the message.

This keeps every record. New columns are added to the right of `_extra`, and the `NotificationLog` tab appears. No email is sent.

## 5. Add your people

In the **Users** tab, click A2, then **File > Import > Upload**, choose your team file, and pick **Replace data at selected cell**. A team file has the columns `email, name, role, active`. Check the roles before moving on: the file decides who is a Super Admin.

Refresh the Sheet, then click:

1. **Control Tower > Set Google sign-in client ID**, and paste the client ID.
2. **Control Tower > Match task owners to registered emails**. This sends nothing.
3. **Control Tower > Replace AK with Ankit Khanna**, if you have not already.

## 6. Publish the script, and close the old links

**This is the step that stops the public access.**

1. **Deploy > Manage deployments.**
2. On the Web app ending in `...81Km/exec`: pencil icon, **Version: New version**, **Deploy**. Do not use **New deployment**, because that changes the link.
3. **Archive every other Web app entry.** Old entries keep running their old code, with no sign-in, and their links are in the Git history.

Check in a private window:

| Open | You should see |
|---|---|
| `.../exec?action=ping` | `"api":4` and no Sheet address |
| `.../exec?action=pull` | `"auth":true`, and no data |

## 7. Turn on the new site

Vercel publishes the site when the pull request is merged. Open it in a private window and sign in with Google.

## 8. Test before anyone receives email

Emails start in **test mode**: every email goes to the script owner, with the intended person in the subject.

1. Assign a task to a colleague's email from **New > Assign a task by email**.
2. Check the task in the Sheet, the email in the script owner's inbox, and the row in `NotificationLog`.
3. Sign in as that colleague, or ask them to. Move the task to Completed, and check that the Sheet changes.

To try the site on a preview first: add the preview address to the client ID's authorised origins, and in Vercel set `CT_API_URL` for Preview to a test copy of the script. Without `CT_API_URL`, a preview uses the real Sheet.

## 9. Go live

1. **Control Tower > Turn on daily backup, reminders and email retries.**
2. **Control Tower > Emails: go live**. Employees now receive emails. On the first morning, each person with overdue or nearly due work gets one summary.

## 10. Tidy up

- Make the GitHub repository private. Old passwords and project data are in its history.
- Delete old deployments in Vercel. They still serve the old pages.
- Remove `EMAIL_TEST_TO` from Script Properties if you set it.

## Rollback

| Problem | What to do |
|---|---|
| The site misbehaves | Vercel: **Deployments**, choose the previous one, **Promote to Production** |
| The script misbehaves | Apps Script: **Deploy > Manage deployments >** pencil icon, choose the previous version, **Deploy**. Older versions have no sign-in, so the data is public again until you redeploy this one |
| Someone is locked out | Add or correct them in the **Users** tab. It applies at their next sign-in |
| Nobody can sign in | Check the client ID (**Control Tower > Set Google sign-in client ID**) and the authorised origins |
| Last resort | **Control Tower > Emergency: open access for one hour**. Anyone with the link can read and change data until it ends by itself |
| Data looks wrong | Sheet: **File > Version history**, or your copy from step 2 |

The new columns can stay if you roll back: the older script reads the Sheet by position and ignores them.

## Settings

Script Properties are in Apps Script under **Project Settings**. None of them are secrets, and none are in the code.

| Setting | Where | Meaning |
|---|---|---|
| `AUTH_CLIENT_ID` | Script Properties, set from the menu | Google sign-in client ID |
| `AUTH_DOMAIN` | Script Properties | Allowed email domain. Default `suraasa.com` |
| `EMAIL_MODE` | Set from the menu | `live` sends to employees. Anything else is test mode |
| `EMAIL_TEST_TO` | Script Properties, optional | Where test mode sends. Default: the script owner |
| `ASSIGN_EMAIL` | Set from the menu | `off` stops all email |
| `SITE_URL` | Script Properties, optional | Address used in email links. Default: the production site |
| `CT_API_URL` | Vercel, optional | The script link used at build time. Default: the production link |

## Later releases

`npm test`, then `npm run test:e2e` (needs Playwright), then `node build.js`, then commit. If `apps-script/Code.gs` changed, repeat steps 4 and 6.
