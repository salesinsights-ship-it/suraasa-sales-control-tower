# Test cases and results

Deliverable 13. Run on 5 November 2026 on version 3.0.0, on the built-in data and again on a read-only copy of the live data from the same day (20 projects, 129 tasks).

**491 checks, 0 failed**, plus 72 layout checks with no problems, on both sets of data.

| Suite | Checks | What it runs against |
|---|---|---|
| `tests/engine.test.js` | 43 | The rules and the one-line command, directly |
| `tests/backend.test.js` | 72 | The real `Code.gs` on a simulated Sheet |
| `tests/automation.test.js` | 107 | Assignment, emails, sign-in, permissions and upgrading today's Sheet |
| `tests/e2e/journeys.js` | 51 | Journeys A to J, in Chromium |
| `tests/e2e/features.js` | 27 | Other features, in Chromium |
| `tests/e2e/signin.js` | 30 | Password and Google sign-in, in Chromium |
| `tests/e2e/assignment.js` | 61 | Assigning by email end to end, lost replies, shared computers, phone |
| `tests/e2e/roles.js` | 24 | What each role sees and can do, and the home page numbers |
| `tests/e2e/stage.js` | 28 | The Stage dropdown |
| `tests/e2e/delete.js` | 30 | Deleting tasks |
| `tests/e2e/conflicts.js` | 9 | Two browsers at once, offline work |
| `tests/e2e/compat.js` | 3 | The site refuses to talk to an older script |
| `tests/e2e/csp.js` | 6 | The site under the real security headers |
| `tests/e2e/sweep.js` | 72 | 12 screens on phone, tablet and desktop, light and dark: overflow and script errors |

`tests/e2e/login.js` was removed, because the sign-in it tested no longer exists.

**Before this work:** at the commit this started from, all ten browser suites failed, because that commit disconnected the site from the Sheet. The earlier claim of 361 passing checks did not hold for that commit.

## What the brief asked to test

| Asked for | Where | Result |
|---|---|---|
| Employee assignment by email | `automation`: exact match, unknown, inactive, similar, a name in place of an email | Pass |
| Assignment email generation | `automation`: every field, link, escaping | Pass, simulated mail |
| Google Sheets synchronization | `automation`, `assignment`: every change reaches the same row | Pass, simulated Sheet |
| Reassignment | `automation`, `assignment` | Pass |
| Unauthorized data access | `automation`, `assignment`, `roles`: reads, writes, links | Pass |
| Duplicate notifications | `automation`, `assignment`: retries, double clicks, lost replies | Pass |
| Concurrent task updates | `automation`, `conflicts` | Pass |
| Failure recovery | `automation`: mail down, daily limit, Sheet failing partway, 5 failures | Pass |

## Feature report

| Feature | Implementation | Test result | Status |
|---|---|---|---|
| Authentication | Email and password checked on the server, with salted hashes, a lock after five wrong tries and temporary passwords. Sign in with Google is optional. Sessions end after 6 hours idle or 12 hours in total, and on sign-out | Passed on a simulated script | Needs the new script version |
| RBAC | Super Admin, Manager, Employee and Viewer, enforced on the server for every read and write | Passed, including direct-request attacks | Ready |
| Task creation | Form, preview, one-line command and Duplicate. Task IDs never repeat | Passed. A double click or lost reply makes one task | Ready |
| Employee assignment | One or several registered emails, matched exactly | Passed | Needs Users tab |
| Google Sheets | Same Sheet and tabs. New columns go right of `_extra`, and every change reaches the same row | Passed, including an upgrade of a copy of your data | Needs deployment |
| Email notifications | All 8 events, a log, retries and duplicate prevention. Starts in test mode | Passed, simulated mail | Needs go-live |
| Project management | All existing features kept, plus email owners, Managers lists and uploads | Passed | Ready |
| Employee dashboard | Overdue work, deadlines, My Projects, links from emails | Passed | Ready |
| Admin dashboard | 10 real figures, 6 charts, workload table, deadlines and filters | Passed, numbers checked against the data | Ready |
| Deployment | Security headers added. The site refuses older scripts | Passed on a local server, not on Vercel | Needs GitHub and script access |
| Security | Public access closed by default. The published page holds no people, keys or Sheet address | Passed, then reviewed independently | Needs deployment |

