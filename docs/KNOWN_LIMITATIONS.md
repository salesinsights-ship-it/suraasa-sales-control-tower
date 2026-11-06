# Known issues and limitations

Deliverable 14.

## What is still needed from you

See [DEPLOYMENT.md](DEPLOYMENT.md) and [CREDENTIALS.md](CREDENTIALS.md). In short: publish the branch, update the script in the account that owns the Sheet, create a Google client ID, add your people, and go live.

## Not tested on the real systems

Everything was tested in a real browser against the real `Code.gs`, on a simulated copy of Google Sheets loaded with a read-only copy of your live data. **Nothing has run on real Apps Script, real Google sign-in, real email or your real Sheet.** `tests/mock-gas.js` catches logic errors, but cannot prove how Google's services behave. Step 8 of [DEPLOYMENT.md](DEPLOYMENT.md) covers that gap. Real Sheets are also slower: expect a second or more per save.

## Limits of the design

- **A Sheet is not a database.** There are no foreign keys or database transactions. A script lock and server checks do that job. A failure partway through a write (Google outage, 6-minute script limit) can leave a save half-applied. What was written is logged and a retry finishes it, but backups remain the safety net.
- **Cache TTL and direct Sheet edits:** The server state cache TTL is set to 3 minutes (180 seconds). When a save is applied from the site, the backend inspects the target row live in the Sheet. If the row was deleted directly in the Sheet by hand, the save is rejected as missing rather than resurrecting the row. If the row was edited by hand in the Sheet, field-level conflicts are caught and non-conflicting hand edits are preserved. Shifted or sorted rows are safely re-indexed by scanning the Sheet.
- **API Version 6 synchronization:** The Apps Script backend reports API 6 and the website frontend requires API 6 (`API_NEEDED = 6`). Deployments must publish the Apps Script backend first as a new version, followed by deploying the website.
- **Shared workstation unsaved work protection:** Unsaved changes in the browser are gated on confirmed server identity. If a user logs into a browser that previously held unsaved work under a different account, that unsaved work is not transmitted under the new user's name. It is archived safely into `sct_browser_copy` for manual download from the UI, and the user is alerted.
- **Search engine anti-indexing:** The application includes `<meta name="robots" content="noindex, nofollow">` in the HTML shell, as well as `X-Robots-Tag: noindex, nofollow` and `Permissions-Policy` headers in `vercel.json` to prevent search engine indexing.
- **Employee directory integration for project team members:** Project team members can be selected via a datalist connected to the verified employee directory while maintaining compatibility with custom or external free-text member entries.
- **Timing and diagnostics:** Diagnostic timing benchmarks are strictly gated behind `ENABLE_TIMING === 'true'` in script properties or signed-in Super Admin roles. URL query parameters (`?timing=1`) cannot enable timing telemetry for public or unauthenticated visitors.
- **Scale.** Comfortable at the current size. Each save re-reads the data, so expect it to slow at several thousand tasks. Apps Script also has daily quotas.
- **Direct Sheet edits bypass validation.** They are logged as `sheet_edit`, with no user name on some account types, and without the status and permission rules. Limit who can edit the Sheet.
- **The script address is public in the network sense.** It returns nothing but its version without a session. Older deployments are the exception, which is why step 6 of the deployment archives them.
- **"Accepted" is not "delivered".** Apps Script can see that Google's mail service took an email, not whether it reached the inbox or bounced. A bounce arrives as an email in the script owner's inbox.
- **Viewers and Managers read widely.** They see tasks on every project that is not restricted. Use a restricted project to limit that. Employees see only their own tasks.
- **The site keeps a working copy in the browser.** It is cleared on sign-out, not when a session expires, so use Sign out on shared computers.
- **Uploads have not run on real Google Drive.** They use the Sheet owner's Drive, in a folder called Control Tower Uploads, and are shared with your organisation by link. Files can be up to 10 MB. PDF, Word, Excel and PowerPoint (`.docx`, `.xlsx`, `.pptx`), CSV, text and image files are accepted. The older `.doc`, `.xls` and `.ppt` are refused, because they can hide macros. A file on a restricted project is still open to anyone in the organisation who has its link.
- **In-app read state is per browser,** so it does not follow you between devices.
- **Google warns its token check can be throttled.** It is fine for a team this size. The cost of replacing it is hand-written signature checks that cannot be tested off real Apps Script.
- **Sign-in is limited to 10 attempts a minute per person.** Someone who knows an employee's email could hold up that one person's sign-in, not anyone else's, and could not reach any data. Existing sessions are unaffected.
- **A former owner of a task sees only that it moved on.** Someone who shares a name with another employee is not told, because names cannot be matched safely.
- **Passwords are weaker than Sign in with Google.** You chose them to avoid Google Cloud. They can be shared, guessed or reused, and there is no second step. Use long, unique ones.
- **Anyone who knows an email can lock that person out for 15 minutes,** by getting the password wrong five times. A Super Admin reset ends the lock.
- **Someone trying six wrong passwords can tell whether an email is registered,** because only real accounts lock.
- **Editing the `Users` tab by hand does not delete a password.** Marking someone inactive there blocks them at once, but use the site to remove their password as well.
- **Whoever controls the Google account that owns the script can reset anyone's password,** and can read the password hashes. The team shares that account, so keep it secure.
- **Password hashing is limited by Apps Script.** It has no purpose-built password function, so the hash is 500 rounds of HMAC-SHA256 with a secret kept in Script Properties.
- **Password sign-in has not run on real Apps Script.** Check that a sign-in takes only a few seconds.
- **Sheet edits reach open pages within about 5 seconds, not instantly.** Each open page asks Google every 5 seconds, because a Sheet cannot push to a website. A tab in the background waits until it is looked at.
- **Rows added or removed by hand need one setting.** Without **Turn on instant updates to the website**, they appear only after the next ordinary edit.
- **Rate limiting covers sign-in only.** Everything else needs a session, and Google applies its own quotas.
- **AuditLog is protected with a warning, not a lock.** The site cannot edit it, and direct edits to it are logged. Anyone with edit access to the Sheet could still ignore the warning, so limit that access.
- **Profiles are read-only for employees.** A Super Admin or their Manager keeps them up to date. Pictures come from their Google account at sign-in.
- **Saved views are per browser** for the same reason.
- **A record has a size limit.** A task's notes share one 50,000-character cell, roughly 250 typical notes. Past that, saves to that task are refused with a clear message.
- **Import is for an empty Sheet only.** To recover live data, use the Sheet's version history or a backup copy.
- **A renumbered record.** If two people create a record with the same ID at once, the second is given the next number. Links from other unsaved records to the old number would need correcting.
- **Unsaved edits on one device** stay on that device until it reconnects.
- **Sessions end** after 6 hours without use and 12 hours after sign-in at the latest. Unsent changes stay in the browser. Apps Script's cache can also drop a session early, in which case you just sign in again.
- **A shared computer:** signing out clears the local copy. Closing the tab does not.
- **Trends and "time to finish" start at deployment.** Past data was not recorded.
- **Dependency links are finish-to-start between tasks.** There are no lead or lag times, and dates are never moved automatically.
- **Roles can be assigned but their rules cannot be edited on screen.** Changing what a role may do means editing `deny_` in `Code.gs`.
- **Older tasks may still be matched by name.** New and reassigned tasks use the email. Older ones get it from **Match task owners to registered emails**, which only matches a name that exactly one person has. This matters here: **113 of 129 tasks have no confirmed owner yet**, and those can only be managed by a Super Admin until they are assigned.
- **The one-line command is rule-based, not AI.** It costs nothing and needs no API key, and it reads the usual ways of writing a task. Unusual wording leaves fields blank for you to fill in; it never guesses.
- **Live cost of a pull.** The site re-reads the whole dataset when the version changes.
- **Accessibility.** Keyboard use and contrast were checked as part of the work, but no screen reader test was done.

## Emails

- Emails come from the Google account that deployed the script, with the name Suraasa Control Tower. Replies go to the person who took the action.
- Google limits daily email: about 1,500 for Workspace accounts and 100 for personal ones. Past that, saves still work, and the email waits and retries.
- A person who is not in the Users tab gets no email. `AuditLog` records it as `email_skipped`.
- Being named as answerable does not send an assignment email.

## Data and repository

- `AI mock stimulator` (PRJ-001, objective "xyz") looks like a test record. It is still there.
- **`src/seed.js` still contains the original project data, and Git history holds it along with the old passwords.** The published page holds none of this. The repository is public: make it private. Those passwords no longer open anything.
- The old site remains in Vercel's deployment history until you delete those deployments. Those pages hold names, emails and password keys.
- Browser-only use since 4 November may have left work in individual browsers. The first sign-in keeps a copy, which can be downloaded under **Administration > Sheet and data**.
