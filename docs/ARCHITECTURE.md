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
  Users AuditLog Trash Snapshots _Meta
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

There are two ways in. While Google sign-in is off, the page shows an email and password screen, checks one-way keys held in the page, and limits an employee's view itself (`limitToPerson` in `src/app.js`). When Google sign-in is on, the steps below replace it and the server applies the rules.

Google Identity Services gives the page an ID token. Apps Script checks it with Google (`oauth2.googleapis.com/tokeninfo`): audience, verified email, domain, expiry, then the Users tab. It then issues a session ID stored in Apps Script's cache for 6 hours. Every read and write after that carries the session.

## Database changes

All changes add to the Sheet. Nothing is dropped or renamed, and `setupSheet` is safe to rerun: columns someone added by hand are kept, and move to the right if the header needs repair. `_extra` (a JSON column that already existed) holds new record fields, so no existing column moves.

**New tabs**

| Tab | Columns |
|---|---|
| Users | email, name, role, active, addedBy, addedAt |
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

**Script Properties:** `AUTH_REQUIRED`, `AUTH_CLIENT_ID`, `AUTH_DOMAIN`.

**Data migration:** none is needed. Records without the new fields work, and `originalDue` is filled in the next time a record is saved. Timestamps are UTC ISO 8601.

## Integrity

A Sheet is not a database. In place of foreign keys and transactions, the server uses a script lock, validates every change before writing, and refuses a whole save if one part fails. Checks include: a task's project and parent must exist and match, dependencies must exist and not loop, dates must be valid, IDs cannot be reused or changed, a record must fit in a cell, and a tab's columns must be where the server expects. A save that deletes more than 25 records is refused. Details are in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

## Visual design and logo

Deliverables 11 and 12.

`brand.suraasa.com` lists Colors and Typography as "Coming Soon", so these were taken from suraasa.com: **Inter**, the **Tailwind slate** neutral scale, brand blue **`#225BA5`**, and dark **slate-900** primary buttons with white text. The dark theme's blue is `#7FB0EE`, for contrast. Chart ramps pass the palette validator in both themes.

Logos are the official files from the brand portal, in `assets/logo/`, shown at their own proportions on the sidebar, phone header and sign-in screen, with the dark-background version in dark theme. `assets/public/` holds `favicon.ico` (from suraasa.com), 16 and 32 px PNGs, the Apple touch icon, 192 and 512 px app icons and the web manifest. All are copied to the site root.