## Loading your data into a new Sheet

The new Sheet was built by running the real `Code.gs` on a copy of the live data, writing every tab to a workbook, reading that workbook back onto a fresh simulated Sheet, and running `setupSheet` and a Google sign-in as the Sheet's owner. Every project, task, risk, dependency, decision, action, programme, role and activity record matched the live copy, field by field. That check found one real bug, now fixed: a single sentence with a comma in a line-by-line list, such as an assumption, was being split into two items.

This has not been run through Google's own import.

## What these tests do not show

- **On real Google, only the script's setup, its public link and the data import have been proven.** Password sign-in, real email and saving from the site have not.
- **The tests themselves ran on stand-ins, not real Apps Script, email or your real Sheet.** `tests/mock-gas.js` stands in for them. It catches logic errors, but cannot prove how Google's services behave. In particular, these need checking in step 8 of [DEPLOYMENT.md](DEPLOYMENT.md): that Google sign-in works, that an email arrives and looks right, and that `setupSheet` upgrades the real Sheet.
- **The Vercel security headers were tested on a local server** with the same headers, not on Vercel.
- The copy of live data was read-only. **No test wrote to your Sheet, and no test sent a real email.**
- The layout sweep finds overflow and errors. It does not judge appearance. Key screens were also reviewed by eye.
- No screen reader or load test was done.

## Independent review of this release

Separate reviewers, who had not seen the work, read the code and ran attacks against the real `Code.gs` and a scratch build.

| Pass | What it covered | Result |
|---|---|---|
| 1 | Security and logic of the whole release | 23 confirmed problems, 8 of them high severity. All fixed, each with a test |
| 2 and 3 | Rechecks of those fixes | 7 fixes needed more work, some new problems, then 3 smaller items. All fixed |
| 4 | Both briefs traced line by line against the code | About 265 requirements done, 21 gaps and 7 false doc statements. Fixed, apart from the limits below |
| 5 | Google's own documentation for every service used | The Workspace `hd` check was missing, and cache keys were unbounded. Both fixed |
| 6 | The code added by passes 4 and 5 | 1 high severity problem in the new sign-in limit, 3 medium and 7 small. All fixed |

**The fixes from pass 6 have tests but were not reviewed again.** The findings have moved from serious flaws to edge cases, but a review only shows what it found.

Three outcomes were accepted on purpose:

- A task an employee writes for themselves does not open up its project, and gives them no right to add weekly updates there.
- A hand-added column named after a field stored in `_extra` is ignored. Your live Sheet has none.
- A value typed literally as `'=x` loses its quote.

## Earlier reviews

A separate reviewer, who had not seen the work, read the server and sync code before release and reported 13 confirmed problems. Every one is fixed and now has a test. The review's own probe script was rerun after the fixes, and each attack it demonstrated now fails. A second separate review then covered the code added afterwards, and found 13 more confirmed problems, listed in the changelog. All are fixed, with tests for the ones that can be tested automatically. Those last fixes have not been reviewed again.

| Finding | Risk | Fix |
|---|---|---|
| Writes past the bottom of a tab failed | Saves stopped at row 1,000 of the audit log; milestones could be lost | Tabs now grow; nested tabs rewritten in one step, never deleted first |
| A pull reset the comparison point | A save after a pull could silently overwrite someone else | Unsent changes are checked against the newest data; the newer value wins and the person is told |
| Deleting a comment did nothing | Endless resending | Removals honoured on both sides, and logged with the old text |
| Importing an old file while connected | Could delete live records | Import works only on an empty Sheet; saves deleting over 25 records are refused |
| A cell over 50,000 characters | Half-written saves; a tab wiped in old-style saves | Checked before writing; long deleted records split across columns so restore works |
| Hand-added columns | Dropped by setup; an inserted column shifted data | Kept by setup; saves stop if columns moved |
| ID in the body differing from the op | A Project Owner could overwrite any project | The ID is fixed by the server and can never change |
| Subtask or task moved across projects | Could enter a restricted project or take others' tasks | Must match the parent, and own both projects |
| Mixed-case email in Users | A deactivated person stayed active | Matching ignores case |
| Activity text, snapshots and system rows | Reached every role | Filtered by access |
| Stamps and notes could be forged | History could be rewritten | Server stamps are ignored from outside; notes are added only in your own name |
| Project owner approving their own task elsewhere | Review bypassed | Only that project's owner can approve |
| A version jump hid another person's save | Stale screen | The site reloads when the version jumps |

