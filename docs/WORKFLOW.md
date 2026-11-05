# Workflow rules

Deliverables 6 to 10.

## Task lifecycle

| From | Can move to |
|---|---|
| Backlog | Not Started, In Progress, Cancelled |
| Not Started | Backlog, In Progress, Blocked, On Hold, Completed, Cancelled |
| In Progress | Not Started, Blocked, On Hold, In Review, Completed, Cancelled |
| Blocked | Not Started, In Progress, On Hold, Cancelled |
| On Hold | Not Started, In Progress, Blocked, Cancelled |
| In Review | In Progress, Changes Requested, Completed, Cancelled |
| Awaiting Approval | In Progress, In Review, Changes Requested, Completed, Cancelled |
| Changes Requested | In Progress, In Review, Blocked, Cancelled |
| Completed | In Progress, Not Started, In Review, Awaiting Approval (reopen and undo) |
| Cancelled | Not Started |

`On Hold` and `Awaiting Approval` were already in use and were kept.

Rules: Cancelled needs a reason. Blocked needs a description. A task marked `requiresReview` must pass through review, and its owner cannot approve it. Moves that are not listed are refused by the server. Each change writes an audit row with the old value, new value, who and when.

Status (where the work is) is separate from health (whether it is going well).

## Progress

**Task completion %**, first match wins:
1. Completed: 100. Cancelled: 0.
2. Has active subtasks: weighted average of the subtasks.
3. Has a checklist: done items ÷ all items.
4. Otherwise: the value set by hand. A note is required, the range is 0 to 100.

A task cannot reach 100% until it is Completed. It stops at 99.

**Project progress** = sum of (task weight × task completion) ÷ sum of task weights.

Counted: top-level tasks. Left out: cancelled tasks, recurring tasks and archived projects. Subtasks count through their parent. Weight defaults to 1.

**Milestone progress** uses the same formula on the milestone's tasks. A milestone completes itself when its last task does, and returns to In Progress if a task reopens, unless it was completed by hand. It cannot be marked complete by hand while tasks are open.

**Closure:** when every active task is done, the project shows "Ready for closure" and its owner is notified. It closes only when the owner does so with a closing note. A project with open tasks cannot be closed.

**History:** one snapshot per project per day in the Snapshots tab, drawn as the trend in Reports. It starts on the day this version goes live, because earlier history was not recorded.

## Health

Checked in this order; the first that applies wins, and every reason is shown.

| Health | When |
|---|---|
| Completed | The project is closed |
| Blocked | Project status is Blocked, or a P0 task is blocked |
| Delayed | A milestone is overdue, a dependency is past its needed-by date, a P0 or P1 task is overdue, or at least 2 tasks and 25% of open tasks are overdue |
| Not started | Nothing has begun and nothing is overdue |
| At risk | Any task overdue or blocked; a milestone due within 7 days under 50%; a P0 or P1 task due within 7 days under 50%; an open dependency due within 14 days; no weekly update; no update for 14 days; no progress in 14 days; no confirmed answerable person; on hold |
| On track | None of the above |

The 25%, 10%, 7 and 14 values can be changed in Administration, Health rules. One late low-priority task can make a project At risk, never Delayed.

A project owner can add a **risk assessment** with a level and a reason. It sits beside the calculated health and never replaces it.

## Activity and audit log

`AuditLog` is written by the server in the same step as the change. Rows are only ever appended. Deleting a task or project leaves its rows in place. Each row has: activity ID, entity type and ID, parent project and task IDs, action, field, old value, new value, description, user email, user name at the time, UTC timestamp and request ID.

