# Architecture and data

Deliverables 3 and 4.

## How it fits together

```
Browser (one static page from Vercel)
  src/engine.js   the rules: lifecycle, progress, health, notifications
  src/app.js      screens, permissions shown to the user, sync
        |  HTTPS, JSON
Apps Script web app (apps-script/Code.gs)
  sign-in, permissions, validation, merge, audit       <- the rules that count
        |
Google Sheet
  Projects Tasks Workstreams Milestones Risks Dependencies Decisions ...
  Users AuditLog Trash Snapshots NotificationLog _Meta
```

The page has no business data of its own. It loads from the Sheet, keeps a working copy in the browser, and sends only what changed. `src/seed.js` is used by the tests and is stripped from the published page by `build.js`.

## How a save works

1. The browser keeps a **base** snapshot: the last version it got from the Sheet.
2. On a change it compares the working copy with the base, field by field.
3. It sends operations: `{c, id, set: {field: new}, base: {field: old}}`.
4. The server takes a lock, re-reads the Sheet, and for each field compares `base` with what is there now.
5. If someone else changed that field, the whole save is refused and the person is shown the current value. Notes and comments are merged instead, so both are kept.
6. Saves are all-or-nothing, and each carries a `requestId`, so a retry after a dropped connection does not apply twice.
7. The audit rows are written in the same locked step.
8. Each save raises the Sheet's version. Other browsers check this and refresh. Unsent changes are re-applied on top, except where someone else changed the same field: the newer value wins and the person is told.

Pending work is stored in the browser, so it survives a refresh or a dropped connection.

## Sign-in

Google sign-in is the only way in. The page holds no people, no passwords and no keys.

Google Identity Services gives the page an ID token. Apps Script checks it with Google (`oauth2.googleapis.com/tokeninfo`): audience, issuer, verified email, domain, expiry, then the Users tab. It then issues a random session ID, stored in Apps Script's cache. Every read and write after that carries the session, and the person's role is read fresh from the Users tab each time.

A session ends after 6 hours without use, 12 hours after sign-in at the latest, on sign-out (which removes it on the server), or when the person is deactivated.

Sign-in is required unless `AUTH_REQUIRED` is `false` **and** `AUTH_OFF_UNTIL` is in the future. The menu's emergency switch sets both, for one hour. So a missing or old setting can never leave the data open.

## Assigning a task

`assign` in `Code.gs` takes one confirmed task:

1. Checks the role, the fields, the project and that the person may manage it.
2. Finds the employee by exact email. An unknown or inactive address is refused.
3. Picks the next `T-` number, never reusing the number of a deleted task.
4. Saves through the same `apply_` step as every other change, so permissions, audit and conflict rules all apply.
5. Queues the notifications, tries to send them, and returns what actually happened.

The `requestId` is stored on the task as `assignKey`. Sending the same confirmation again returns the same task, even after the 10-minute replay memory has gone.

When any save changes `owner` or `ownerEmail`, the server works out the other one. An email must belong to a registered, active person. A name is matched to an email only if exactly one person has that name.

## Notifications

Every email is first written to `NotificationLog` as `queued`, in the same step as the save, and then sent. So a mail failure cannot lose an email, and it cannot stop a save.

| Status | Meaning |
|---|---|
| `queued` | Waiting to be sent |
| `accepted` | Google's mail service took it. **This does not prove it reached the inbox.** Apps Script cannot see that |
| `failed` | Not sent. Retried after 5 minutes, 15 minutes, 1 hour, then 6 hours |
| `abandoned` | Failed 5 times. A Super Admin can restart it |
| `skipped` | Emails were turned off |
| `created` | An in-app notification, on the `in-app` channel |

`dedupeKey` stops the same notice going twice. `batchId` groups one person's notices from one save, or one day's reminders, into one email.

**Test mode** is the default. Until someone chooses **Emails: go live**, every email goes to the script owner.

## Database changes