Also fixed: two people taking the same new ID now both keep their record; direct Sheet edits are all logged; settings cells are written one at a time; the Sheet is flushed before the lock is released; a save that fails partway records what was written, so a retry finishes it.

## Bugs these tests found, now fixed

| Bug | Would have caused |
|---|---|
| The sign-in check misread a normal reply | Everyone sent to the sign-in screen, even with sign-in off |
| A save finishing a task and its milestone was refused | The project owner's approval failed |
| Task owners' finished work did not complete the milestone | Milestones stuck open |
| Undo after ticking a task was refused by the server | Undo appeared to work, then reverted |
| Ticking a Blocked or Backlog task was refused by the server | A confusing refused save |
| Reason form hidden behind the task panel | Could not mark a task blocked from a list |
| Real data in the page source | Readable by anyone, even with sign-in on |
| Project could be closed with open tasks | Closure rule bypassed |
| A single late low-priority task, if the only one open, gave Delayed | Broke the health rule |
| Dark theme showed two logos | Visual fault |
| Timeline did not update after saving | History looked missing until refresh |
## Journeys

### Journey A: Project owner creates a project, milestone and tasks, and assigns them

| Check | Result |
|---|---|
| A1 project created and saved to the Sheet | Pass |
| A2 ID, creator and original date recorded | Pass |
| A3 milestone and assigned task saved | Pass |
| A4 audit records creation | Pass |
| A5 no page errors | Pass |

### Journey B: Task owner updates, adds a note, reports a blocker, submits for review

| Check | Result |
|---|---|
| B1 signed in as task owner, not administrator | Pass |
| B2 update, note and status saved | Pass |
| B3 note has author and timestamp | Pass |
| B4 task owner has no edit-details or delete | Pass |
| B5 blocked needs a reason | Pass |
| B6 blocker recorded with text and note | Pass |
| B7 submitted for review | Pass |
| B8 no page errors | Pass |

### Journey C: Project owner reviews, requests changes, approves

| Check | Result |
|---|---|
| C1 project owner told about the review | Pass |
| C2 changes requested with comment | Pass |
| C3 approved: completed at 100% | Pass |
| C4 every status change traceable with who and when | Pass |
| C5 no page errors | Pass |

### Journey D: Task goes overdue: event, health, notification

| Check | Result |
|---|---|
| D0 set up an overdue task | Pass |
| D1 overdue event in the log | Pass |
| D2 health moves and says why | Pass |
| D3 owner gets a notification | Pass |
| D4 no duplicates after reload | Pass |

### Journey E: Administrator changes permissions; restricted actions are blocked

| Check | Result |
|---|---|
| E1 role changed in Administration | Pass |
| E2 server refuses the former owner | Pass |
| E3 viewer sees no write controls | Pass |
| E4 viewer cannot open Administration | Pass |
| E5 viewer cannot make themselves admin through the API | Pass |

### Journey F: Two people update the same task

| Check | Result |
|---|---|
| F1 second writer does not silently overwrite | Pass |
| F2 second user is told | Pass |
| F3 notes from both people are kept | Pass |

### Journey G: Network loss keeps input

| Check | Result |
|---|---|
| G1 failure is shown, not hidden | Pass |
| G2 change kept in the browser | Pass |
| G3 survives a reload while offline | Pass |
| G4 reaches the Sheet when back online | Pass |
| G5 a new browser with no connection shows an error, not old sample data | Pass |

### Journey H: Project archived and restored with history

