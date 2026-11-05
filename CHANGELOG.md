# Changelog

## 3.0.0, 5 November 2026

**Assigning work**
- **New > Assign a task by email**: enter the employee's official email, see who it is, check the preview and confirm. The task is saved to the Sheet with a new ID, the employee is emailed, and it appears on their dashboard.
- **Assign in one line** on Home reads a sentence into the same preview. It never guesses a person or project.
- **Reassign** on a task, by email.
- Tasks and projects now store the owner's registered email. Only the exact email counts. Older tasks keep working by name, and **Match task owners to registered emails** fills in the rest.
- Project **Managers** list: name extra managers by email.

**Notifications**
- Emails for assignment, reassignment, project assignment, deadline reminders, overdue work, completion, manager comments and review requests.
- New `NotificationLog` tab, with status, attempts and errors. **Accepted** means Google took the email, not that it arrived.
- Failed emails retry by themselves. Duplicates are prevented. Super Admins can retry and resend.
- **Emails start in test mode**: nobody but the script owner receives them until you go live.

**Security**
- **The script no longer serves anything without a Google sign-in.** It closes by default, and the emergency switch ends by itself after an hour.
- Removed the password check in the page, the team list and the password keys. A frontend check is not authentication.
- Sign out now ends the session on the server. Sessions end after 6 hours idle or 12 hours in total.
- Roles are named Super Admin, Manager, Employee and Viewer. Existing words in the Users tab still work.
- One person's request ID can no longer fetch another person's reply.
- A person's name no longer gives rights to a task owned by someone else's email.
- The site adds security headers, and no longer lets the server link be changed in the browser.
- The site will not talk to an older script.

**Screens**
- **Administration > Employees**: IDs, departments, designations, managers, status and search.
- **Administration > Integrations**: the state of the Sheet, email, sign-in and automation, with no secrets shown.
- **Administration > Notification log**, also under **Notifications > Email log** for Managers.
- Home: assigned, overdue and completion rate, tasks by stage and priority, project progress, completions per week, employee workload, upcoming deadlines, and a project filter.
- Employee dashboard: overdue count and upcoming deadlines.
- Links in emails open the task directly, after sign-in.

**Reconnected**
- The site saves to the Sheet again. It had been disconnected on 4 November, because the script running was too old for it.

**Removed**
- Page password sign-in, the connection settings box, and the whole-Sheet save used by older scripts.
- `tests/e2e/login.js`, which tested the removed sign-in.

## 2.5.1, 4 November 2026

- Management can open the Google Sheet from the sidebar, the profile menu, the phone More menu and **Administration > Sheet and data**. It opens in a new tab.

## 2.5.0, 4 November 2026

**Saving**
- The site now uses the working Web app link, so saving works with the script in use today and with the new one.
- Browsers holding a link that asks for Google sign-in move to the working link on their next visit.

**Sign-in**
- The email and password screen is back, for people who use the site without Google sign-in. Existing passwords still work.
- The page holds one-way keys instead of readable passwords.
- Management and employee views depend on who signs in, and an employee's save no longer touches rows they cannot see.
- Removed Sign Up and password reset. Accounts made there worked in one browser only, and Sign Up gave management access to anyone using a management email.

**Files**
- Removed `server.js` and `dist.zip`, which held readable passwords.
- Rewrote `SETUP_GOOGLE_SHEET.md`, which described tabs and steps that no longer exist, and corrected `README.md` and `SETUP_SIGN_IN.md`.

## 2.4.0, 4 November 2026

**Assignment emails**
- When a management user gives someone a task or project, that person gets an email saying what it is and who assigned it. Replies go to the person who assigned it.
- One email per person per save, however many items. Nothing is sent to someone for assigning themselves, or for a retried save.
- Names in brackets in the Users tab count as other names: `Manish Pandey (Head of Sales)` receives tasks owned by `Head of Sales`.
- Every email is recorded in `AuditLog` as sent, failed or skipped. An email problem never stops a save.
- New Control Tower menu items: send a test email, turn assignment emails on or off.

**AK is Ankit Khanna**
- New menu item **Replace AK with Ankit Khanna** merges the two names across the data, keeps one Roles row, and records every old value in `AuditLog`. It sends no emails and is safe to run twice.
- The decision status is now `Pending Ankit Khanna decision`.

## 2.3.0, 3 November 2026

