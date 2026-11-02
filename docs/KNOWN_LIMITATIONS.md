# Known issues and limitations

Deliverable 14.

## What is still needed from you

| Item | Why it needs you | Until then |
|---|---|---|
| Update the Apps Script and site | I have no access to your Google account or GitHub | The live site is unchanged |
| Create a Google OAuth client ID | It must be made in your Google Cloud account | **Sign-in is off. Anyone with the link can read and change data, and roles are not enforced** |
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

## Data and repository

- `AI mock stimulator` (PRJ-001, objective "xyz") looks like a test record. It is still there.
- Ankit Khanna appears 29 times in the data, and `Pending AK/Ankit decision` may still be in the Sheet's options. Nothing was changed: these are your records.
- **`src/seed.js` still contains the original project data, and so does Git history.** The published page no longer does. If the GitHub repo is public, make it private.
- The old site remains in Vercel's deployment history until you delete those deployments.