| Check | Result |
|---|---|
| H1 archived, tasks untouched | Pass |
| H2 gone from the active list | Pass |
| H3 not counted on the dashboard | Pass |
| H4 restored with history | Pass |

### Journey I: Restricted project reached by URL or API

| Check | Result |
|---|---|
| I1 API gives a non-member nothing about it | Pass |
| I2 writes refused too | Pass |
| I3 site shows nothing | Pass |
| I4 no session, no data | Pass |
| I5 no data over GET either | Pass |
| I6 forged session refused | Pass |

### Journey J: All work done, Ready for Closure, formal close

| Check | Result |
|---|---|
| J1 cannot close with open tasks | Pass |
| J2 progress is 100% and project shows Ready for closure | Pass |
| J3 not closed automatically | Pass |
| J4 formally closed with note and who | Pass |
| J5 no page errors | Pass |

## Other new features

| Check | Result |
|---|---|
| earlier date refused for an extension | Pass |
| extension request stored, date unchanged | Pass |
| panel shows request | Pass |
| project owner is notified | Pass |
| approval moves the date and keeps the original | Pass |
| date change in the audit log | Pass |
| timeline updates straight after saving | Pass |
| no page errors | Pass |
| saved view restores its filter | Pass |
| selection does not open the task | Pass |
| count shown | Pass |
| empty bulk edit refused | Pass |
| owner change needs a reason | Pass |
| bulk owner change saved with note | Pass |
| each change audited | Pass |
| saved view survives reload | Pass |
| notification preference kept | Pass |
| report dates change the measures | Pass |
| report CSV downloads | Pass |
| activity CSV downloads | Pass |
| breadcrumb on project | Pass |
| project report downloads | Pass |
| search finds projects and tasks | Pass |
| no page errors | Pass |
| tick completes the task | Pass |
| tick reaches the Sheet | Pass |
| undo restores it | Pass |

## Sign-in

| Check | Result |
|---|---|
| sign-in screen shows before any data | Pass |
| official logo on the sign-in screen | Pass |
| page source holds no project, owner or risk data | Pass |
| no project data on screen before sign-in | Pass |
| someone not on the list is refused | Pass |
| another domain is refused | Pass |
| listed person gets in with their role | Pass |
| stays signed in on reload | Pass |
| sign out returns to the sign-in screen | Pass |
| session gone after sign out | Pass |
| editing browser storage gets nowhere | Pass |
| no copy of the work left in this browser | Pass |
| no page errors | Pass |

## Roles

| Check | Result |
|---|---|
| Administrator: total tasks is right | Pass |
| Administrator: the numbers add up | Pass |
| Administrator: employees are single people | Pass |
| Administrator: the employee filter works and is exact | Pass |
| Administrator: completion rate is right | Pass |
| Administrator: has Administration | Pass |
| Administrator: full New menu | Pass |
| Employee: home shows only their tasks | Pass |
| Employee: short menu | Pass |
| Employee: New offers only what they can do | Pass |
| Employee: role shown is the server's | Pass |
| Employee: quick buttons only on own tasks | Pass |
| Employee: can add their own task | Pass |
| Profile opens with no password fields | Pass |
| Profile closes | Pass |
| no page errors | Pass |
| Employee on a phone: no extra menu | Pass |
| Script unreachable on return: the page is not blank | Pass |
| Project Owner: sees projects, not Administration | Pass |
| Project Owner: can plan | Pass |
| Viewer: no write controls | Pass |
| Viewer: no delete, no tick | Pass |
| An expired session goes back to sign-in | Pass |

## Stage