All changes add to the Sheet. Nothing is dropped or renamed, and `setupSheet` is safe to rerun: columns someone added by hand are kept, and move to the right when new columns arrive. `_extra` (a JSON column that already existed) holds new record fields, so no existing column moves.

**New tabs**

| Tab | Columns |
|---|---|
| Users | email, name, role, active, addedBy, addedAt, employeeId, department, designation, managerEmail, joiningDate, updatedAt. Read by column name, so hand-added columns are safe |
| NotificationLog | notificationId, ts, channel, eventType, recipientEmail, recipientName, taskId, projectId, subject, deliveryStatus, attempts, lastAttemptAt, nextAttemptAt, errorDetails, dedupeKey, batchId, actorEmail, actorName, requestId, payload |
| AuditLog | activityId, ts, actorEmail, actorName, entityType, entityId, projectId, taskId, action, field, oldValue, newValue, text, requestId |
| Trash | trashId, ts, actorName, collection, recordId, record, restoredAt, record2, record3, record4 (long records span these) |
| Snapshots | date, projectId, progress, done, active, overdue, blocked, health |

**New fields, stored in `_extra`**

| On | Field | Meaning |
|---|---|---|
| Task | `notes` | List of `{id, type, text, author, ts}`. Types: update, comment, question, decision, blocker, extension |
| Task | `checklist` | List of `{text, done}` |
| Task | `blocker` | `{text, owner, ts}` |
| Task | `cancelReason` | Required to cancel |
| Task | `dependsOn` | IDs of tasks this one waits for |
| Task | `weight` | Weight in progress. Default 1 |
| Task | `collaborators` | Other people on the task |
| Task | `requiresReview` | Must pass review to complete |
| Task | `extensionRequest` | `{to, from, reason, by, ts}` while waiting for a decision |
| Task | `originalDue` | First due date, never overwritten |
| Task | `completedAt`, `latestUpdate`, `attachments`, `actualEffort` | As named |
| Task, Project | `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | Set by the server |
| Project | `originalDue`, `archivedAt`, `archivedBy`, `restricted`, `members`, `closure`, `manualRisk`, `attachments` | As named |
| Milestone | `autoCompleted` | Completed by its tasks, not by hand |

**New columns, to the right of `_extra`**

| Tab | Columns |
|---|---|
| Tasks | ownerEmail, assignedBy, assignedByEmail, assignedAt |
| Projects | ownerEmail, accountableEmail |

They sit after `_extra` so every older column stays where it is. An older script can still read the Sheet, which keeps the upgrade reversible.

**Also new, in `_extra`:** `assignKey` on tasks, `managerEmails` on projects.

**Script Properties:** see [DEPLOYMENT.md](DEPLOYMENT.md).

**Data migration:** none is needed. Records without the new fields work, and `originalDue` is filled in the next time a record is saved. Timestamps are UTC ISO 8601.

## Integrity

A Sheet is not a database. In place of foreign keys and transactions, the server uses a script lock, validates every change before writing, and refuses a whole save if one part fails. Checks include: a task's project and parent must exist and match, dependencies must exist and not loop, dates must be valid, IDs cannot be reused or changed, a record must fit in a cell, and a tab's columns must be where the server expects. A save that deletes more than 25 records is refused. Details are in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

## Visual design and logo

Deliverables 11 and 12.

`brand.suraasa.com` lists Colors and Typography as "Coming Soon", so these were taken from suraasa.com: **Inter**, the **Tailwind slate** neutral scale, brand blue **`#225BA5`**, and dark **slate-900** primary buttons with white text. The dark theme's blue is `#7FB0EE`, for contrast. Chart ramps pass the palette validator in both themes.

Logos are the official files from the brand portal, in `assets/logo/`, shown at their own proportions on the sidebar, phone header and sign-in screen, with the dark-background version in dark theme. `assets/public/` holds `favicon.ico` (from suraasa.com), 16 and 32 px PNGs, the Apple touch icon, 192 and 512 px app icons and the web manifest. All are copied to the site root.
