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
for (const r of results) console.log(r[0], r[1]);
console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
