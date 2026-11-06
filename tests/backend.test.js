// Runs the real apps-script/Code.gs against an in-memory Sheet. Run: node tests/backend.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createBackend } = require('./mock-gas');

function seedState() {
  const src = process.env.FIXTURE ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')).state : null;
  if (src) return JSON.parse(JSON.stringify(src));
  return new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8') + ';return buildSeed();')();
}
const results = [];
function test(name, fn) { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ' :: ' + e.message]); process.exitCode = 1; } }
const CLIENT = 'test.apps.googleusercontent.com';
function open() { const b = createBackend(); b.load(seedState()); return b; }
function secured() {
  const b = createBackend({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_REQUIRED: 'true', AUTH_DOMAIN: 'suraasa.com' } });
  // load data before sign-in rules apply
  b.props.set('AUTH_REQUIRED', 'false'); b.load(seedState()); b.props.set('AUTH_REQUIRED', 'true');
  b.addUser({ email: 'admin@suraasa.com', name: 'Admin', role: 'Administrator' });
  b.addUser({ email: 'hos@suraasa.com', name: 'Head of Sales', role: 'Project Owner' });
  b.addUser({ email: 'ak@suraasa.com', name: 'AK', role: 'Task Owner' });
  b.addUser({ email: 'view@suraasa.com', name: 'Viewer One', role: 'Viewer' });
  b.addUser({ email: 'gone@suraasa.com', name: 'Gone', role: 'Task Owner', active: false });
  return b;
}
const session = (b, e) => b.sessionFor(e).session;
const taskOf = (st, owner) => st.tasks.find(t => t.owner === owner && t.status !== 'Completed');

