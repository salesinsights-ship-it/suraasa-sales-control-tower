# Known issues and limitations

Deliverable 14.

## What is still needed from you

| Item | Why it needs you | Until then |
|---|---|---|
| Publish the site and update the Apps Script | I have no access to your Google account or GitHub | Assignment emails, the audit log, Trash and field-level saving wait for the new script |
| Create a Google OAuth client ID | It must be made in your Google Cloud account | **The sign-in on the page does not protect the data. Anyone with the Apps Script link can read and change it, and roles are enforced only on the page** |
| Add people to the Users tab | Only you know who holds which role | Nobody can sign in once sign-in is on |
| Turn on daily backup | One click in the Sheet menu | No automatic backups or overdue events |

## Not tested on the real systems

Everything was tested in a real browser against the real `Code.gs`, on a simulated copy of Google Sheets loaded with a copy of your live data. **Nothing has run on real Google Apps Script, on real Google sign-in, or against your real Sheet.** Follow the checks in [DEPLOYMENT.md](DEPLOYMENT.md) after deploying. Real Sheets will also be slower: expect a second or more per save.

## Limits of the design

- **A Sheet is not a database.** There are no foreign keys or database transactions. A script lock and server checks do that job. A failure partway through a write (Google outage, 6-minute script limit) can leave a save half-applied. What was written is logged and a retry finishes it, but backups remain the safety net.
- **Scale.** Comfortable at the current size. Each save re-reads the data, so expect it to slow at several thousand tasks. Apps Script also has daily quotas.
- **Direct Sheet edits bypass validation.** They are logged as `sheet_edit`, with no user name on some account types, and without the status and permission rules. Limit who can edit the Sheet.
- **The Sheet endpoint is still public in the network sense.** With sign-in on it returns nothing without a session. With sign-in off it is open, as it is today.
- **Files are links.** Tasks and projects hold Google Drive links. Direct upload is not built.
- **Notifications are in-app only.** No email or chat, as the brief asked for in-app first. You see them when you open the site. Read state and preferences are per browser, so they do not follow you between devices.
- **Saved views are per browser** for the same reason.
- **A record has a size limit.** A task's notes share one 50,000-character cell, roughly 250 typical notes. Past that, saves to that task are refused with a clear message.
- **Import is for an empty Sheet only.** To recover live data, use the Sheet's version history or a backup copy.
- **A renumbered record.** If two people create a record with the same ID at once, the second is given the next number. Links from other unsaved records to the old number would need correcting.
- **Unsaved edits on one device** stay on that device until it reconnects.
- **Sessions last 6 hours.** After that you sign in again; unsent changes stay in the browser.
- **A shared computer:** signing out clears the local copy. Closing the tab does not.
- **Trends and "time to finish" start at deployment.** Past data was not recorded.
- **Dependency links are finish-to-start between tasks.** There are no lead or lag times, and dates are never moved automatically.
- **Roles can be assigned but their rules cannot be edited on screen.** Changing what a role may do means editing `deny_` in `Code.gs`.
- **People are matched by name.** A task owner is linked to their account by the exact name in the Users tab. If someone is `Sales Operations` on a task and `Priya` in Users, they will not have rights to that task until the owner field or the name is corrected. This matters here: **112 of 125 tasks have no confirmed owner yet**.
- **Live cost of a pull.** The site re-reads the whole dataset when the version changes.
- **Accessibility.** Keyboard use and contrast were checked as part of the work, but no screen reader test was done.

## Sign-in on the page

- It decides what each person sees. It is not security: the check runs in the browser, and the team list is in the page.
- The 12 passwords were public in earlier versions and are still in Git history, so treat them as exposed.
- The first-name-and-2026 rule and the shared password still work, so nobody was locked out. Both are guessable. Google sign-in replaces them.
- A new team member needs a code change until Google sign-in is on.

## Assignment emails

- Emails come from the Google account that deployed the script, with the name Suraasa Control Tower. Replies go to the person who assigned the work.
- While sign-in is off, the script takes the sender's name from the website and cannot verify it. Turn sign-in on to prove who assigned what.
- Owners are matched by name. A name that is not in the Users tab gets no email; `AuditLog` records it as `email_skipped`.
- Google limits daily email: about 1,500 for Workspace accounts and 100 for personal ones. Past that, saves still work and `AuditLog` records `email_failed`.
- Only a change of `owner` sends an email. Being named as accountable does not.

## Data and repository

- `AI mock stimulator` (PRJ-001, objective "xyz") looks like a test record. It is still there.
- **`src/seed.js` still contains the original project data, and so does Git history.** The published page no longer does. If the GitHub repo is public, make it private.
- The old site remains in Vercel's deployment history until you delete those deployments.
