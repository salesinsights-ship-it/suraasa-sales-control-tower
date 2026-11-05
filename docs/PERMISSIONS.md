# Roles and permissions

Deliverable 5. These rules run on the server (`deny_` and `canSeeProject_` in `Code.gs`). Hiding a button is only a convenience. Nothing is readable without a Google sign-in.

| On the site and in the Users tab | Stored as, and shown in the table below as |
|---|---|
| Super Admin | Administrator |
| Manager | Project Owner |
| Employee | Task Owner |
| Viewer | Viewer |

A person's role is in the Users tab. "Project owner of X" means their registered email, or failing that their exact name, is the Owner or Answerable on project X, or their email is in that project's Managers list. "Task owner of Y" means the same for the Owner of task Y. When a record has an owner email, only the email counts. Proposed names (`TBD — proposed: …`) give no rights.

| Action | Administrator | Project Owner, own project | Project Owner, other project | Task Owner, own task | Task Owner, other task | Viewer |
|---|---|---|---|---|---|---|
| See open projects | Yes | Yes | Yes | Yes | Yes | Yes |
| See other people's tasks | Yes | Yes | Yes | n/a | No | Yes |
| Add a task with themselves as owner | Yes | Yes | Yes | Yes | Yes | No |
| See restricted projects | Yes | Yes | If named | If named or assigned | If named | If named |
| Create a project | Yes | Yes | Yes | No | No | No |
| Edit project details | Yes | Yes | No | No | No | No |
| Close, archive, restore | Yes | Yes | No | No | No | No |
| Delete a project | Yes | No | No | No | No | No |
| Assign a task by email | Yes | Yes | No | No | No | No |
| Add or remove tasks and milestones | Yes | Yes | No | No | No | No |
| Change task owner, due date, priority, scope | Yes | Yes | No | No | No | No |
| Update status, progress, checklist, notes, blockers, links | Yes | Yes | No | Yes | No | No |
| Add a comment on a visible task | Yes | Yes | Yes | Yes | No | No |
| Edit or remove someone else's note | Yes | Yes | No | No | No | No |
| Edit or remove your own note | Yes | Yes | Yes | Yes | Yes | No |
| Update a risk, decision or dependency you own, without reassigning it | Yes | Yes | Yes | Yes | Yes | No |
| Add subtasks | Yes | Yes | No | Yes | No | No |
| Ask for more time | Yes | Yes | No | Yes | No | No |
| Decide a time request | Yes | Yes | No | No | No | No |
| Submit for review | Yes | Yes | No | Yes | No | No |
| Approve, request changes | Yes | Yes | No | No | No | No |
| Bulk edit | Yes | Yes | No | No | No | No |
| See the employee directory (names, emails, departments) | Yes | Yes | Yes | No | No | No |
| See the notification log | Yes | Own projects | Own projects | No | No | No |
| Retry or resend emails, send a test email, see Integrations | Yes | No | No | No | No | No |
| Manage employees, health rules, settings | Yes | No | No | No | No | No |
| View the audit log and deleted items | Yes | No | No | No | No | No |

Notes:
- A task owner's editable fields are listed in `TASK_OWNER_FIELDS`. Anything else is refused, including `due` and `owner`.
- Notes are added only in your own name. Server stamps (`createdBy`, `updatedAt`, `originalDue` and so on) and record IDs cannot be set from outside.
- In the Users tab, `management` means Super Admin and `employee` means Employee.
- Only a Super Admin can change a person's role, so a Manager cannot raise their own access.
- Employees (Task Owners) receive only their own tasks and subtasks from the server, plus risks, dependencies, decisions, updates and actions on the projects those tasks are in.
- There must always be one active Administrator.
- A role change or deactivation takes effect on that person's next request.
- To change what a role may do, edit `deny_` and `TASK_OWNER_FIELDS`. Permissions are configurable by role assignment in the Users tab, but not yet through a screen.
