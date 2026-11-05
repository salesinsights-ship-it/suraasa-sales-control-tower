// Business-rule tests. Run: node tests/engine.test.js
const assert = require('assert');
const E = require('../src/engine.js');
const results = [];
const test = (n, f) => { try { f(); results.push(['PASS', n]); } catch (e) { results.push(['FAIL', n + ' :: ' + e.message]); process.exitCode = 1; } };
const T = (id, o) => Object.assign({ id, status: 'Not Started', progress: 0, projectId: 'P', priority: 'P2', kind: 'Task', parent: '' }, o);
const today = E.dayNum('2026-11-02');
const H = (p, tasks, extra) => E.health(Object.assign({ id: 'P', status: 'In Progress', accountable: 'AK', milestones: [] }, p), Object.assign({ tasks, deps: [], lastUpdateTs: '2026-11-01T00:00:00Z', today, now: new Date('2026-11-02T00:00:00Z').getTime() }, extra));

test('manual progress is used when there is no checklist or subtask', () => assert.strictEqual(E.taskPct(T('a', { progress: 40 }), []), 40));
test('checklist drives progress', () => { const t = T('a', { checklist: [{ done: true }, { done: true }, { done: false }, { done: false }] }); assert.strictEqual(E.taskPct(t, [t]), 50); assert.strictEqual(E.progressMode(t, [t]), 'Checklist'); });
test('subtasks drive the parent, weighted, and take priority over a checklist', () => {
  const p = T('p', { checklist: [{ done: false }] }); const a = T('a', { parent: 'p', status: 'Completed', weight: 3 }); const b = T('b', { parent: 'p', weight: 1 });
  assert.strictEqual(E.taskPct(p, [p, a, b]), 75); assert.strictEqual(E.progressMode(p, [p, a, b]), 'Subtasks');
});
test('cancelled subtasks leave the calculation', () => { const p = T('p'); const a = T('a', { parent: 'p', status: 'Completed' }); const b = T('b', { parent: 'p', status: 'Cancelled' }); assert.strictEqual(E.taskPct(p, [p, a, b]), 99); });
test('a task never shows 100% until it is really Completed', () => { const t = T('a', { checklist: [{ done: true }] }); assert.strictEqual(E.taskPct(t, [t]), 99); assert.strictEqual(E.taskPct(T('b', { status: 'Completed', progress: 0 }), []), 100); });
test('project progress = sum(weight x completion) / sum(weights)', () => { const ts = [T('a', { status: 'Completed', weight: 3 }), T('b', { progress: 0, weight: 1 })]; assert.strictEqual(E.projectPct(ts), 75); });
test('cancelled tasks leave the denominator', () => assert.strictEqual(E.projectPct([T('a', { status: 'Completed' }), T('b', { status: 'Cancelled' })]), 100));
test('invalid weights count as 1 and do not distort', () => assert.strictEqual(E.projectPct([T('a', { status: 'Completed', weight: 'x' }), T('b', { weight: -4 })]), 50));
test('subtasks are not double counted at project level', () => { const p = T('p'); const a = T('a', { parent: 'p', status: 'Completed' }); const b = T('b', { parent: 'p' }); assert.strictEqual(E.projectPct([p, a, b]), 50); });
test('recurring tasks stay out of project progress', () => assert.strictEqual(E.projectPct([T('a', { status: 'Completed' }), T('b', { kind: 'Recurring' })]), 100));
test('valid and invalid status moves', () => {
  assert.strictEqual(E.moveProblem(T('a'), 'In Progress'), '');
  assert.ok(E.moveProblem(T('a'), 'In Review')); assert.ok(E.moveProblem(T('a'), 'Cancelled')); assert.strictEqual(E.moveProblem(T('a'), 'Cancelled', { cancelReason: 'x' }), '');
  assert.ok(E.moveProblem(T('a'), 'Blocked')); assert.strictEqual(E.moveProblem(T('a'), 'Blocked', { blockerText: 'y' }), '');
  assert.ok(E.moveProblem(T('a', { status: 'In Progress', requiresReview: true }), 'Completed'));
  assert.strictEqual(E.moveProblem(T('a', { status: 'In Review', requiresReview: true }), 'Completed'), '');
});
test('every status in the list has defined moves', () => E.TASK_STATUSES.forEach(s => assert.ok(E.TRANSITIONS[s], s)));
test('a single low-priority overdue task among many is not Delayed', () => { const ts = [T('a', { due: '2026-11-01', status: 'In Progress' })].concat([...Array(9)].map((_, i) => T('t' + i, { status: 'In Progress', due: '2026-12-20' }))); const h = H({}, ts); assert.strictEqual(h.level, 'At risk'); assert.ok(/1 of 10/.test(h.reasons[0])); });
test('an overdue high-priority task makes a project Delayed, with a reason', () => { const h = H({}, [T('a', { due: '2026-11-01', priority: 'P0', status: 'In Progress' })]); assert.strictEqual(h.level, 'Delayed'); assert.ok(h.reasons.length); });
test('overdue share past the threshold makes it Delayed', () => { const ts = [...Array(3)].map((_, i) => T('l' + i, { due: '2026-11-01', status: 'In Progress' })).concat([...Array(7)].map((_, i) => T('o' + i, { status: 'In Progress', due: '2026-12-30' }))); assert.strictEqual(H({}, ts).level, 'Delayed'); });
test('health thresholds are configurable', () => { const ts = [...Array(3)].map((_, i) => T('l' + i, { due: '2026-11-01', status: 'In Progress' })).concat([...Array(7)].map((_, i) => T('o' + i, { status: 'In Progress', due: '2026-12-30' }))); assert.strictEqual(H({}, ts, { rules: { overdueShareDelayed: 50 } }).level, 'At risk'); });
test('a blocked P0 task makes the project Blocked', () => assert.strictEqual(H({}, [T('a', { status: 'Blocked', priority: 'P0' })]).level, 'Blocked'));
test('a late milestone is Delayed; a healthy project is On track', () => { assert.strictEqual(H({ milestones: [{ id: 'm', name: 'M', due: '2026-10-01', status: 'Pending' }] }, [T('a', { status: 'In Progress', due: '2026-12-30' })]).level, 'Delayed'); assert.strictEqual(H({}, [T('a', { status: 'In Progress', due: '2026-12-30' })]).level, 'On track'); });
test('progress stagnation is flagged', () => assert.ok(H({}, [T('a', { status: 'In Progress', due: '2026-12-30' })], { progressAgo: 20, progressNow: 20 }).reasons.some(r => /No progress/.test(r))));
test('completed project reads Completed whatever its tasks say', () => assert.strictEqual(H({ status: 'Completed' }, [T('a', { due: '2026-01-01' })]).level, 'Completed'));
test('dependency loops are found, including long chains', () => { const ts = [T('a', { dependsOn: ['b'] }), T('b', { dependsOn: ['c'] }), T('c')]; assert.ok(E.wouldLoop(ts, 'c', ['a'])); assert.ok(!E.wouldLoop(ts, 'c', [])); });
test('downstream impact walks the chain', () => { const ts = [T('a'), T('b', { dependsOn: ['a'] }), T('c', { dependsOn: ['b'] }), T('d')]; assert.deepStrictEqual(E.downstream(ts, 'a').map(t => t.id), ['b', 'c']); });
test('ready for closure needs all tasks done, and does not fire on an empty project', () => { assert.ok(!E.readyForClosure({ milestones: [] }, [])); assert.ok(E.readyForClosure({ milestones: [] }, [T('a', { status: 'Completed' }), T('b', { status: 'Cancelled' })])); assert.ok(!E.readyForClosure({ milestones: [] }, [T('a', { status: 'Completed' }), T('b')])); });
test('notifications never repeat and carry a stable id', () => {
  const t = T('a', { owner: 'AK', due: '2026-11-03', name: 'X' });
  const d = { me: 'AK', todayStr: '2026-11-02', today, tasks: [t], projects: [{ id: 'P', name: 'Pr', owner: 'AK', milestones: [] }], audit: [], mine: v => v === 'AK', ownsProject: () => true };
  const a = E.notifications(d), b = E.notifications(d);
  assert.strictEqual(a.length, 1); assert.strictEqual(a[0].id, b[0].id); assert.strictEqual(new Set(a.map(x => x.id)).size, a.length);
});
test('your own actions do not notify you', () => {
  const d = { me: 'AK', todayStr: '2026-11-02', today, tasks: [], projects: [], mine: v => v === 'AK', ownsProject: () => true, audit: [{ activityId: '1', actorName: 'AK', action: 'owner_changed', field: 'owner', newValue: 'AK', text: 't' }] };
  assert.strictEqual(E.notifications(d).length, 0);
});
test('mentions and assignments reach the right person', () => {
  const d = { me: 'AK', todayStr: '2026-11-02', today, tasks: [], projects: [], mine: v => String(v).includes('AK'), ownsProject: () => false, audit: [{ activityId: '1', actorName: 'B', action: 'owner_changed', field: 'owner', newValue: 'AK', text: 't', taskId: 'a' }, { activityId: '2', actorName: 'B', action: 'comment_added', newValue: 'please check @AK', taskId: 'a' }] };
  assert.deepStrictEqual(E.notifications(d).map(n => n.kind).sort(), ['Assigned to you', 'Mentioned']);
});
test('project owners hear about time requests and questions; owners hear about late dependencies', () => {
  const late = { id: 'x', name: 'X', status: 'In Progress', due: '2026-10-01', projectId: 'P' };
  const t = { id: 'y', name: 'Y', owner: 'AK', status: 'Not Started', due: '2026-12-01', projectId: 'P', dependsOn: ['x'], extensionRequest: { to: '2027-01-01', by: 'AK', ts: 'z' }, notes: [{ id: 'n', type: 'question', author: 'B', text: 'why?', ts: 'z' }] };
  const d = { me: 'AK', todayStr: '2026-11-02', today, tasks: [late, t], projects: [{ id: 'P', name: 'Pr', owner: 'AK', milestones: [] }], audit: [], mine: v => v === 'AK', ownsProject: () => true };
  const kinds = E.notifications(d).map(n => n.kind);
  ['More time requested', 'Question', 'Waiting on a late task'].forEach(k => assert.ok(kinds.includes(k), k));
});
test('many late tasks become one line, not a storm', () => {
  const tasks = Array.from({ length: 9 }, (_, i) => ({ id: 't' + i, name: 'T' + i, owner: 'AK', status: 'In Progress', due: '2026-10-01', projectId: 'P' }));
  const d = { me: 'AK', todayStr: '2026-11-02', today, tasks, projects: [], audit: [], mine: v => v === 'AK', ownsProject: () => false };
  const n = E.notifications(d);
  assert.strictEqual(n.length, 1); assert.match(n[0].text, /9 of your tasks/);
});
test('one late low-priority task never makes a project Delayed, even if it is the only open one', () => {
  const t = { id: 'a', status: 'In Progress', priority: 'P3', due: '2026-10-01', projectId: 'P' };
  const h = E.health({ id: 'P', status: 'In Progress', accountable: 'AK', milestones: [] }, { tasks: [t], deps: [], today, now: Date.now(), lastUpdateTs: new Date().toISOString() });
  assert.strictEqual(h.level, 'At risk');
});
test('every status has a stage, and each stage sets one status', () => {
  E.TASK_STATUSES.forEach(s => assert.ok(E.STAGES.includes(E.stageOf(s)), s));
  assert.deepStrictEqual(E.STAGES, ['Not yet started', 'Moved ahead', 'Completed', 'Parked', 'Dropped']);
  E.STAGES.forEach(x => assert.strictEqual(E.stageOf(E.STAGE_STATUS[x]), x));
  assert.strictEqual(E.stageOf('Blocked'), 'Moved ahead'); assert.strictEqual(E.stageOf('In Review'), 'Moved ahead'); assert.strictEqual(E.stageOf('Backlog'), 'Not yet started');
});
test('every stage can be reached from every status', () => {
  E.TASK_STATUSES.forEach(from => E.STAGES.forEach(x => {
    const to = E.STAGE_STATUS[x];
    if (to !== from) assert.ok(E.TRANSITIONS[from].includes(to), from + ' to ' + to);
  }));
});
const CMD = { today: '2026-11-05', projects: [{ id: 'PRJ-01', name: 'CRM' }, { id: 'PRJ-02', name: 'Website redesign' }, { id: 'PRJ-03', name: 'Website audit' }, { id: 'PRJ-04', name: 'CRM clean-up' }], employees: [{ email: 'rahul@suraasa.com', name: 'Rahul Verma' }] };
const parse = t => E.parseCommand(t, CMD);
test('the command example from the brief is read in full', () => {
  const r = parse('Assign the high priority website redesign task to rahul@suraasa.com under the CRM project with a deadline of 10 November 2026.');
  assert.deepStrictEqual(r.problems, []);
  assert.deepStrictEqual([r.task.name, r.task.ownerEmail, r.task.projectId, r.task.priority, r.task.due], ['website redesign', 'rahul@suraasa.com', 'PRJ-01', 'P1', '2026-11-10']);
});
test('the first brief\'s example finds everything but the title, and asks for it', () => {
  const r = parse('Assign a high-priority task to rahul@suraasa.com for the website redesign project. Deadline 10 November 2026.');
  assert.deepStrictEqual([r.task.projectId, r.task.priority, r.task.due], ['PRJ-02', 'P1', '2026-11-10']);
  assert.deepStrictEqual(r.problems, ['Add a task title.']);
});
test('commands never guess a person or a project', () => {
  let r = parse('Assign the logo task to rahul@example.com under the CRM project by tomorrow, P2');
  assert.ok(r.problems.some(x => /rahul@example\.com is not a registered/.test(x)));
  r = parse('Assign the logo task to Rahul under the CRM project by tomorrow, P2'); assert.strictEqual(r.task.ownerEmail, ''); assert.ok(r.problems.includes('Add the employee\'s email.'));
  r = parse('Assign the logo task to rahul@suraasa.com under the Website project by tomorrow, P2'); assert.strictEqual(r.task.projectId, ''); assert.ok(r.problems.some(x => /could be Website redesign or Website audit/.test(x)));
  r = parse('Assign the logo task to rahul@suraasa.com under the Finance project by tomorrow, P2'); assert.strictEqual(r.task.projectId, ''); assert.ok(r.problems.some(x => /No project you manage/.test(x)));
});
test('an exact project name beats a longer one that contains it', () => { assert.strictEqual(parse('Assign the x task to rahul@suraasa.com under the CRM project by tomorrow, P1').task.projectId, 'PRJ-01'); });
test('missing parts are listed, not invented', () => {
  const r = parse('Do the thing'); assert.strictEqual(r.task.priority, ''); assert.strictEqual(r.task.due, ''); assert.strictEqual(r.problems.length, 5);
});
test('dates: day first, relative words, and impossible dates are refused', () => {
  const due = t => parse('Assign the x task to rahul@suraasa.com under the CRM project, P1 ' + t).task.due;
  assert.strictEqual(due('by 10/11/2026'), '2026-11-10');
  assert.strictEqual(due('due 2026-12-25'), '2026-12-25');
  assert.strictEqual(due('by November 30, 2026'), '2026-11-30');
  assert.strictEqual(due('by 3rd Dec'), '2026-12-03');
  assert.strictEqual(due('by 2 Jan'), '2027-01-02');
  assert.strictEqual(due('by tomorrow'), '2026-11-06');
  assert.strictEqual(due('in 3 days'), '2026-11-08');
  assert.strictEqual(due('by Friday'), '2026-11-06');
  assert.strictEqual(due('by 31/02/2027'), '');
  assert.ok(parse('Assign the x task to rahul@suraasa.com under the CRM project, P1 by 1 January 2020').problems.includes('The deadline is in the past.'));
});
test('priority words and P numbers both work; "high" in a title is not a priority', () => {
  const pr = t => parse('Assign the x task to rahul@suraasa.com under the CRM project by tomorrow ' + t).task.priority;
  assert.strictEqual(pr('critical'), 'P0'); assert.strictEqual(pr('priority: low'), 'P3'); assert.strictEqual(pr('P2'), 'P2'); assert.strictEqual(pr('medium priority'), 'P2'); assert.strictEqual(pr('high school outreach'), '');
});
test('review cases: two dates, a bare "the project", and the email in a title are not guessed', () => {
  let r = parse('Assign the x task to rahul@suraasa.com under the CRM project, P1, by 20 November, kickoff on 3 December');
  assert.strictEqual(r.task.due, ''); assert.ok(r.problems.some(x => /more than one date/.test(x)));
  r = E.parseCommand('Assign the x task to rahul@suraasa.com for the project by tomorrow, P1', { today: '2026-11-05', projects: [{ id: 'P', name: 'Theatre Workshops' }], employees: CMD.employees });
  assert.strictEqual(r.task.projectId, ''); assert.ok(r.problems.includes('Choose a project.'));
  r = parse('Assign rahul@suraasa.com the logo task under the CRM project by tomorrow, P1'); assert.ok(!r.task.name.includes('@'), r.task.name);
  const long = 'a '.repeat(200000), t0 = Date.now(); parse(long); assert.ok(Date.now() - t0 < 500);
});
for (const r of results) console.log(r[0], r[1]);
console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