| Check | Result |
|---|---|
| the five stages are offered, in order | Pass |
| it starts on the task's real stage | Pass |
| choosing a stage moves the Status dropdown with it | Pass |
| choosing a status moves the Stage dropdown with it | Pass |
| Moved ahead saves as In Progress | Pass |
| the panel shows the new stage | Pass |
| Parked saves as On Hold | Pass |
| a parked task can go straight to Completed, at 100% | Pass |
| Not yet started clears the finish date and progress | Pass |
| Dropped needs a reason | Pass |
| Dropped saves as Cancelled with the reason | Pass |
| dropped tasks have a place to be found | Pass |
| and show there | Pass |
| a dropped task can be brought back | Pass |
| parked tasks have their own filter | Pass |
| the board has a column for them | Pass |
| the edit form has the same row | Pass |
| and it moves Status too | Pass |
| the form saves the stage | Pass |
| the form asks why it was dropped | Pass |
| and records it | Pass |
| stage is not stored as a second field | Pass |
| a new task can start at a stage | Pass |
| every change is in the audit log | Pass |
| no page errors | Pass |
| a task needing review cannot skip it through Stage | Pass |
| the task owner can use the stages | Pass |
| a viewer sees the stage but cannot change it | Pass |

## Deleting tasks

| Check | Result |
|---|---|
| cancel leaves the task alone | Pass |
| the question names the task | Pass |
| the panel does not open and the row goes | Pass |
| nothing reaches the Sheet during the Undo window | Pass |
| undo brings it back, untouched | Pass |
| after the Undo window it leaves the Sheet | Pass |
| recorded in the audit log | Pass |
| kept in Deleted items | Pass |
| can be restored from Deleted items | Pass |
| no page errors | Pass |
| test tasks set up | Pass |
| the question mentions subtasks and waiting tasks | Pass |
| the panel closes with no error | Pass |
| undo restores subtasks and links | Pass |
| subtasks at every level go too | Pass |
| waiting tasks lose only the deleted link | Pass |
| a task that waited on it can still be saved | Pass |
| no page errors | Pass |
| no row buttons while selecting | Pass |
| Delete selected starts disabled | Pass |
| two selected tasks deleted | Pass |
| selection is cleared | Pass |
| more than 25 at once is refused | Pass |
| a task owner sees no delete on rows | Pass |
| or in the panel | Pass |
| the server refuses a task owner | Pass |
| a viewer sees no delete | Pass |
| the server refuses a viewer | Pass |
| phone: no tiny row button | Pass |
| phone: delete is in the panel | Pass |

## Two browsers at once

| Check | Result |
|---|---|
| pull waits while a form is open | Pass |
| the newer value is not overwritten | Pass |
| the person is told | Pass |
| offline change does not beat a newer save | Pass |
| the rest of the offline work is kept | Pass |
| two people taking the same ID both keep their task | Pass |
| comment deleted on the Sheet | Pass |
| no endless resending | Pass |
| import refused while connected | Pass |

## Deployment order

| Check | Result |
|---|---|
| new site reads data from the old script | Pass |
| new site saves through the old script | Pass |
| no data lost in that save | Pass |
| no page errors | Pass |
| old site can still save through the new script until it is replaced | Pass |

## Rules and server

