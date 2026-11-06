# Operating manual

## Roles at a glance

| Role | Can do |
|---|---|
| **Super Admin** | Everything: employees, integrations, the audit log and all projects |
| **Manager** | Create projects, and manage and assign work on the projects they own or are named on |
| **Employee** | See and update their own tasks, comment, and add tasks for themselves |
| **Viewer** | Read what they are allowed to see, and change nothing |

## 1. Create a project

**New > Project.** Fill in the name, owner, priority and dates, and save. To let other managers assign work there, open **More details** and add their emails under **Managers who can assign work here**.

## 2. Create a task

**New > Assign a task by email** is the normal way. **New > Task** is still there for draft tasks with no one assigned.

## 3. Assign an employee by email

1. Fill in the title and description, and choose the project.
2. Type the employee's official email. Their name and designation appear once it matches exactly.
3. Choose the priority and deadline, then **Review assignment**.
4. Check the preview, then **Confirm assignment**.

The last screen shows what really happened: saved to the Sheet, email status, in-app notification and audit.

**Or type one line** in **Assign in one line** on Home:

> Assign the high priority website redesign task to name@suraasa.com under the CRM project with a deadline of 10 November 2026

You still see the preview before anything is saved. If something is missing or does not match, the form opens and says what. It never guesses a person or project.

To assign several people, separate their emails with commas. Each is emailed and sees the task.

**To reassign:** open the task, click **Reassign**, enter the new email and give a reason.

**To copy a task:** open it and click **Duplicate**. You review it before anything is saved.

## 4. Check whether an email was sent

**Notifications > Email log**, or **Administration > Notification log**. Managers see their own projects, Super Admins see everything. The same records are in the `NotificationLog` tab.

| Status | Meaning |
|---|---|
| Accepted by mail service | Google took it. It usually arrives within a minute, but this cannot prove it reached the inbox |
| Queued | It will go within 5 minutes |
| Failed, will retry | It retries by itself, up to 5 attempts |
| Stopped | It failed 5 times. A Super Admin can press **Retry** |
| Not sent | Emails were turned off |

A Super Admin can press **Resend** on a sent email.

## 5. Check Google Sheets sync

The dot beside the bell shows **Saved**, **Saving** or **Not saved**. **Administration > Integrations** shows the last change, the version and any saves still waiting.

Every change on the site reaches the Sheet straight away. Edits typed in the Sheet reach the site within about 30 seconds, but skip the checks the site applies, so limit who can edit the Sheet.

If a save fails, the change stays in the browser and retries every 15 seconds.

## 6. How employees update tasks

They sign in with their work email and password, and see their tasks on their dashboard, or use the link in any email.

- **Start** and **Complete** on the dashboard do the usual moves.
- **Update** opens the task, to add a note, change the stage, status or progress, add a checklist or a link, or ask for more time.
- **My Tasks** has list, board and calendar views, and can be sorted under the filters.
- **My Projects** lists the projects their work is in.
- **Links and files** on a task takes an upload of up to 10 MB, or a link. On a shared task, people can change only what they added.

## 7. Monitor team performance

**Home** shows total, assigned, pending, in-progress, completed and overdue tasks, the completion rate, tasks by stage and priority, project progress, completions per week, employee workload and upcoming deadlines. Filter by employee or project at the top. **Reports** has more measures and downloads.

## 8. Add new employees

**Administration > Employees > Add employee.** Enter their name, official email, role, department, designation, manager and joining date. They get an employee ID. Then open them and click **Reset password** to get a temporary password to give them. You can also add a row to the `Users` tab.

To remove someone, edit them and set **Access** to **Inactive**. Their access ends at their next request, and their history stays.

Managers see **Administration > Employees** too. They can update the department, designation and joining date of people who report to them, and **My team** shows who those are. Set a person's manager on their record.

## 9. Manage permissions

Change **Role** on the employee's record. It applies at their next request. Give each person a different name: a name two people share gives neither of them rights on older tasks, so assign those by email instead. To let a Manager work on a project, make them its owner or add them under **Managers who can assign work here**. To hide a project from most people, make it restricted.

## Editing in the Sheet

A change made in the Sheet appears on open pages within about 5 seconds, with nothing to refresh. So nobody is interrupted, a page waits while someone is typing in a box or has a form open, then updates.

To include rows being added or removed, click **Control Tower > Turn on instant updates to the website** once. Do not change IDs or column headings by hand.

## 10. Troubleshooting

| What you see | What to do |
|---|---|
| "Your account has no access yet" | Add the email under Employees or in the Users tab |
| "That email or password is not right" | Check the spelling, or reset the password under **Administration > Employees** |
| "Too many wrong tries" | Wait 15 minutes, or reset the password |
| "The server needs updating" | Follow DEPLOYMENT.md, steps 4 and 6 |
| "X is not a registered employee" | Check the spelling, or add them first |
| "You can assign tasks only on projects you manage" | Ask a Super Admin to add you to the project |
| Not saved, at the top of the page | Check your connection. It retries by itself |
| "Someone changed this" | Another person edited the same field. Check the value, and change it again if needed |
| "The columns of the X tab were changed" | Run **Control Tower > Set up / repair tabs** |
| Employees are not receiving email | **Administration > Integrations**: check the mode says **Live**. In test mode, all email goes to the script owner |
| Emails stay queued | Turn on **daily backup, reminders and email retries** in the Sheet menu |
| Email says the daily limit was reached | It retries by itself. Google resets the limit each day |
| A task will not show for its owner | Open it and check the owner email. Use **Reassign** if it is blank or wrong |
| Reminders are not arriving | Check **Integrations > Automation**, and that the task has a deadline and a registered owner |
