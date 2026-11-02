# Test cases and results

Deliverable 13. Run on 2 November 2026 on the final build.

**184 checks, 0 failed**, plus 72 layout checks with no problems.

| Suite | Checks | What it runs against |
|---|---|---|
| `tests/engine.test.js` | 29 | The rules, directly |
| `tests/backend.test.js` | 51 | The real `Code.gs` on a simulated Sheet |
| `tests/e2e/journeys.js` | 51 | Journeys A to J, in Chromium |
| `tests/e2e/features.js` | 27 | Other new features, in Chromium |
| `tests/e2e/signin.js` | 12 | Sign-in, in Chromium, with Google simulated |
| `tests/e2e/conflicts.js` | 9 | Two browsers at once: conflicts, duplicate IDs, offline work, comment delete, import |
| `tests/e2e/compat.js` | 5 | Old script with new site, new script with old site's saves |
| `tests/e2e/sweep.js` | 72 | 12 screens × phone, tablet, desktop × light, dark: horizontal overflow and script errors |

Rules and server suites also pass on the built-in data. The browser journeys were run on both a copy of the live data and the built-in data.

## What these tests do not show

- **Nothing ran on real Apps Script, real Google sign-in or your real Sheet.** `tests/mock-gas.js` stands in for them. It catches logic errors, but cannot prove how Google's services behave. The checks in [DEPLOYMENT.md](DEPLOYMENT.md) cover that gap.
- The copy of live data is read-only. **No test wrote to your Sheet.**
- The layout sweep finds overflow and errors. It does not judge appearance; key screens were also reviewed by eye.
- No screen reader or load test was done.

The simulation was made stricter after the review below: it now enforces Google's grid limits, the 50,000-character cell limit and the rule against deleting the last row. It still cannot prove real behaviour.

## Independent review

A separate reviewer, who had not seen the work, read the server and sync code before release and reported 13 confirmed problems. Every one is fixed and now has a test. The review's own probe script was rerun after the fixes, and each attack it demonstrated now fails. The fixes themselves have not had a second independent review.

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
| no copy of the work left in this browser | Pass |
| no page errors | Pass |

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

## How to run

```
npm test
npm i --no-save playwright
npm run test:e2e
```

Set `FIXTURE=path/to/state.json` to test on a saved copy of the data. Do not commit that file.