| Check | Result |
|---|---|
| manual progress is used when there is no checklist or subtask | Pass |
| checklist drives progress | Pass |
| subtasks drive the parent, weighted, and take priority over a checklist | Pass |
| cancelled subtasks leave the calculation | Pass |
| a task never shows 100% until it is really Completed | Pass |
| project progress = sum(weight x completion) / sum(weights) | Pass |
| cancelled tasks leave the denominator | Pass |
| invalid weights count as 1 and do not distort | Pass |
| subtasks are not double counted at project level | Pass |
| recurring tasks stay out of project progress | Pass |
| valid and invalid status moves | Pass |
| every status in the list has defined moves | Pass |
| a single low-priority overdue task among many is not Delayed | Pass |
| an overdue high-priority task makes a project Delayed, with a reason | Pass |
| overdue share past the threshold makes it Delayed | Pass |
| health thresholds are configurable | Pass |
| a blocked P0 task makes the project Blocked | Pass |
| a late milestone is Delayed; a healthy project is On track | Pass |
| progress stagnation is flagged | Pass |
| completed project reads Completed whatever its tasks say | Pass |
| dependency loops are found, including long chains | Pass |
| downstream impact walks the chain | Pass |
| ready for closure needs all tasks done, and does not fire on an empty project | Pass |
| notifications never repeat and carry a stable id | Pass |
| your own actions do not notify you | Pass |
| mentions and assignments reach the right person | Pass |
| project owners hear about time requests and questions; owners hear about late dependencies | Pass |
| many late tasks become one line, not a storm | Pass |
| one late low-priority task never makes a project Delayed, even if it is the only open one | Pass |
| every status has a stage, and each stage sets one status | Pass |
| every stage can be reached from every status | Pass |
| every record survives a round trip through the Sheet | Pass |
| pull reports API 3 and adds system tabs without touching data tabs | Pass |
| ping does not reveal the Sheet address or name | Pass |
| a save changes only the record it names and records who, what and when | Pass |
| two people changing different fields of one task both succeed | Pass |
| two people changing the same field: the second is refused, nothing silently overwritten | Pass |
| two people adding notes at once are both kept | Pass |
| the same save sent twice is applied once | Pass |
| one bad record in a batch means nothing in the batch is written | Pass |
| orphan task, duplicate ID, bad progress, invalid date and bad status moves are refused | Pass |
| dependency loops are refused | Pass |
| a deleted record goes to Trash, history stays, and it can be restored | Pass |
| an old site cannot wipe the Sheet by saving a near-empty copy | Pass |
| nested milestones change without touching other projects | Pass |
| progress snapshots are stored once per project per day | Pass |
| option lists now survive a save | Pass |
| with sign-in on, nothing can be read or changed without a session | Pass |
| sign-in checks audience, domain, verification, expiry and the Users list | Pass |
| the author comes from the session, not from what the browser claims | Pass |
| a viewer can read but cannot change anything | Pass |
| a task owner can update their task but not its scope, owner or dates | Pass |
| a project owner manages their own projects only | Pass |
| a restricted project cannot be reached by people outside it, even by direct request | Pass |
| changing a role applies at once, and the last admin cannot be removed | Pass |
| a task needing review cannot be self-approved by its owner | Pass |
| a milestone with open tasks cannot be marked complete | Pass |
| a project with open tasks cannot be closed | Pass |
| the task owner can ask for more time but cannot move the date | Pass |
| daily checks record each late item once and survive a rerun | Pass |
| finishing the last task completes the milestone, even for a task owner | Pass |
| a save that finishes a task and its milestone together is accepted | Pass |
| tabs grow past the bottom of the grid instead of failing | Pass |
| rewriting milestones loses nothing even on a tab with no spare rows | Pass |
| the last row of a tab can be deleted | Pass |
| deleting a comment works, is recorded, and does not resend | Pass |
| removing a comment keeps one someone else just added | Pass |
| a record too long for a cell is refused before anything is written | Pass |
| a long record can be deleted and restored whole | Pass |
| an old-style whole-sheet save with an oversized cell wipes nothing | Pass |
| setup keeps columns added by hand; a moved column stops saves | Pass |
| a record ID in the body cannot point at another record | Pass |
| a subtask cannot be used to get into a restricted project | Pass |
| a project owner cannot pull tasks out of a project they do not own | Pass |
| deactivating a user works whatever case their email was typed in | Pass |
| non-admins do not get activity text, restricted snapshots, or system rows | Pass |
| server stamps cannot be set from outside | Pass |
| notes can only be added as yourself, and changed only by their author or the project owner | Pass |
| a comment cannot be aimed at another project | Pass |
| a project owner cannot approve their own task on someone else's project | Pass |
| a save that would delete many records is refused | Pass |
| every direct Sheet edit is logged, even inside the debounce window | Pass |
| employees get only their own tasks and what belongs to those projects | Pass |
| an employee can add a task for themselves, not for someone else | Pass |
| management and employee are accepted as role names in the Users tab | Pass |
| nothing is returned, and nothing can be saved, without a real session | Pass |
| a conflict reply never reveals a task the person may not touch | Pass |
| priority must be a real priority | Pass |
| employees get only a name for projects they have no tasks in | Pass |
| employees cannot comment on or update projects outside their work | Pass |
| an employee cannot write progress history | Pass |

## How to run

```
npm test
npm i --no-save playwright
npm run test:e2e
```

Set `FIXTURE=path/to/state.json` to test on a saved copy of the data. Do not commit that file.
