# Changelog

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