test('every record survives a round trip through the Sheet', () => {
  const b = open(); const s = seedState(); const st = b.post({ action: 'pull' }).state;
  for (const k of ['projects', 'tasks', 'risks', 'dependencies', 'decisions', 'actions', 'programs', 'roles']) assert.strictEqual(st[k].length, s[k].length, k);
  assert.strictEqual(st.projects[0].milestones.length, s.projects[0].milestones.length);
});
test('pull reports API 4 and adds system tabs without touching data tabs', () => {
  const b = open(); assert.strictEqual(b.get({ action: 'ping' }).api, 6);
  for (const t of ['Users', 'AuditLog', 'Trash', 'Snapshots', 'NotificationLog', 'WeeklyUpdates', 'Tasks']) assert.ok(b.ss.getSheetByName(t), t);
});
test('ping does not reveal the Sheet address or name', () => {
  const r = JSON.stringify(open().get({ action: 'ping' })); assert.ok(!/docs\.google|Test Sheet/.test(r));
});
test('a save changes only the record it names and records who, what and when', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const t = st.tasks[0];
  const r = b.post({ action: 'apply', actorName: 'AK', ops: [{ c: 'tasks', id: t.id, set: { status: 'In Progress' }, base: { status: t.status } }] });
  assert.ok(r.ok, JSON.stringify(r));
  const after = b.post({ action: 'pull' }).state;
  assert.strictEqual(after.tasks.find(x => x.id === t.id).status, 'In Progress');
  assert.strictEqual(after.tasks.find(x => x.id === t.id).updatedBy, 'AK');
  const a = after.audit.find(x => x.action === 'status_changed');
  assert.ok(a && a.actorName === 'AK' && a.oldValue === t.status && a.newValue === 'In Progress' && a.taskId === t.id && a.ts);
  assert.strictEqual(after.tasks.length, st.tasks.length);
});
test('two people changing different fields of one task both succeed', () => {
  const b = open(); const t = b.post({ action: 'pull' }).state.tasks[0];
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { status: 'In Progress' }, base: { status: t.status } }] }).ok);
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { priority: 'P0' }, base: { priority: t.priority } }] }).ok);
  const x = b.post({ action: 'pull' }).state.tasks.find(v => v.id === t.id);
  assert.ok(x.status === 'In Progress' && x.priority === 'P0');
});
test('two people changing the same field: the second is refused, nothing silently overwritten', () => {
  const b = open(); const t = b.post({ action: 'pull' }).state.tasks[0];
  assert.ok(b.post({ action: 'apply', actorName: 'A', ops: [{ c: 'tasks', id: t.id, set: { due: '2027-01-01' }, base: { due: t.due } }] }).ok);
  const r = b.post({ action: 'apply', actorName: 'B', ops: [{ c: 'tasks', id: t.id, set: { due: '2027-02-02' }, base: { due: t.due } }] });
  assert.ok(!r.ok && r.rejected[0].code === 'conflict' && r.rejected[0].field === 'due');
  assert.strictEqual(b.post({ action: 'pull' }).state.tasks.find(v => v.id === t.id).due, '2027-01-01');
});
test('two people adding notes at once are both kept', () => {
  const b = open(); const t = b.post({ action: 'pull' }).state.tasks[0];
  const n = (id, text) => ({ id, type: 'update', text, author: id, ts: '2026-11-02T10:00:00Z' });
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { notes: [n('a', 'one')] }, base: { notes: [] } }] }).ok);
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { notes: [n('b', 'two')] }, base: { notes: [] } }] }).ok);
  assert.strictEqual(b.post({ action: 'pull' }).state.tasks.find(v => v.id === t.id).notes.length, 2);
});
test('the same save sent twice is applied once', () => {
  const b = open(); const t = b.post({ action: 'pull' }).state.tasks[0];
  const body = { action: 'apply', requestId: 'r1', ops: [{ c: 'tasks', id: t.id, set: { priority: 'P3' }, base: { priority: t.priority } }] };
  const v1 = b.post(body).version; const v2 = b.post(body).version; assert.strictEqual(v1, v2);
  assert.strictEqual(b.post({ action: 'pull' }).state.audit.filter(a => a.requestId === 'r1').length, 1);
});
test('one bad record in a batch means nothing in the batch is written', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const t = st.tasks[0];
  const r = b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { priority: 'P3' }, base: { priority: t.priority } }, { c: 'tasks', id: 'T-NEW', create: true, rec: { id: 'T-NEW', name: 'x', projectId: 'NOPE', status: 'Not Started' } }] });
  assert.ok(!r.ok);
  assert.strictEqual(b.post({ action: 'pull' }).state.tasks.find(v => v.id === t.id).priority, t.priority);
});
test('orphan task, duplicate ID, bad progress, invalid date and bad status moves are refused', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const t = st.tasks.find(x => x.status === 'Not Started');
  const bad = o => assert.ok(!b.post({ action: 'apply', ops: [o] }).ok, JSON.stringify(o));
  bad({ c: 'tasks', id: 'X1', create: true, rec: { id: 'X1', name: 'a', projectId: 'NOPE', status: 'Not Started' } });
  bad({ c: 'tasks', id: t.id, create: true, rec: { id: t.id, name: 'a', projectId: t.projectId, status: 'Not Started' } });
  bad({ c: 'tasks', id: t.id, set: { progress: 150 }, base: { progress: t.progress } });
  bad({ c: 'tasks', id: t.id, set: { progress: 100 }, base: { progress: t.progress } });
  bad({ c: 'tasks', id: t.id, set: { due: 'tomorrow' }, base: { due: t.due } });
  bad({ c: 'tasks', id: t.id, set: { status: 'In Review' }, base: { status: t.status } });
  bad({ c: 'tasks', id: t.id, set: { status: 'Blocked' }, base: { status: t.status } });
  bad({ c: 'tasks', id: t.id, set: { status: 'Cancelled' }, base: { status: t.status } });
});
test('dependency loops are refused', () => {
  const b = open(); const [x, y] = b.post({ action: 'pull' }).state.tasks;
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: x.id, set: { dependsOn: [y.id] }, base: { dependsOn: [] } }] }).ok);
  const r = b.post({ action: 'apply', ops: [{ c: 'tasks', id: y.id, set: { dependsOn: [x.id] }, base: { dependsOn: [] } }] });
  assert.ok(!r.ok && /loop/.test(r.rejected[0].reason));
});
test('a deleted record goes to Trash, history stays, and it can be restored', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const t = st.tasks[0];
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, del: true }] }).ok);
  let s2 = b.post({ action: 'pull' }).state;
  assert.ok(!s2.tasks.some(x => x.id === t.id)); const tr = s2.trash.find(x => x.recordId === t.id); assert.ok(tr);
  assert.ok(s2.audit.some(a => a.action === 'deleted' && a.entityId === t.id));
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, create: true, rec: JSON.parse(tr.record), restoreOf: tr.trashId }] }).ok);
  s2 = b.post({ action: 'pull' }).state;
  assert.ok(s2.tasks.some(x => x.id === t.id) && !s2.trash.some(x => x.recordId === t.id) && s2.audit.some(a => a.action === 'deleted' && a.entityId === t.id));
});
test('an old site cannot wipe the Sheet by saving a near-empty copy', () => {
  const b = open(); const r = b.post({ action: 'push', state: { projects: [], tasks: [] } });
  assert.ok(!r.ok && /more than half/.test(r.error));
});
test('nested milestones change without touching other projects', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const p = st.projects[0]; const other = st.projects[1].milestones.length;
  const ms = p.milestones.concat([{ id: 'MS-N', name: 'New', due: '2026-12-01', status: 'Pending', ws: '' }]);
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { milestones: ms }, base: { milestones: p.milestones } }] }).ok);
  const s2 = b.post({ action: 'pull' }).state;
  assert.strictEqual(s2.projects[0].milestones.length, p.milestones.length + 1); assert.strictEqual(s2.projects[1].milestones.length, other);
});
test('progress snapshots are stored once per project per day', () => {
  const b = open(); const rows = [{ date: '2026-11-02', projectId: 'PRJ-01', progress: 10 }];
  assert.strictEqual(b.post({ action: 'snapshot', rows }).added, 1); assert.strictEqual(b.post({ action: 'snapshot', rows }).added, 0);
});
test('option lists now survive a save', () => {
  const b = open(); const options = { priorities: ['P0', 'P1'] };
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'options', doc: options }] }).ok);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b.post({ action: 'pull' }).state.options)), options);
});
// ---------- sign-in on ----------
test('with sign-in on, nothing can be read or changed without a session', () => {
  const b = secured();
  assert.ok(b.get({ action: 'pull' }).auth); assert.ok(b.post({ action: 'pull' }).auth);
  assert.ok(b.post({ action: 'apply', ops: [] }).auth); assert.ok(b.post({ action: 'push', state: seedState() }).auth);
  assert.ok(b.post({ action: 'pull', session: 'made-up' }).auth);
});
test('sign-in checks audience, domain, verification, expiry and the Users list', () => {
  const b = secured();
  const base = { aud: CLIENT, iss: 'https://accounts.google.com', hd: 'suraasa.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 600) };
  b.tokens['a.b.wrongaud'] = { ...base, aud: 'x', email: 'admin@suraasa.com' };
  b.tokens['a.b.wrongdom'] = { ...base, email: 'admin@gmail.com' };
  b.tokens['a.b.unverified'] = { ...base, email: 'admin@suraasa.com', email_verified: 'false' };
  b.tokens['a.b.expired'] = { ...base, email: 'admin@suraasa.com', exp: '1000' };
  b.tokens['a.b.stranger'] = { ...base, email: 'new@suraasa.com' };
  b.tokens['a.b.inactive'] = { ...base, email: 'gone@suraasa.com' };
  for (const t of ['wrongaud', 'wrongdom', 'unverified', 'expired', 'stranger', 'inactive', 'fake']) assert.ok(!b.post({ action: 'login', idToken: 'a.b.' + t }).ok, t);
  assert.ok(b.sessionFor('admin@suraasa.com').ok);
});
test('the author comes from the session, not from what the browser claims', () => {
  const b = secured(); const s = session(b, 'admin@suraasa.com'); const t = b.post({ action: 'pull', session: s }).state.tasks[0];
  b.post({ action: 'apply', session: s, actorName: 'Someone Else', ops: [{ c: 'tasks', id: t.id, set: { priority: 'P3' }, base: { priority: t.priority } }] });
  assert.strictEqual(b.post({ action: 'pull', session: s }).state.tasks.find(x => x.id === t.id).updatedBy, 'Admin');
});
test('a viewer can read but cannot change anything', () => {
  const b = secured(); const s = session(b, 'view@suraasa.com'); const st = b.post({ action: 'pull', session: s }).state; const t = st.tasks[0];
  assert.ok(st.tasks.length > 0 && !st.users);
  const r = b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { priority: 'P3' }, base: { priority: t.priority } }] });
  assert.ok(!r.ok && r.rejected[0].code === 'denied');
});
test('a task owner can update their task but not its scope, owner or dates', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com'); const st = b.post({ action: 'pull', session: s }).state; const t = st.tasks.find(x => x.owner === 'AK') || taskOf(st, 'AK');
  assert.ok(t, 'needs a task owned by AK');
  assert.ok(b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { progress: 40 }, base: { progress: t.progress } }] }).ok);
  for (const [f, v] of [['name', 'New'], ['owner', 'Me'], ['due', '2027-01-01'], ['projectId', 'PRJ-01'], ['criteria', 'x']]) {
    const r = b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { [f]: v }, base: { [f]: t[f] } }] });
    assert.ok(!r.ok && r.rejected[0].code === 'denied', f);
  }
  const other = b.post({ action: 'pull', session: session(b, 'admin@suraasa.com') }).state.tasks.find(x => x.owner === 'Head of Sales');
  assert.ok(!st.tasks.some(x => x.id === other.id), 'other people\'s tasks are not sent to an employee');
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: other.id, set: { progress: 10 }, base: { progress: other.progress } }] }).ok);
});
test('a project owner manages their own projects only', () => {
  const b = secured(); const s = session(b, 'hos@suraasa.com'); const st = b.post({ action: 'pull', session: s }).state;
  const mine = st.projects.find(p => p.accountable === 'Head of Sales'); const notMine = st.projects.find(p => p.accountable !== 'Head of Sales' && p.owner !== 'Head of Sales');
  const t = st.tasks.find(x => x.projectId === mine.id);
  assert.ok(b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { owner: 'AK' }, base: { owner: t.owner } }] }).ok);
  if (notMine) assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'projects', id: notMine.id, set: { name: 'x' }, base: { name: notMine.name } }] }).ok);
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'projects', id: mine.id, del: true }] }).ok);
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'options', doc: {} }] }).ok);
});
test('a restricted project cannot be reached by people outside it, even by direct request', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const st = b.post({ action: 'pull', session: ad }).state;
  const p = st.projects.find(x => !st.tasks.some(t => t.projectId === x.id && t.owner === 'AK') && !/AK/.test(x.owner + x.accountable + x.sponsor));
  assert.ok(b.post({ action: 'apply', session: ad, ops: [{ c: 'projects', id: p.id, set: { restricted: true }, base: {} }] }).ok);
  const s = session(b, 'ak@suraasa.com'); const seen = b.post({ action: 'pull', session: s }).state;
  assert.ok(!seen.projects.some(x => x.id === p.id) && !seen.tasks.some(t => t.projectId === p.id));
  const t = st.tasks.find(x => x.projectId === p.id);
  const r = b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { notes: [{ id: 'z', text: 'hi' }] }, base: {} }] });
  assert.ok(!r.ok && r.rejected[0].code === 'denied');
});
test('changing a role applies at once, and the last admin cannot be removed', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const s = session(b, 'ak@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: ad, ops: [{ c: 'users', id: 'ak@suraasa.com', rec: { name: 'AK', role: 'Viewer', active: true } }] }).ok);
  const t = b.post({ action: 'pull', session: s }).state.tasks.find(x => x.owner === 'AK');
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { progress: 5 }, base: { progress: t.progress } }] }).ok);
  assert.ok(!b.post({ action: 'apply', session: ad, ops: [{ c: 'users', id: 'admin@suraasa.com', rec: { name: 'Admin', role: 'Viewer', active: true } }] }).ok);
  assert.ok(b.post({ action: 'apply', session: ad, ops: [{ c: 'users', id: 'ak@suraasa.com', rec: { active: false } }] }).ok);
  assert.ok(b.post({ action: 'pull', session: s }).auth, 'deactivated user is out immediately');
});
test('a task needing review cannot be self-approved by its owner', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const s = session(b, 'ak@suraasa.com');
  const t = b.post({ action: 'pull', session: s }).state.tasks.find(x => x.owner === 'AK');
  const set = (ses, o) => b.post({ action: 'apply', session: ses, ops: [o] });
  assert.ok(set(ad, { c: 'tasks', id: t.id, set: { requiresReview: true }, base: {} }).ok);
  assert.ok(set(s, { c: 'tasks', id: t.id, set: { status: 'In Progress' }, base: { status: t.status } }).ok);
  assert.ok(!set(s, { c: 'tasks', id: t.id, set: { status: 'Completed', progress: 100 }, base: { status: 'In Progress', progress: t.progress } }).ok);
  assert.ok(set(s, { c: 'tasks', id: t.id, set: { status: 'In Review' }, base: { status: 'In Progress' } }).ok);
  assert.ok(!set(s, { c: 'tasks', id: t.id, set: { status: 'Completed', progress: 100 }, base: { status: 'In Review', progress: t.progress } }).ok);
  assert.ok(set(ad, { c: 'tasks', id: t.id, set: { status: 'Completed', progress: 100 }, base: { status: 'In Review', progress: t.progress } }).ok);
});
test('a milestone with open tasks cannot be marked complete', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const t = st.tasks.find(x => x.ms && x.status !== 'Completed'); const p = st.projects.find(x => x.id === t.projectId);
  const ms = JSON.parse(JSON.stringify(p.milestones)); ms.find(m => m.id === t.ms).status = 'Completed';
  const r = b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { milestones: ms }, base: { milestones: p.milestones } }] });
  assert.ok(!r.ok); assert.strictEqual(r.rejected[0].code, 'invalid');
});
test('a project with open tasks cannot be closed', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const p = st.projects.find(x => st.tasks.some(t => t.projectId === x.id && t.status !== 'Completed'));
  const r = b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { status: 'Completed' }, base: { status: p.status } }] });
  assert.ok(!r.ok); assert.match(r.rejected[0].reason, /open tasks/);
});
test('the task owner can ask for more time but cannot move the date', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com'); const hos = session(b, 'hos@suraasa.com');
  const st = b.post({ action: 'pull', session: s }).state;
  const t = st.tasks.find(x => x.owner === 'AK' && x.status !== 'Completed');
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { due: '2027-01-01' }, base: { due: t.due } }] }).ok);
  assert.ok(b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { extensionRequest: { to: '2027-01-01', reason: 'x' } }, base: {} }] }).ok);
  const r = b.post({ action: 'pull', session: s }).state.tasks.find(x => x.id === t.id);
  assert.strictEqual(r.extensionRequest.to, '2027-01-01');
  assert.ok(hos);
});
test('daily checks record each late item once and survive a rerun', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const t = st.tasks.find(x => x.status !== 'Completed');
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { due: '2024-01-01' }, base: { due: t.due } }] }).ok);
  const first = b.ctx.dailyChecks();
  assert.ok(first.added >= 1);
  assert.strictEqual(b.ctx.dailyChecks().added, 0);
  const au = b.post({ action: 'pull' }).state.audit.filter(a => a.action === 'task_overdue' && a.entityId === t.id);
  assert.strictEqual(au.length, 1); assert.strictEqual(au[0].actorName, 'System');
  assert.strictEqual(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { due: '2024-02-01' }, base: { due: '2024-01-01' } }] }).ok, true);
  assert.strictEqual(b.ctx.dailyChecks().added, 1, 'a new date that is also past counts as a new event');
});
test('finishing the last task completes the milestone, even for a task owner', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const s = session(b, 'ak@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const t = st.tasks.find(x => x.owner === 'AK' && x.ms && x.status === 'Not Started' && !x.requiresReview);
  const others = st.tasks.filter(x => x.ms === t.ms && x.id !== t.id && x.status !== 'Completed' && x.status !== 'Cancelled');
  const r0 = b.post({ action: 'apply', session: ad, ops: others.map(x => ({ c: 'tasks', id: x.id, set: { status: 'Completed', progress: 100 }, base: { status: x.status, progress: x.progress } })) });
  assert.ok(r0.ok || !others.length, JSON.stringify(r0.rejected));
  const r = b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { status: 'Completed', progress: 100 }, base: { status: t.status, progress: t.progress } }] });
  assert.ok(r.ok, JSON.stringify(r.rejected)); assert.strictEqual(r.refresh, true);
  const p = b.post({ action: 'pull', session: ad }).state.projects.find(x => x.id === t.projectId);
  assert.strictEqual(p.milestones.find(m => m.id === t.ms).status, 'Completed');
  const r2 = b.post({ action: 'apply', session: ad, ops: [{ c: 'tasks', id: t.id, set: { status: 'In Progress', progress: 50 }, base: { status: 'Completed', progress: 100 } }] });
  assert.ok(r2.ok);
  assert.notStrictEqual(b.post({ action: 'pull', session: ad }).state.projects.find(x => x.id === t.projectId).milestones.find(m => m.id === t.ms).status, 'Completed');
});
test('a save that finishes a task and its milestone together is accepted', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const t = st.tasks.find(x => x.ms && x.status === 'Not Started'); const p = st.projects.find(x => x.id === t.projectId);
  const left = st.tasks.filter(x => x.ms === t.ms && x.status !== 'Cancelled');
  const ms = JSON.parse(JSON.stringify(p.milestones)); ms.find(m => m.id === t.ms).status = 'Completed';
  const ops = [{ c: 'projects', id: p.id, set: { milestones: ms }, base: { milestones: p.milestones } }].concat(left.filter(x => x.status !== 'Completed').map(x => ({ c: 'tasks', id: x.id, set: { status: 'Completed', progress: 100 }, base: { status: x.status, progress: x.progress } })));
  const r = b.post({ action: 'apply', ops });
  assert.ok(r.ok, JSON.stringify(r.rejected));
  assert.ok(r.entries.some(e => /Milestone/.test(e.text)), 'milestone change is written in plain words');
});
// ---- from the independent review ----
const rowsOf = (b, tab) => b.ss.getSheetByName(tab).getLastRow();
test('tabs grow past the bottom of the grid instead of failing', () => {
  const b = open(); const au = b.ss.getSheetByName('AuditLog'); au.maxRows = au.getLastRow() + 1;
  const st = b.post({ action: 'pull' }).state; const t = st.tasks[0];
  for (let i = 1; i <= 4; i++) assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { progress: i }, base: { progress: i === 1 ? t.progress : i - 1 } }] }).ok, 'save ' + i);
  assert.ok(au.getMaxRows() > au.getLastRow());
  const tk = b.ss.getSheetByName('Tasks'); tk.maxRows = tk.getLastRow();
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: 'T-NEW', create: true, rec: { id: 'T-NEW', name: 'x', projectId: st.projects[0].id, status: 'Not Started' } }] }).ok);
});
test('rewriting milestones loses nothing even on a tab with no spare rows', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const p = st.projects.find(x => (x.milestones || []).length > 1);
  const total = st.projects.reduce((n, x) => n + (x.milestones || []).length, 0);
  const ms = b.ss.getSheetByName('Milestones'); ms.maxRows = ms.getLastRow();
  const list = p.milestones.concat([{ id: 'MS-NEW-1', name: 'New', status: 'Pending', due: '2027-01-01' }, { id: 'MS-NEW-2', name: 'New 2', status: 'Pending', due: '2027-01-02' }]);
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { milestones: list }, base: { milestones: p.milestones } }] }).ok);
  const after = b.post({ action: 'pull' }).state;
  assert.strictEqual(after.projects.reduce((n, x) => n + (x.milestones || []).length, 0), total + 2);
  st.projects.filter(x => x.id !== p.id).forEach(x => assert.strictEqual(after.projects.find(y => y.id === x.id).milestones.length, (x.milestones || []).length, x.id));
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { milestones: p.milestones.slice(0, 1) }, base: { milestones: list } }] }).ok);
  assert.strictEqual(b.post({ action: 'pull' }).state.projects.reduce((n, x) => n + (x.milestones || []).length, 0), total - p.milestones.length + 1);
});
test('the last row of a tab can be deleted', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const rk = b.ss.getSheetByName('Risks'); const n = rk.getLastRow();
  rk.maxRows = n;
  const ops = st.risks.slice(0, 12).map(r => ({ c: 'risks', id: r.id, del: true }));
  assert.ok(b.post({ action: 'apply', ops }).ok);
});
test('deleting a comment works, is recorded, and does not resend', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const p = st.projects[0];
  const c1 = { who: 'A', text: 'one', ts: '2026-01-01T00:00:00Z' }, c2 = { who: 'B', text: 'two', ts: '2026-01-02T00:00:00Z' };
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { comments: [c1, c2] }, base: { comments: [] } }] }).ok);
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { comments: [c2] }, base: { comments: [c1, c2] } }] }).ok);
  const s2 = b.post({ action: 'pull' }).state;
  assert.deepStrictEqual(s2.projects[0].comments.map(c => c.text), ['two']);
  assert.ok(s2.audit.some(a => a.action === 'comment_removed' && a.oldValue === 'one'), 'audit keeps the removed text');
});
test('removing a comment keeps one someone else just added', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const p = st.projects[0];
  const c1 = { who: 'A', text: 'one', ts: 't1' }, c2 = { who: 'B', text: 'two', ts: 't2' };
  b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { comments: [c1] }, base: { comments: [] } }] });
  b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { comments: [c1, c2] }, base: { comments: [c1] } }] });
  b.post({ action: 'apply', ops: [{ c: 'projects', id: p.id, set: { comments: [] }, base: { comments: [c1] } }] });
  assert.deepStrictEqual(b.post({ action: 'pull' }).state.projects[0].comments.map(c => c.text), ['two']);
});
test('a record too long for a cell is refused before anything is written', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const t = st.tasks[0], u = st.tasks[1];
  const v = b.post({ action: 'pull' }).version;
  const r = b.post({ action: 'apply', ops: [{ c: 'tasks', id: u.id, set: { progress: 7 }, base: { progress: u.progress } }, { c: 'tasks', id: t.id, set: { desc: 'x'.repeat(60000) }, base: { desc: t.desc } }] });
  assert.ok(!r.ok); assert.strictEqual(r.rejected[0].code, 'invalid');
  const s2 = b.post({ action: 'pull' });
  assert.strictEqual(s2.version, v); assert.strictEqual(+s2.state.tasks.find(x => x.id === u.id).progress, +u.progress || 0);
});
test('a long record can be deleted and restored whole', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const t = st.tasks[0];
  const notes = Array.from({ length: 150 }, (_, i) => ({ id: 'N' + i, type: 'comment', text: 'y'.repeat(200), author: 'A', ts: 't' }));
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { notes }, base: {} }] }).ok);
  const big = JSON.stringify(b.post({ action: 'pull' }).state.tasks.find(x => x.id === t.id)).length;
  b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, del: true }] });
  const tr = b.post({ action: 'pull' }).state.trash.find(x => x.recordId === t.id);
  assert.ok(tr.record.length >= big - 200); const rec = JSON.parse(tr.record);
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, create: true, rec, restoreOf: tr.trashId }] }).ok);
  const s2 = b.post({ action: 'pull' }).state;
  assert.strictEqual(s2.tasks.find(x => x.id === t.id).notes.length, 150);
  assert.ok(s2.audit.some(a => a.action === 'restored' && a.entityId === t.id));
});
test('an old-style whole-sheet save with an oversized cell wipes nothing', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state; const n = st.tasks.length;
  const bad = JSON.parse(JSON.stringify(st)); bad.tasks[0].desc = 'x'.repeat(60000);
  assert.ok(!b.post({ action: 'push', state: bad }).ok);
  assert.strictEqual(b.post({ action: 'pull' }).state.tasks.length, n);
});
test('setup keeps columns added by hand; a moved column stops saves', () => {
  const b = open(); const sh = b.ss.getSheetByName('Tasks');
  const w = sh.getLastColumn();
  sh.getRange(1, w + 1, 1, 1).setValues([['my notes']]); sh.getRange(2, w + 1, 1, 1).setValues([['keep me']]);
  b.ctx.setupSheet();
  assert.strictEqual(sh.getRange(2, w + 1, 1, 1).getValues()[0][0], 'keep me');
  const h = sh.cells[0], st = b.post({ action: 'pull' }).state, t = st.tasks[0];
  sh.cells.forEach(r => r.splice(2, 0, r === h ? 'inserted' : ''));
  const r = b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { progress: 3 }, base: { progress: t.progress } }] });
  assert.ok(!r.ok); assert.match(r.error, /columns/);
  b.ctx.setupSheet();
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { progress: 3 }, base: { progress: t.progress } }] }).ok);
  assert.strictEqual(b.post({ action: 'pull' }).state.tasks.length, st.tasks.length);
  const col = sh.cells[0].indexOf('my notes');
  assert.ok(col >= 0); assert.strictEqual(sh.cells[1][col], 'keep me');
});
function restricted() {
  const b = secured(); const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const sec = st.projects.find(x => x.owner !== 'AK' && x.owner !== 'Head of Sales' && x.accountable !== 'Head of Sales' && x.accountable !== 'AK' && !st.tasks.some(t => t.projectId === x.id && (t.owner === 'AK' || t.owner === 'Head of Sales')));
  const ops = [{ c: 'projects', id: sec.id, set: { restricted: true }, base: {} }];
  const own = st.projects.find(x => x.id !== sec.id);
  ops.push({ c: 'projects', id: own.id, set: { owner: 'Head of Sales' }, base: { owner: own.owner } });
  assert.ok(b.post({ action: 'apply', session: ad, ops }).ok);
  return { b, ad, sec, own, st, ak: session(b, 'ak@suraasa.com'), hos: session(b, 'hos@suraasa.com') };
}
test('a record ID in the body cannot point at another record', () => {
  const { b, sec, hos, ad } = restricted();
  const r = b.post({ action: 'apply', session: hos, ops: [{ c: 'projects', id: 'PRJ-NEW', create: true, rec: { id: sec.id, name: 'taken', owner: 'Head of Sales' } }] });
  assert.ok(r.ok, JSON.stringify(r.rejected));
  const st = b.post({ action: 'pull', session: ad }).state;
  assert.strictEqual(st.projects.find(x => x.id === sec.id).name, sec.name);
  assert.strictEqual(st.projects.find(x => x.id === 'PRJ-NEW').name, 'taken');
  const own = st.projects.find(x => x.owner === 'Head of Sales');
  b.post({ action: 'apply', session: hos, ops: [{ c: 'projects', id: own.id, set: { id: sec.id }, base: {} }] });
  assert.ok(b.post({ action: 'pull', session: ad }).state.projects.some(x => x.id === sec.id && x.name === sec.name));
});
test('a subtask cannot be used to get into a restricted project', () => {
  const { b, sec, ak, st } = restricted();
  const mine = st.tasks.find(t => t.owner === 'AK');
  const r = b.post({ action: 'apply', session: ak, ops: [{ c: 'tasks', id: 'X9', create: true, rec: { id: 'X9', name: 'x', projectId: sec.id, parent: mine.id, owner: 'AK', status: 'Not Started' } }] });
  assert.ok(!r.ok);
  assert.ok(!b.post({ action: 'pull', session: ak }).state.projects.some(x => x.id === sec.id));
});
test('a project owner cannot pull tasks out of a project they do not own', () => {
  const { b, own, st, hos } = restricted();
  const other = st.projects.find(x => x.id !== own.id && !x.restricted && x.owner !== 'Head of Sales' && x.accountable !== 'Head of Sales');
  const t = st.tasks.find(x => x.projectId === other.id);
  if (!t) return;
  const r = b.post({ action: 'apply', session: hos, ops: [{ c: 'tasks', id: t.id, set: { projectId: own.id, name: 'stolen' }, base: { projectId: t.projectId, name: t.name } }] });
  assert.ok(!r.ok);
});
test('deactivating a user works whatever case their email was typed in', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com');
  b.ss.getSheetByName('Users').getRange(2, 1, 1, 1).getValues();
  b.addUser({ email: 'Mixed.Case@suraasa.com', name: 'Mix', role: 'Task Owner' });
  const s = session(b, 'mixed.case@suraasa.com');
  assert.ok(b.post({ action: 'pull', session: s }).state);
  assert.ok(b.post({ action: 'apply', session: ad, ops: [{ c: 'users', id: 'mixed.case@suraasa.com', rec: { active: false } }] }).ok);
  assert.ok(!b.post({ action: 'pull', session: s }).state, 'locked out');
});
test('non-admins do not get activity text, restricted snapshots, or system rows', () => {
  const { b, sec, ak } = restricted();
  b.ctx.appendRows_('AuditLog', [['u', 't', 'x@suraasa.com', 'Sheet', 'tasks', 'H3', '', '', 'sheet_edit', '', 'old secret', 'new secret', 'Edited', '']]);
  b.ctx.appendRows_('Snapshots', [['2026-01-01', sec.id, '50', '1', '1', '0', '0', 'Red']]);
  const st = b.post({ action: 'pull', session: ak }).state;
  assert.ok(!st.audit.some(a => a.action === 'sheet_edit' || a.entityType === 'users'));
  assert.ok(!st.snapshots.some(r => r.projectId === sec.id));
  assert.strictEqual(st.activity.length, 0);
});
test('server stamps cannot be set from outside', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com');
  const t = b.post({ action: 'pull', session: s }).state.tasks.find(x => x.owner === 'AK');
  b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { originalDue: '2030-01-01', createdBy: 'CEO', progress: 4 }, base: { progress: t.progress } }] });
  const r = b.post({ action: 'pull', session: s }).state.tasks.find(x => x.id === t.id);
  assert.notStrictEqual(r.originalDue, '2030-01-01'); assert.notStrictEqual(r.createdBy, 'CEO');
});
test('notes can only be added as yourself, and changed only by their author or the project owner', () => {
  const { b, own, ak, hos, st, ad, sec } = restricted();
  const other = st.projects.find(x => x.id !== own.id && x.id !== sec.id && x.owner !== 'Head of Sales' && x.accountable !== 'Head of Sales');
  const t = st.tasks.find(x => x.projectId === other.id);
  assert.ok(b.post({ action: 'apply', session: ad, ops: [{ c: 'tasks', id: t.id, set: { owner: 'AK' }, base: { owner: t.owner } }] }).ok);
  const put = (ses, notes, base) => b.post({ action: 'apply', session: ses, ops: [{ c: 'tasks', id: t.id, set: { notes }, base: { notes: base } }] });
  assert.ok(!put(ak, [{ id: 'N1', text: 'forged', author: 'CEO', ts: 't' }], []).ok);
  const mine = { id: 'N2', text: 'mine', author: 'AK', ts: 't' };
  assert.ok(put(ak, [mine], []).ok);
  assert.ok(!put(hos, [Object.assign({}, mine, { text: 'changed' })], [mine]).ok, 'not on a project they own');
  assert.ok(!put(hos, [], [mine]).ok);
  assert.ok(put(ak, [Object.assign({}, mine, { text: 'fixed' })], [mine]).ok);
});
test('a comment cannot be aimed at another project', () => {
  const { b, sec, ad, own, hos } = restricted();
  b.post({ action: 'apply', session: hos, ops: [{ c: 'projects', id: own.id, set: { comments: [{ who: 'Head of Sales', text: 'aimed', ts: 't', projectId: sec.id }] }, base: {} }] });
  const st = b.post({ action: 'pull', session: ad }).state;
  assert.ok(!(st.projects.find(x => x.id === sec.id).comments || []).some(c => c.text === 'aimed'));
  assert.ok(st.projects.find(x => x.id === own.id).comments.some(c => c.text === 'aimed'));
});
test('a project owner cannot approve their own task on someone else\'s project', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const s = session(b, 'hos@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const t = st.tasks.find(x => x.owner === 'AK' && x.status === 'Not Started');
  const p = st.projects.find(x => x.id === t.projectId);
  assert.ok(b.post({ action: 'apply', session: ad, ops: [{ c: 'projects', id: p.id, set: { owner: 'AK', accountable: 'AK' }, base: { owner: p.owner, accountable: p.accountable } }, { c: 'tasks', id: t.id, set: { owner: 'Head of Sales', requiresReview: true, status: 'In Progress' }, base: { owner: t.owner, status: t.status } }] }).ok);
  assert.ok(b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { status: 'In Review' }, base: { status: 'In Progress' } }] }).ok);
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { status: 'Completed', progress: 100 }, base: { status: 'In Review', progress: t.progress } }] }).ok);
});
test('a save that would delete many records is refused', () => {
  const b = open(); const st = b.post({ action: 'pull' }).state;
  const r = b.post({ action: 'apply', ops: st.tasks.slice(0, 30).map(t => ({ c: 'tasks', id: t.id, del: true })) });
  assert.ok(!r.ok); assert.strictEqual(b.post({ action: 'pull' }).state.tasks.length, st.tasks.length);
});
test('every direct Sheet edit is logged, even inside the debounce window', () => {
  const b = open(); const sh = b.ss.getSheetByName('Tasks');
  const e = () => ({ range: sh.getRange(2, 2, 1, 1), oldValue: 'a', value: 'b', user: { getEmail: () => '' } });
  b.ctx.onEdit(e()); b.ctx.onEdit(e());
  assert.strictEqual(b.post({ action: 'pull' }).state.audit.filter(a => a.action === 'sheet_edit').length, 2);
});
test('employees get only their own tasks and what belongs to those projects', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const s = session(b, 'ak@suraasa.com');
  const all = b.post({ action: 'pull', session: ad }).state, st = b.post({ action: 'pull', session: s }).state;
  const own = all.tasks.filter(t => /(^|,\s*)AK(\s*,|$)/.test(t.owner || '') || /(^|,\s*)AK(\s*,|$)/.test(t.accountable || ''));
  assert.strictEqual(st.tasks.length, own.length);
  const pids = new Set(own.map(t => t.projectId));
  ['risks', 'dependencies', 'updates'].forEach(k => assert.ok(st[k].every(r => pids.has(r.projectId)), k));
  assert.ok(st.tasks.length < all.tasks.length && !st.users && !st.trash);
});
test('an employee can add a task for themselves, not for someone else', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com'); const pid = b.post({ action: 'pull', session: s }).state.projects[0].id;
  const add = (id, owner) => b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id, create: true, rec: { id, name: id, projectId: pid, owner, status: 'Not Started' } }] });
  assert.ok(add('E1', 'AK').ok); assert.ok(!add('E2', 'Head of Sales').ok);
});
test('management and employee are accepted as role names in the Users tab', () => {
  const b = secured(); b.addUser({ email: 'm@suraasa.com', name: 'M', role: 'management' }); b.addUser({ email: 'e@suraasa.com', name: 'E', role: 'Employee' });
  assert.strictEqual(b.post({ action: 'pull', session: session(b, 'm@suraasa.com') }).me.role, 'Administrator');
  assert.strictEqual(b.post({ action: 'pull', session: session(b, 'e@suraasa.com') }).me.role, 'Task Owner');
});
test('nothing is returned, and nothing can be saved, without a real session', () => {
  const b = secured(); const t = b.post({ action: 'pull', session: session(b, 'admin@suraasa.com') }).state.tasks[0];
  ['', 'sess_123_fake', 's1'].forEach(x => {
    assert.ok(!b.post({ action: 'pull', session: x }).state);
    assert.ok(!b.post({ action: 'apply', session: x, ops: [{ c: 'tasks', id: t.id, del: true }] }).ok);
    assert.ok(!b.post({ action: 'push', session: x, state: {} }).ok);
  });
  assert.ok(!b.get({ action: 'pull' }).state);
  assert.ok(!JSON.stringify(b.get({ action: 'ping' })).includes('spreadsheets'));
});
test('a conflict reply never reveals a task the person may not touch', () => {
  const b = secured(); const ad = session(b, 'admin@suraasa.com'); const s = session(b, 'ak@suraasa.com');
  const t = b.post({ action: 'pull', session: ad }).state.tasks.find(x => x.owner === 'Head of Sales');
  const r = b.post({ action: 'apply', session: s, ops: [{ c: 'tasks', id: t.id, set: { desc: 'x' }, base: { desc: 'wrong' } }] });
  assert.ok(!r.ok); assert.strictEqual(r.rejected[0].code, 'denied'); assert.strictEqual(r.rejected[0].current, null);
});
test('priority must be a real priority', () => {
  const b = open(); const t = b.post({ action: 'pull' }).state.tasks[0];
  assert.ok(!b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { priority: 'p1\" onmouseover=\"x' }, base: { priority: t.priority } }] }).ok);
});
test('employees get only a name for projects they have no tasks in', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com'); const st = b.post({ action: 'pull', session: s }).state;
  const with_ = new Set(st.tasks.map(t => t.projectId));
  st.projects.filter(p => !with_.has(p.id)).forEach(p => { assert.ok(p.name); assert.ok(!p.objective && !p.milestones.length && !p.raci.length && !p.owner, p.id); });
});
test('employees cannot comment on or update projects outside their work', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com'); const st = b.post({ action: 'pull', session: s }).state;
  const with_ = new Set(st.tasks.map(t => t.projectId)); const out = st.projects.find(p => !with_.has(p.id));
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'projects', id: out.id, set: { comments: [{ who: 'AK', text: 'x', ts: 't' }] }, base: {} }] }).ok);
  assert.ok(!b.post({ action: 'apply', session: s, ops: [{ c: 'updates', id: 'U-X', create: true, rec: { id: 'U-X', projectId: out.id, week: '2026-11-02' } }] }).ok);
});
test('an employee cannot write progress history', () => {
  const b = secured(); const s = session(b, 'ak@suraasa.com');
  assert.strictEqual(b.post({ action: 'snapshot', session: s, rows: [{ date: '2026-11-03', projectId: 'PRJ-01', active: 0 }] }).added, 0);
});
function team(o) {
  const b = createBackend(o); b.load(seedState());
  b.addUser({ email: 'manish@suraasa.com', name: 'Manish Pandey (Head of Sales)', role: 'management' });
  b.addUser({ email: 'akhand@suraasa.com', name: 'Akhand Mishra', role: 'employee' });
  b.addUser({ email: 'divya@suraasa.com', name: 'Divya', role: 'management' });
  b.addUser({ email: 'gone@suraasa.com', name: 'Gone Person', role: 'employee', active: false });
  return b;
}
const give = (b, t, owner, by, id) => b.post({ action: 'apply', actorName: by, requestId: id, ops: [{ c: 'tasks', id: t.id, set: { owner }, base: { owner: t.owner } }] });
test('management assigning a task emails the new owner and says who assigned it', () => {
  const b = team(); const t = b.post({ action: 'pull' }).state.tasks.find(x => x.owner !== 'Akhand Mishra');
  assert.ok(give(b, t, 'Akhand Mishra', 'Manish Pandey').ok);
  assert.strictEqual(b.mails.length, 1); const m = b.mails[0];
  assert.strictEqual(m.to, 'akhand@suraasa.com'); assert.strictEqual(m.subject, 'New Task Assigned - Suraasa Sales Control Tower'); assert.ok(m.body.includes(t.name)); assert.ok(m.body.includes('Assigned By: Manish Pandey')); assert.strictEqual(m.replyTo, 'manish@suraasa.com');
  assert.ok(b.post({ action: 'pull' }).state.audit.some(a => a.action === 'email_sent' && a.taskId === t.id));
});
test('a name in brackets finds the person: Head of Sales reaches Manish', () => {
  const b = team(); const t = b.post({ action: 'pull' }).state.tasks.find(x => x.owner !== 'Head of Sales');
  give(b, t, 'Head of Sales', 'Divya');
  assert.strictEqual(b.mails[0].to, 'manish@suraasa.com');
  assert.strictEqual(b.ctx.userByEmail_('manish@suraasa.com').name, 'Manish Pandey');
});
test('assigning a project emails its new owner', () => {
  const b = team(); const p = b.post({ action: 'pull' }).state.projects[0];
  b.post({ action: 'apply', actorName: 'Manish Pandey', ops: [{ c: 'projects', id: p.id, set: { owner: 'Divya' }, base: { owner: p.owner } }] });
  assert.strictEqual(b.mails.length, 1); assert.strictEqual(b.mails[0].subject, 'New Project Assigned - Suraasa Sales Control Tower');
});
test('a new task with an owner emails them', () => {
  const b = team(); const pid = b.post({ action: 'pull' }).state.projects[0].id;
  b.post({ action: 'apply', actorName: 'Divya', ops: [{ c: 'tasks', id: 'N1', create: true, rec: { id: 'N1', name: 'Fresh', projectId: pid, owner: 'Akhand Mishra', status: 'Not Started', due: '2026-12-01', priority: 'P1' } }] });
  assert.strictEqual(b.mails.length, 1); assert.ok(b.mails[0].body.includes('1 Dec 2026'));
});
test('bulk assignment is one email per person', () => {
  const b = team(); const ts = b.post({ action: 'pull' }).state.tasks.slice(0, 4);
  b.post({ action: 'apply', actorName: 'Divya', ops: ts.map(t => ({ c: 'tasks', id: t.id, set: { owner: 'Akhand Mishra' }, base: { owner: t.owner } })) });
  assert.strictEqual(b.mails.length, 1); assert.match(b.mails[0].subject, /^4 New Items Assigned/);
});
test('no email for other edits, self-assignment, employees, or inactive people', () => {
  const b = team(); const st = b.post({ action: 'pull' }).state; const t = st.tasks[0];
  b.post({ action: 'apply', actorName: 'Manish Pandey', ops: [{ c: 'tasks', id: t.id, set: { desc: 'x' }, base: { desc: t.desc } }] });
  give(b, st.tasks[1], 'Manish Pandey', 'Manish Pandey');
  give(b, st.tasks[2], 'Divya', 'Akhand Mishra');
  give(b, st.tasks[3], 'Gone Person', 'Manish Pandey');
  assert.strictEqual(b.mails.length, 0);
  assert.ok(b.post({ action: 'pull' }).state.audit.some(a => a.action === 'email_skipped' && /Gone Person/.test(a.text)));
});
test('a retry of the same save sends nothing twice', () => {
  const b = team(); const t = b.post({ action: 'pull' }).state.tasks[5];
  give(b, t, 'Akhand Mishra', 'Divya', 'R1'); give(b, t, 'Akhand Mishra', 'Divya', 'R1');
  assert.strictEqual(b.mails.length, 1);
});
test('a mail failure never stops the save, and is recorded', () => {
  for (const o of [{ mailFails: true }, { mailQuota: 0 }]) {
    const b = team(o); const t = b.post({ action: 'pull' }).state.tasks[6];
    assert.ok(give(b, t, 'Akhand Mishra', 'Divya').ok);
    const st = b.post({ action: 'pull' }).state;
    assert.strictEqual(st.tasks.find(x => x.id === t.id).owner, 'Akhand Mishra');
    assert.ok(st.audit.some(a => a.action === 'email_failed'));
  }
});
test('assignment emails can be turned off', () => {
  const b = team(); b.props.set('ASSIGN_EMAIL', 'off'); const t = b.post({ action: 'pull' }).state.tasks[7];
  give(b, t, 'Akhand Mishra', 'Divya'); assert.strictEqual(b.mails.length, 0);
});
test('email text cannot carry HTML from a task name', () => {
  const b = team(); const pid = b.post({ action: 'pull' }).state.projects[0].id;
  b.post({ action: 'apply', actorName: 'Divya', ops: [{ c: 'tasks', id: 'N2', create: true, rec: { id: 'N2', name: '<img src=x>', projectId: pid, owner: 'Akhand Mishra', status: 'Not Started' } }] });
  assert.ok(!b.mails[0].htmlBody.includes('<img'));
});
test('AK becomes Ankit Khanna everywhere, once, with no emails', () => {
  const b = team(); const st = seedState();
  const t = b.post({ action: 'pull' }).state.tasks; const [x, y, z] = t;
  b.post({ action: 'apply', actorName: 'Divya', ops: [
    { c: 'tasks', id: x.id, set: { owner: 'AK, Ankit Khanna' }, base: { owner: x.owner } },
    { c: 'tasks', id: y.id, set: { owner: 'AK, Divya, Ankit Khanna', accountable: 'TBD \u2014 AK or Ankit Khanna (confirm)' }, base: { owner: y.owner, accountable: y.accountable } },
    { c: 'tasks', id: z.id, set: { owner: 'MAK', desc: 'Confirm AK vs Ankit Khanna per item' }, base: { owner: z.owner, desc: z.desc } }] });
  b.mails.length = 0;
  assert.ok(b.ctx.replaceAkWithAnkitKhanna() > 0);
  const s = b.post({ action: 'pull' }).state; const by = id => s.tasks.find(q => q.id === id);
  assert.strictEqual(by(x.id).owner, 'Ankit Khanna');
  assert.strictEqual(by(y.id).owner, 'Ankit Khanna, Divya');
  assert.strictEqual(by(y.id).accountable, 'Ankit Khanna');
  assert.strictEqual(by(z.id).owner, 'MAK');
  assert.strictEqual(by(z.id).desc, 'Confirm with Ankit Khanna per item');
  assert.ok(!/\bAK\b/.test(JSON.stringify(s.tasks)));
  assert.strictEqual(b.mails.length, 0);
  assert.ok(s.audit.some(a => a.action === 'name_merged' && a.oldValue === 'AK, Ankit Khanna'));
  assert.strictEqual(b.ctx.replaceAkWithAnkitKhanna(), 0);
});
test('a sentence with a comma stays one item in a line-by-line list, and comma lists still split', () => {
  const b = open(), st = b.post({ action: 'pull' }).state, p = st.projects[0];
  p.assumptions = ['Managed here, not as a separate project'];
  p.metrics = ['Rate of 4%, then 7%', 'Second line'];
  p.flags = ['one', 'two'];
  b.load(st);
  const q = b.post({ action: 'pull' }).state.projects[0];
  assert.deepStrictEqual(q.assumptions, ['Managed here, not as a separate project']);
  assert.deepStrictEqual(q.metrics, ['Rate of 4%, then 7%', 'Second line']);
  assert.deepStrictEqual(q.flags, ['one', 'two']);
});
for (const r of results) console.log(r[0], r[1]);
console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