**Security**
- Removed the password sign-in. It ran only in the browser, and it held 12 staff passwords in plain text in the page and the repository.
- Removed sign-up, password reset, the shared password, the name-and-year password pattern, the hardcoded management email list, and the local server that held the same passwords.
- Roles now come only from the server. Nothing in browser storage can grant access.
- Sign-in is Google only, checked on the server against the Users tab. It starts once it is turned on in the Sheet.
- Employees receive only their own tasks from the server, not just on screen.
- An expired session now returns to the sign-in screen. Before, the page silently stopped loading.

**Second review**
- A task's priority could carry script into other people's pages. It is now checked on the server and made safe on the page.
- A refused save could reveal another task's details in its error. Permission is now checked first.
- Employees received full details of projects they have no tasks in, and could comment on them. They now get only the project's name.
- Employees could write progress history from their partial view. They no longer can.

**Fixed**
- The bin icon on task rows did nothing.
- Employee home listed every task as theirs. It now shows only their own.
- Total tasks counted completed tasks twice.
- Total Employees counted "AK, Divya, Atishay" as one person, and teams and proposed roles as people.
- Employees saw Start and Complete on other people's tasks, and New offered things they could not do.
- The profile window's Close buttons did nothing. Profile is now read-only, because a name links a person to their tasks.
- A first load with the Sheet unreachable now shows an error. Before, the failure was hidden.
- Dropping a task again now asks for a new reason.
- Employees could not save a new task, because its number clashed with tasks they cannot see.
- The Employee filter on the management home did nothing, and matched names loosely when it did.
- Completion rate counted completed tasks twice.
- A returning person with the Sheet unreachable got a blank page.
- Employees saw extra pages in the phone menu.
- Undo after a delete could bring back old versions of other tasks.
- A failed connection check could stop saves until the page was reloaded.
- Clearing a block in the edit form left the old blocker behind.


## 2.0.0, 2 November 2026

Upgrade from a shared tracker to an execution platform, on the same stack and URL.

**Reliability**
- Saves are field by field, with conflict detection, retry safety and all-or-nothing batches. Replaces whole-tab overwrites.
- Notes and comments from two people are merged, never overwritten.
- New browsers wait for the Sheet and no longer risk writing old data over it.
- Whole-sheet push refuses to remove more than half of the projects without force.
- Backups: on demand and nightly. Soft delete with restore.
- The repo's `Code.gs` now matches production. It was rebuilt on the deployed source.

**Independent review**
- 13 confirmed problems found before release, all fixed and tested. See `docs/TEST_RESULTS.md`.

**Security**
- Google sign-in, limited to the domain and the Users list, with server-side sessions.
- Server-side roles: Administrator, Project Owner, Task Owner, Viewer.
- Restricted projects are removed from responses, not just hidden.
- The published page no longer contains business data.
- `ping` no longer reveals the Sheet's URL. Links are checked before display.
- Signing out clears the browser's copy.

**Workflow**
- 10-state lifecycle with enforced transitions and required reasons.
- Task panel: update box, checklist, subtasks, dependencies, links, typed notes, activity.
- Review flow; ask for more time; questions to the project owner.
- Calculated progress for tasks, milestones and projects.
- Calculated health with reasons, configurable rules, and a separate owner assessment.
- Milestones follow their tasks, on the server, whoever finishes the work.
- Finish-to-start dependencies, with loops refused and impact shown.
- Ready for Closure and formal close. Archive and restore.
- Append-only audit log. Timelines on tasks and projects.
- In-app notifications with reminders, grouping and preferences.
- `dailyChecks` records overdue tasks and milestones once each.

**Screens**
- Role-aware sidebar, icon rail on small laptops and tablets, tab bar on phones.
- Task owner Home ("My work"), My Tasks and My Projects.
- List, Board and Calendar views; saved views; bulk edit with reasons and confirmation.
- Reports with defined measures, date range, trend, portfolio table, project report and activity export.
- Administration: users, audit log, deleted items, health rules, Sheet and data.
- Wider search; breadcrumbs; loading state; a clear error when the Sheet cannot be reached.

**Brand**
- Official logos, favicon set, app icons and manifest.
- Inter, slate neutrals and `#225BA5`, replacing `#4666F6` and Plus Jakarta Sans.

**Removed**
- `src/smoke-test.js`, replaced by `tests/e2e`. It tested navigation that no longer exists.
- Hardcoded names in defaults.

No features were removed.