**Actions:** `created`, `updated`, `deleted`, `restored`, `status_changed`, `owner_changed`, `deadline_changed`, `progress_changed`, `priority_changed`, `blocker_changed`, `dependency_changed`, `archive_changed`, `milestone_added`, `milestone_changed`, `milestone_removed`, `update_added`, `comment_added`, `question_added`, `decision_added`, `blocker_added`, `extension_added` and their `_edited` and `_removed` forms (which keep the old text), `task_assigned`, `task_overdue`, `milestone_overdue`, `email_sent` (accepted by the mail service), `email_failed`, `email_skipped`, `notification_error`, `owner_email_matched`, `settings_changed`, `user_changed`, `user_removed`, `sheet_edit` (someone typed directly in the Sheet).

Notes are typed, and each keeps its author and time. Edited comments show "edited".

Timelines on project and task pages filter by All, Status, Progress, Ownership, Comments, Deadline and System, and load more on demand. Administrators can search the whole log.

**Limits:** the site loads the latest 600 rows. The full log stays in the Sheet. Someone with edit access to the Sheet could still change rows by hand, so restrict that access; such edits to data tabs are themselves logged as `sheet_edit`.

## Notifications

**In-app** notifications are worked out from the data and the audit log. Each has a stable ID, so reloading never repeats it. Read state and preferences are kept per browser. Every assignment also leaves an `in-app` row in `NotificationLog`.

| Kind | Sent to | When |
|---|---|---|
| Due soon, tomorrow, today | Task owner | 3 days, 1 day, due date |
| Overdue | Task owner | Daily while late. More than 5 become one line |
| Waiting on a late task | Task owner | A task it depends on is late |
| Assigned, Reassigned | Old and new owner | Owner changes, or a new task is assigned |
| Deadline changed | Task owner | Date moved by someone else |
| New comment, Mentioned | Task owner, person mentioned | Comment added, `@name` |
| Changes requested | Task owner | Review sent back |
| Blocked | Project owner | Task blocked |
| Review requested | Project owner | Task in review |
| More time requested, Question | Project owner | Task owner asks |
| Milestone soon, Milestone late | Project owner | Within 3 days, overdue |
| Ready to close | Project owner | All work done |

You never receive a notification for your own action.

**Emails** go only to registered, active people, and never to the person who took the action.

| Event | Sent to | When |
|---|---|---|
| New task assigned | New owner | A Super Admin or Manager gives them a task |
| Task reassigned | New owner | The owner changes. The old owner is told in the app |
| Project assigned | New project owner | The project's owner changes |
| Deadline reminder | Task owner | 3 days, 1 day and the day itself |
| Task overdue | Task owner | The first day late, then weekly |
| Task completed | Whoever assigned it, the project's owner, answerable and managers | Status becomes Completed |
| Manager comment | Task owner | A Super Admin or Manager comments on the task |
| Review requested | Whoever assigned it, the project's owner, answerable and managers, and the task owner | Status becomes In Review or Awaiting Approval |

Every email has the task name, ID, project, priority, deadline and a direct link. One save sends one email per person per kind of event, listing up to 30 items. Reminders and overdue notices are one summary per person per day.

## Automation

| Job | How | Safe to repeat |
|---|---|---|
| Milestone follows tasks | Server, on each save | Yes |
| Reminders | Worked out from data on opening the site | Yes, stable IDs |
| Overdue events | `dailyChecks` at 06:00 in the Sheet's time zone | Yes, one row per item and date |
| Daily progress snapshot | First signed-in visit each day | Yes, one per project per day |
| Nightly backup | `backupNow` at 02:00 | Each run makes a new copy |
| Save retries | Browser, every 15 seconds until it succeeds | Yes, by request ID |
| Emails from a save | Server, straight after the save. The rest wait for the next retry run | Yes, by `dedupeKey` |
| Email retries | `processNotifications` every 5 minutes | Yes |
| Reminders and overdue emails | `dailyChecks` at 06:00 | Yes, one notice per task, person and date |

The three timed jobs start after you click **Turn on daily backup, reminders and email retries** in the Control Tower menu. Dates use the viewer's time zone on the site and the Sheet's in `dailyChecks`.
