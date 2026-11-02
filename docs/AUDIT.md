# Audit of the Control Tower

Done before any change, on the code in `main` (16fce14), the live site, and a read-only copy of the live Sheet (version 5). This covers deliverables 1 and 2 of the upgrade brief.

## What the application is

| Part | What it is |
|---|---|
| Front end | One HTML page of plain JavaScript and CSS, joined by `build.js`, hosted by Vercel from GitHub |
| Data | One Google Sheet |
| Back end | One Apps Script web app that reads and writes the Sheet |
| Sign-in | None |
| Live data | 20 projects, 125 tasks, 72 milestones, 12 risks, 12 dependencies, 11 open decisions, 0 weekly updates |

This stack was kept. Rule 2 of the brief forbids replacing it without need, and it costs nothing to run.

## Critical risks found

| # | Risk | What could happen | Status |
|---|---|---|---|
| 1 | The script in the repo was not the script that was deployed | Pasting the repo copy over the live one would have broken the save format and could have lost data | Fixed. The new `Code.gs` is built on the deployed source |
| 2 | Saves replaced whole tabs with last-write-wins | Two people saving close together: one silently loses their work | Fixed. Field-level conflict checks, append-only notes |
| 3 | No sign-in; the Sheet endpoint is open to anyone with the URL | Anyone with the link could read or change everything | Fixed in code, **switched off until you create a Google client ID** |
| 4 | About 117 KB of real projects, owners, risks and decisions were built into the public page | Readable through View Source, even with sign-in on | Fixed. The published page now holds no business data |
| 5 | A new browser showed built-in data for up to 60 seconds and could write it over the Sheet | Old data could overwrite new | Fixed. New browsers wait for the Sheet, and show an error if it cannot be reached |
| 6 | `ping` returned the Sheet's URL publicly | Exposes where the data lives | Fixed |
| 7 | Permissions were not enforced anywhere | Anyone could change anything | Fixed in code, active once sign-in is on |
| 8 | The audit trail lived in the browser | History was per device and could vanish | Fixed. `AuditLog` tab, written by the server, append-only |
| 9 | Deleting a project erased it | No recovery | Fixed. `Trash` tab and restore |
| 10 | No backups | One bad save could not be undone | Fixed. "Back up now" and a nightly copy (needs one click to turn on) |

## Other problems found

**Broken or misleading**
- Custom options lists were not stored in the Sheet, so they differed by browser.
- Project health came from a hand-set field in places and from rules in others.
- Progress was set by hand, with no check that it matched the work.
- Task owner, stakeholder and viewer were not separate ideas.
- People and options lists re-added built-in names on load.
- Names were hardcoded in defaults (`Head of Sales`, `Pending AK/Ankit decision`).

**Experience**
- Dense top navigation with many tabs; Home did not say what needed attention.
- Colours and type did not match suraasa.com (my earlier `#4666F6` and Plus Jakarta Sans were wrong).
- A text approximation stood in for the logo; favicon was missing.
- No task detail view, board, calendar, notifications or search over comments.

**Technical debt**
- `apps-script/Code.gs` in the repo had drifted from production.
- `src/smoke-test.js` tested a navigation that no longer exists.
- Files in `dist` are committed alongside source.
- Data in the Sheet still needs cleaning: `AI mock stimulator` (PRJ-001) has the objective "xyz", and Ankit Khanna appears 29 times. Nothing here was changed: those are your records.

## Existing and upgraded, side by side

| Capability | Before | Now |
|---|---|---|
| Sign-in | None | Google sign-in restricted to `@suraasa.com` and a Users list (off until set up) |
| Roles | None | Administrator, Project Owner, Task Owner, Viewer, enforced on the server |
| Saving | Whole Sheet, last write wins | Field by field, conflicts refused and explained, retry-safe |
| Audit trail | Local list | Append-only server log with who, what, before, after, when |
| Deletion | Permanent | Soft delete with restore |
| Task statuses | 6 | 10, with enforced transitions and required reasons |
| Task detail | Edit form | Side panel with update box, checklist, subtasks, dependencies, links, notes and activity |
| Task views | List | List, Board, Calendar, saved views, bulk edit |
| Progress | Typed by hand | Calculated from subtasks, then checklist, then a value with a required note |
| Project health | Mixed | Calculated, with reasons shown, configurable rules, separate owner assessment |
| Milestones | Status set by hand | Follow their tasks; cannot be completed with open tasks |
| Dependencies | Text notes | Finish-to-start links between tasks, loops refused, impact shown |
| Closure | Set status | Ready for Closure, then a formal close with a note |
| Archive | None | Archive and restore with history kept |
| Notifications | None | In-app, with reminders, preferences and grouping |
| Reports | CSV of raw tabs | Defined measures, date range, trend, portfolio table, project report, activity export |
| Search | Projects and tasks | Also subtasks, milestones, people and comments |
| Navigation | Top tabs | Sidebar on desktop, icon rail on small laptops and tablets, tab bar on phones |
| Brand | Approximate | Official logo, Inter, slate neutrals, `#225BA5`, favicon set |

Kept unchanged: Decisions and risks, Weekly review, Action plan, Who does what, How we work, CSV exports, the Timeline view and the Vercel URL. No feature was removed.
