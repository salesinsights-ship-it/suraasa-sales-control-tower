// Assignment by email, notifications, sign-in and the upgrade of an existing Sheet.
// Runs the real apps-script/Code.gs on the simulated Sheet. Run: node tests/automation.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createBackend } = require('./mock-gas');

const results = [];
function test(name, fn) { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ' :: ' + e.message]); process.exitCode = 1; } }
const CLIENT = 'test.apps.googleusercontent.com';
const data = () => process.env.FIXTURE ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')).state : new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8') + ';return buildSeed();')();
const future = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** A company with sign-in on and every role present. */
function company(o = {}) {
  const b = createBackend(Object.assign({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_DOMAIN: 'suraasa.com' } }, o));
  b.load(data());
  [['boss@suraasa.com', 'Boss Lady', 'Super Admin'], ['mgr@suraasa.com', 'Manny Ger', 'Manager'], ['other@suraasa.com', 'Otto Manager', 'Manager'], ['rahul@suraasa.com', 'Rahul Verma', 'Employee'], ['rahul.k@suraasa.com', 'Rahul Kumar', 'Employee'], ['priya@suraasa.com', 'Priya Nair', 'Employee'], ['view@suraasa.com', 'Vera View', 'Viewer']].forEach(u => b.addUser({ email: u[0], name: u[1], role: u[2] }));
  b.addUser({ email: 'gone@suraasa.com', name: 'Gone Person', role: 'Employee', active: false });
  b.props.set('AUTH_REQUIRED', 'true');
  const pid = adminPull(b).state.projects[0].id;
  const s = e => b.sessionFor(e).session;
  b.setProjectOwner = (id, email) => { const a = s('boss@suraasa.com'); const p = b.post({ action: 'pull', session: a }).state.projects.find(x => x.id === id); return b.post({ action: 'apply', session: a, requestId: 'own-' + id + email, ops: [{ c: 'projects', id, set: { ownerEmail: email }, base: { ownerEmail: p.ownerEmail } }] }); };
  b.mails.length = 0;
  return { b, pid, s };
}
function adminPull(b) { b.props.set('AUTH_REQUIRED', 'false'); const r = b.post({ action: 'pull' }); b.props.set('AUTH_REQUIRED', 'true'); return r; }
const pull = (b, session) => b.post({ action: 'pull', session });
const assign = (b, session, pid, over = {}, id) => b.post({ action: 'assign', session, requestId: id || 'A-' + Math.random(), task: Object.assign({ name: 'Website redesign', desc: 'Rebuild the landing page', projectId: pid, ownerEmail: 'rahul@suraasa.com', priority: 'P1', due: future(5) }, over) });
const row = (b, tab, id) => { const sh = b.ss.getSheetByName(tab), n = sh.getLastRow(), w = sh.getLastColumn(); const head = sh.getRange(1, 1, 1, w).getValues()[0]; for (const r of sh.getRange(2, 1, n - 1, w).getValues()) if (r[head.indexOf('id')] === id) return Object.fromEntries(head.map((h, i) => [h, r[i]])); return null; };
const notifs = b => b.ctx.readNotifs_(9999);
const emails = b => notifs(b).filter(n => n.channel === 'email');
const edit = (b, session, id, set, base, requestId) => b.post({ action: 'apply', session, requestId: requestId || 'E-' + Math.random(), ops: [{ c: 'tasks', id, set, base }] });

// ---------- sign-in ----------
test('with nothing configured, every data route is closed', () => {
  const b = createBackend({ strict: true });
  assert.strictEqual(b.get({ action: 'ping' }).auth.required, true);
  assert.strictEqual(b.get({ action: 'pull' }).auth, true);
  assert.strictEqual(b.post({ action: 'pull' }).auth, true);
  assert.strictEqual(b.post({ action: 'apply', ops: [] }).auth, true);
  assert.strictEqual(b.post({ action: 'push', force: true, state: { projects: [], tasks: [] } }).auth, true);
  assert.strictEqual(b.post({ action: 'assign', task: {} }).auth, true);
  assert.strictEqual(b.post({ action: 'integration_status' }).auth, true);
  assert.ok(/not been set up/.test(b.post({ action: 'login', idToken: 'x.y.z' }).error));
});
test('AUTH_REQUIRED=false alone does not open the data: an old setting cannot leave it public', () => {
  const b = createBackend({ strict: true, props: { AUTH_REQUIRED: 'false' } });
  assert.strictEqual(b.get({ action: 'pull' }).auth, true);
});
test('the emergency switch ends by itself', () => {
  const b = createBackend({ strict: true, props: { AUTH_REQUIRED: 'false', AUTH_OFF_UNTIL: String(Date.now() + 60000) } });
  assert.ok(b.get({ action: 'pull' }).ok);
  b.props.set('AUTH_OFF_UNTIL', String(Date.now() - 1));
  assert.strictEqual(b.get({ action: 'pull' }).auth, true);
});
test('logout ends the session on the server', () => {
  const { b, s } = company(); const se = s('rahul@suraasa.com');
  assert.ok(pull(b, se).ok);
  assert.ok(b.post({ action: 'logout', session: se }).ok);
  assert.strictEqual(pull(b, se).auth, true);
});
test('a session past its 12 hour limit is refused and removed', () => {
  const { b, s } = company(); const se = s('rahul@suraasa.com');
  const key = 'sess:' + se, v = JSON.parse(b.cache.get(key));
  v.x = Date.now() - 1; b.cache.set(key, JSON.stringify(v));
  assert.strictEqual(pull(b, se).auth, true); assert.ok(!b.cache.has(key));
});
test('deactivating someone ends their access at their next request', () => {
  const { b, s } = company(); const se = s('rahul@suraasa.com'), a = s('boss@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'x1', ops: [{ c: 'users', id: 'rahul@suraasa.com', rec: { active: false } }] }).ok);
  assert.strictEqual(pull(b, se).auth, true);
  assert.ok(b.post({ action: 'login', idToken: b.token('rahul@suraasa.com') }).error.includes('no access'));
});
test('a token from the wrong issuer is refused', () => {
  const { b } = company(); const good = { aud: CLIENT, hd: 'suraasa.com', email: 'boss@suraasa.com', email_verified: 'true', exp: String(Date.now() / 1000 + 999) };
  b.tokens['a.b.c'] = Object.assign({}, good, { iss: 'https://evil.example' });
  assert.ok(/did not come from Google/.test(b.post({ action: 'login', idToken: 'a.b.c' }).error));
  b.tokens['a.b.d'] = good;
  assert.ok(/did not come from Google/.test(b.post({ action: 'login', idToken: 'a.b.d' }).error), 'the issuer is required, not optional');
});
test('Super Admin, Manager, Employee and Viewer are accepted in the Users tab', () => {
  const { b } = company(); const r = e => b.ctx.userByEmail_(e).role;
  assert.deepStrictEqual([r('boss@suraasa.com'), r('mgr@suraasa.com'), r('rahul@suraasa.com'), r('view@suraasa.com')], ['Administrator', 'Project Owner', 'Task Owner', 'Viewer']);
});

// ---------- assigning by email ----------
test('assigning by email creates one task with a new ID, in the Sheet, for that exact person', () => {
  const { b, pid, s } = company(); const before = pull(b, s('boss@suraasa.com')).state.tasks.length;
  const r = assign(b, s('boss@suraasa.com'), pid, { ownerEmail: '  RAHUL@suraasa.com ' });
  assert.ok(r.ok, r.error); assert.match(r.task.id, /^T-\d+$/);
  const st = pull(b, s('boss@suraasa.com')).state; assert.strictEqual(st.tasks.length, before + 1);
  const rowT = row(b, 'Tasks', r.task.id);
  assert.strictEqual(rowT.owner, 'Rahul Verma'); assert.strictEqual(rowT.ownerEmail, 'rahul@suraasa.com'); assert.strictEqual(rowT.assignedByEmail, 'boss@suraasa.com'); assert.strictEqual(rowT.priority, 'P1'); assert.ok(rowT.assignedAt);
  assert.strictEqual(r.employees[0].name, 'Rahul Verma');
});
test('unknown, inactive and merely similar emails are refused, and nothing is written', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), n = pull(b, a).state.tasks.length;
  assert.strictEqual(assign(b, a, pid, { ownerEmail: 'rahul@example.com' }).code, 'unknown_employee');
  assert.strictEqual(assign(b, a, pid, { ownerEmail: 'rahul' }).code, 'unknown_employee');
  assert.strictEqual(assign(b, a, pid, { ownerEmail: 'Rahul Verma' }).code, 'unknown_employee');
  assert.strictEqual(assign(b, a, pid, { ownerEmail: 'gone@suraasa.com' }).code, 'inactive_employee');
  assert.strictEqual(pull(b, a).state.tasks.length, n); assert.strictEqual(b.mails.length, 0);
});
test('a missing title, priority, deadline or project is refused, and a past deadline too', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  assert.strictEqual(assign(b, a, pid, { name: ' ' }).field, 'name');
  assert.strictEqual(assign(b, a, pid, { priority: 'High' }).field, 'priority');
  assert.strictEqual(assign(b, a, pid, { due: 'soon' }).field, 'due');
  assert.strictEqual(assign(b, a, 'PRJ-NOPE').field, 'projectId');
  assert.ok(/past/.test(assign(b, a, pid, { due: '2020-01-01' }).error));
});
test('the same confirmation sent twice makes one task and one email, even after the replay memory is gone', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  const one = assign(b, a, pid, {}, 'CONFIRM-1'); b.cache.forEach((v, k) => { if (k.startsWith('req:')) b.cache.delete(k); });
  const two = assign(b, a, pid, {}, 'CONFIRM-1');
  assert.strictEqual(one.task.id, two.task.id); assert.ok(two.duplicate); assert.strictEqual(b.mails.length, 1);
  assert.strictEqual(pull(b, a).state.tasks.filter(t => t.assignKey === 'CONFIRM-1').length, 1);
});
test('task IDs never repeat, even after a task is deleted', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const x = assign(b, a, pid).task.id;
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'del1', ops: [{ c: 'tasks', id: x, del: true }] }).ok);
  assert.notStrictEqual(assign(b, a, pid).task.id, x);
});
test('managers assign only on projects they manage; employees and viewers cannot assign', () => {
  const { b, pid, s } = company();
  assert.strictEqual(assign(b, s('mgr@suraasa.com'), pid).code, 'denied');
  assert.strictEqual(assign(b, s('rahul@suraasa.com'), pid).code, 'denied');
  assert.strictEqual(assign(b, s('view@suraasa.com'), pid).code, 'denied');
  assert.ok(b.setProjectOwner(pid, 'mgr@suraasa.com').ok);
  assert.ok(assign(b, s('mgr@suraasa.com'), pid).ok);
  assert.strictEqual(assign(b, s('other@suraasa.com'), pid).code, 'denied');
});
test('a project can name extra managers by email', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'm1', ops: [{ c: 'projects', id: pid, set: { managerEmails: ['other@suraasa.com'] }, base: {} }] }).ok);
  assert.ok(assign(b, s('other@suraasa.com'), pid).ok);
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'm2', ops: [{ c: 'projects', id: pid, set: { managerEmails: ['nobody@suraasa.com'] }, base: {} }] }).rejected);
});
test('setting an owner email through a normal save is checked the same way', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const t = assign(b, a, pid).task;
  const r = edit(b, a, t.id, { ownerEmail: 'rahul@example.com' }, { ownerEmail: t.ownerEmail });
  assert.ok(r.rejected && /not a registered employee/.test(r.rejected[0].reason));
  assert.strictEqual(row(b, 'Tasks', t.id).ownerEmail, 'rahul@suraasa.com');
});
test('older tasks owned by name keep working; a shared name is never guessed', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com');
  b.addUser({ email: 'manish@suraasa.com', name: 'Manish Pandey (Head of Sales)', role: 'Task Owner' });
  const st = pull(b, a).state, t = st.tasks[0];
  edit(b, a, t.id, { owner: 'Head of Sales' }, { owner: t.owner });
  assert.strictEqual(row(b, 'Tasks', t.id).ownerEmail, 'manish@suraasa.com');
  b.addUser({ email: 'second@suraasa.com', name: 'Someone (Head of Sales)', role: 'Task Owner' });
  const t2 = st.tasks[1]; edit(b, a, t2.id, { owner: 'Head of Sales' }, { owner: t2.owner });
  assert.strictEqual(row(b, 'Tasks', t2.id).ownerEmail, '');
});

// ---------- what each person can reach ----------
test('an employee cannot reach another employee\'s task by any request', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), r = s('rahul@suraasa.com'), p = s('priya@suraasa.com');
  const t = assign(b, a, pid, { name: 'Private to Rahul' }).task;
  assert.ok(pull(b, r).state.tasks.some(x => x.id === t.id));
  assert.ok(!JSON.stringify(pull(b, p).state).includes('Private to Rahul'));
  const write = edit(b, p, t.id, { status: 'In Progress' }, { status: 'Not Started' });
  assert.ok(write.rejected); assert.strictEqual(write.rejected[0].current, null);
  assert.strictEqual(row(b, 'Tasks', t.id).status, 'Not Started');
  const del = b.post({ action: 'apply', session: p, requestId: 'd', ops: [{ c: 'tasks', id: t.id, del: true }] }); assert.ok(del.rejected);
});
test('someone named the same as an employee gets nothing from a task owned by email', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  const t = assign(b, a, pid).task;
  b.addUser({ email: 'twin@suraasa.com', name: 'Rahul Verma', role: 'Employee' });
  assert.ok(!pull(b, s('twin@suraasa.com')).state.tasks.some(x => x.id === t.id));
  assert.ok(edit(b, s('twin@suraasa.com'), t.id, { progress: 50 }, { progress: 0 }).rejected);
});
test('an employee cannot change who owns a task, or stamp who assigned it', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), r = s('rahul@suraasa.com'); const t = assign(b, a, pid).task;
  assert.ok(edit(b, r, t.id, { ownerEmail: 'priya@suraasa.com' }, { ownerEmail: t.ownerEmail }).rejected);
  edit(b, r, t.id, { assignedBy: 'Fake', assignedByEmail: 'fake@suraasa.com' }, {});
  assert.strictEqual(row(b, 'Tasks', t.id).assignedByEmail, 'boss@suraasa.com');
});
test('the directory goes to managers and Super Admins only, and never to employees or viewers', () => {
  const { b, s } = company();
  assert.ok(pull(b, s('mgr@suraasa.com')).state.directory.some(u => u.email === 'priya@suraasa.com'));
  assert.ok(pull(b, s('boss@suraasa.com')).state.directory.length);
  assert.strictEqual(pull(b, s('rahul@suraasa.com')).state.directory, undefined);
  assert.strictEqual(pull(b, s('view@suraasa.com')).state.directory, undefined);
  assert.strictEqual(pull(b, s('mgr@suraasa.com')).state.users, undefined);
  assert.ok(!pull(b, s('mgr@suraasa.com')).state.directory.some(u => u.email === 'gone@suraasa.com'));
});
test('only a Super Admin reaches integrations, retries, resends and test emails', () => {
  const { b, s } = company();
  for (const who of ['mgr@suraasa.com', 'rahul@suraasa.com', 'view@suraasa.com']) for (const action of ['integration_status', 'notification_retry', 'notification_resend', 'test_email']) assert.strictEqual(b.post({ action, session: s(who), id: 'x' }).code, 'denied', who + action);
  assert.strictEqual(b.post({ action: 'notification_log', session: s('rahul@suraasa.com') }).code, 'denied');
  assert.strictEqual(b.post({ action: 'notification_log', session: s('view@suraasa.com') }).code, 'denied');
});
test('a manager sees notices for their own projects only, and no one receives the stored message body', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); assign(b, a, pid);
  assert.strictEqual(b.post({ action: 'notification_log', session: s('mgr@suraasa.com') }).rows.length, 0);
  b.setProjectOwner(pid, 'mgr@suraasa.com');
  const log = b.post({ action: 'notification_log', session: s('mgr@suraasa.com') }).rows; assert.ok(log.length);
  assert.ok(log.every(r => r.payload === undefined && r.dedupeKey === undefined));
});
test('one person\'s request ID cannot fetch another person\'s reply', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const t = assign(b, a, pid).task;
  edit(b, a, t.id, { desc: 'Secret plan' }, { desc: t.desc }, 'SHARED');
  const r = b.post({ action: 'apply', session: s('priya@suraasa.com'), requestId: 'SHARED', ops: [{ c: 'tasks', id: t.id, set: { progress: 1 }, base: {} }] });
  assert.ok(!JSON.stringify(r).includes('Secret plan')); assert.ok(r.rejected);
});
test('pull no longer sends the connection settings', () => {
  const { b, s } = company(); assert.strictEqual(pull(b, s('boss@suraasa.com')).state.meta.sync, undefined);
});

// ---------- emails ----------
test('the assignment email carries everything the brief asks for', () => {
  const { b, pid, s } = company(); const t = assign(b, s('boss@suraasa.com'), pid, { name: 'Quarterly plan', desc: 'Write the plan', due: '2030-11-10' }).task;
  const m = b.mails[0];
  assert.strictEqual(m.to, 'rahul@suraasa.com'); assert.strictEqual(m.subject, 'New Task Assigned - Suraasa Sales Control Tower'); assert.strictEqual(m.replyTo, 'boss@suraasa.com');
  for (const text of ['Hello Rahul Verma', 'A new task has been assigned to you.', 'Task: Quarterly plan', 'Task ID: ' + t.id, 'Priority: High (P1)', 'Assigned By: Boss Lady', 'Deadline: 10 Nov 2030', 'Write the plan', '#task=' + t.id]) assert.ok(m.body.includes(text), text);
  assert.ok(m.htmlBody.includes('View Task')); assert.ok(m.htmlBody.includes('#task=' + t.id));
  const proj = pull(b, s('boss@suraasa.com')).state.projects.find(p => p.id === pid);
  assert.ok(m.body.includes(proj.name));
});
test('email text is escaped, in every field a person can type', () => {
  const { b, pid, s } = company(); assign(b, s('boss@suraasa.com'), pid, { name: '<img src=x onerror=1>', desc: '"><script>alert(1)</script>' });
  assert.ok(!/<img src=x|<script>/.test(b.mails[0].htmlBody));
});
test('reassigning emails the new owner, tells the old owner in the app, and is logged', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const t = assign(b, a, pid).task; b.mails.length = 0;
  const r = edit(b, a, t.id, { ownerEmail: 'priya@suraasa.com' }, { ownerEmail: 'rahul@suraasa.com' });
  assert.ok(r.ok); assert.strictEqual(b.mails.length, 1); assert.strictEqual(b.mails[0].to, 'priya@suraasa.com'); assert.strictEqual(b.mails[0].subject, 'Task Reassigned to You - Suraasa Sales Control Tower');
  assert.strictEqual(row(b, 'Tasks', t.id).owner, 'Priya Nair');
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'owner_changed' && x.taskId === t.id && x.oldValue === 'Rahul Verma' && x.newValue === 'Priya Nair'));
  assert.ok(pull(b, s('priya@suraasa.com')).state.tasks.some(x => x.id === t.id));
  assert.ok(!pull(b, s('rahul@suraasa.com')).state.tasks.some(x => x.id === t.id));
});
test('project assignment, completion, review and manager comments each notify the right people', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), r = s('rahul@suraasa.com'), m = s('mgr@suraasa.com');
  b.setProjectOwner(pid, 'mgr@suraasa.com');
  assert.ok(b.mails.some(x => x.to === 'mgr@suraasa.com' && /New Project Assigned/.test(x.subject))); b.mails.length = 0;
  const t = assign(b, m, pid).task; b.mails.length = 0;
  edit(b, m, t.id, { notes: [{ id: 'n1', type: 'comment', text: 'Please start', author: 'Manny Ger', ts: '2026-11-05T00:00:00Z' }] }, { notes: [] });
  assert.strictEqual(b.mails.length, 1); assert.strictEqual(b.mails[0].to, 'rahul@suraasa.com'); assert.match(b.mails[0].subject, /^New Comment/); assert.ok(b.mails[0].body.includes('Please start')); b.mails.length = 0;
  edit(b, r, t.id, { status: 'In Progress' }, { status: 'Not Started' }); assert.strictEqual(b.mails.length, 0);
  edit(b, r, t.id, { status: 'In Review' }, { status: 'In Progress' });
  assert.ok(b.mails.some(x => x.to === 'mgr@suraasa.com' && /Review Requested/.test(x.subject))); assert.ok(!b.mails.some(x => x.to === 'rahul@suraasa.com')); b.mails.length = 0;
  edit(b, r, t.id, { status: 'Completed', completedAt: '2026-11-05', progress: 100 }, { status: 'In Review', progress: 0 });
  assert.ok(b.mails.some(x => x.to === 'mgr@suraasa.com' && /^Task Completed/.test(x.subject)));
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'status_changed' && x.newValue === 'Completed'));
});
test('an employee comment is not sent to the owner as a manager comment', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), r = s('rahul@suraasa.com'); const t = assign(b, a, pid).task; b.mails.length = 0;
  edit(b, r, t.id, { notes: [{ id: 'n2', type: 'comment', text: 'Started', author: 'Rahul Verma', ts: '2026-11-05T00:00:00Z' }] }, { notes: [] });
  assert.strictEqual(b.mails.length, 0);
});
test('every assignment leaves one email row, one in-app row and an audit trail', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const r = assign(b, a, pid);
  const rows = notifs(b).filter(n => n.taskId === r.task.id);
  assert.deepStrictEqual(rows.map(x => x.channel).sort(), ['email', 'in-app']);
  const e = rows.find(x => x.channel === 'email');
  assert.strictEqual(e.deliveryStatus, 'accepted'); assert.strictEqual(e.eventType, 'task_assigned'); assert.strictEqual(e.recipientEmail, 'rahul@suraasa.com'); assert.ok(e.notificationId && e.ts);
  assert.ok(r.notified.some(n => n.channel === 'email' && n.deliveryStatus === 'accepted'));
  const audit = pull(b, a).state.audit.filter(x => x.taskId === r.task.id).map(x => x.action);
  for (const act of ['created', 'task_assigned', 'email_sent']) assert.ok(audit.includes(act), act);
  assert.ok(pull(b, a).state.audit.find(x => x.action === 'email_sent').text.includes('not confirmed'));
});
test('a failed email keeps the task, waits, retries and then succeeds; it is never reported as sent early', () => {
  let down = true; const { b, pid, s } = company({ mailFails: () => down }); const a = s('boss@suraasa.com');
  const r = assign(b, a, pid); assert.ok(r.ok);
  assert.ok(row(b, 'Tasks', r.task.id));
  let e = emails(b).find(x => x.taskId === r.task.id);
  assert.strictEqual(e.deliveryStatus, 'failed'); assert.strictEqual(e.attempts, '1'); assert.ok(e.nextAttemptAt); assert.match(e.errorDetails, /mail is down/);
  assert.ok(r.notified.some(n => n.deliveryStatus === 'failed'));
  down = false;
  b.ctx.processNotifications(); assert.strictEqual(b.mails.length, 0, 'retry waits for its time');
  const sh = b.ss.getSheetByName('NotificationLog'); sh.getRange(e._row, b.ctx.NOTIF_COLS.indexOf('nextAttemptAt') + 1).setValue(new Date(Date.now() - 1000).toISOString());
  b.ctx.processNotifications(); assert.strictEqual(b.mails.length, 1);
  e = emails(b).find(x => x.taskId === r.task.id); assert.strictEqual(e.deliveryStatus, 'accepted'); assert.strictEqual(e.attempts, '2');
  b.ctx.processNotifications(); assert.strictEqual(b.mails.length, 1, 'never sent twice');
});
test('after five failures an email stops retrying and a Super Admin can restart it', () => {
  let down = true; const { b, pid, s } = company({ mailFails: () => down }); const a = s('boss@suraasa.com'); const r = assign(b, a, pid);
  const col = b.ctx.NOTIF_COLS.indexOf('nextAttemptAt') + 1, sh = b.ss.getSheetByName('NotificationLog');
  for (let i = 0; i < 6; i++) { const e = emails(b).find(x => x.taskId === r.task.id); if (e.deliveryStatus === 'failed') sh.getRange(e._row, col).setValue(new Date(Date.now() - 1000).toISOString()); b.ctx.processNotifications(); }
  const e = emails(b).find(x => x.taskId === r.task.id);
  assert.strictEqual(e.deliveryStatus, 'abandoned'); assert.strictEqual(e.attempts, '5');
  down = false;
  assert.ok(b.post({ action: 'notification_retry', session: a }).requeued >= 1);
  assert.strictEqual(emails(b).find(x => x.taskId === r.task.id).deliveryStatus, 'accepted'); assert.strictEqual(b.mails.length, 1);
});
test('the daily email limit is a retry, not a lost email', () => {
  const { b, pid, s } = company({ mailQuota: 0 }); const r = assign(b, s('boss@suraasa.com'), pid);
  const e = emails(b).find(x => x.taskId === r.task.id); assert.strictEqual(e.deliveryStatus, 'failed'); assert.match(e.errorDetails, /daily email limit/);
});
test('a Super Admin can resend a sent email; it is logged as its own row', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const r = assign(b, a, pid);
  const e = emails(b).find(x => x.taskId === r.task.id); b.mails.length = 0;
  assert.ok(b.post({ action: 'notification_resend', session: a, id: e.notificationId }).ok);
  assert.strictEqual(b.mails.length, 1); assert.strictEqual(emails(b).filter(x => x.taskId === r.task.id).length, 2);
});
test('until someone goes live, every email goes to the owner of the script and never to an employee', () => {
  const { b, pid, s } = company({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_DOMAIN: 'suraasa.com', EMAIL_MODE: 'test' } });
  const r = assign(b, s('boss@suraasa.com'), pid);
  assert.strictEqual(b.mails[0].to, 'owner@suraasa.com'); assert.ok(b.mails[0].subject.startsWith('[TEST for rahul@suraasa.com]'));
  assert.ok(r.notified.find(n => n.channel === 'email').errorDetails.includes('Test mode'));
  const fresh = createBackend({ strict: true, props: { AUTH_CLIENT_ID: CLIENT } }); assert.strictEqual(fresh.ctx.emailMode_().mode, 'test');
});
test('turning emails off sends nothing but still records the event', () => {
  const { b, pid, s } = company(); b.props.set('ASSIGN_EMAIL', 'off'); const r = assign(b, s('boss@suraasa.com'), pid);
  assert.strictEqual(b.mails.length, 0); assert.strictEqual(emails(b).find(x => x.taskId === r.task.id).deliveryStatus, 'skipped');
});
test('reminders: one email per person per day, not repeated on a rerun, and overdue comes back after a week', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  const t1 = assign(b, a, pid, { due: future(1) }).task, t2 = assign(b, a, pid, { name: 'Second', due: future(3) }).task, t3 = assign(b, a, pid, { name: 'Third', due: future(20) }).task;
  const sh = b.ss.getSheetByName('Tasks'), late = assign(b, a, pid, { name: 'Late one', due: future(9) }).task;
  sh.getRange(b.ctx.rowOfId_(sh, 1, late.id), b.ctx.SCHEMA.find(x => x.key === 'tasks').cols.indexOf('due') + 1).setValue(future(-2));
  b.mails.length = 0;
  assert.ok(b.ctx.dailyChecks().ok);
  assert.strictEqual(b.mails.length, 1, 'one digest'); assert.strictEqual(b.mails[0].to, 'rahul@suraasa.com'); assert.match(b.mails[0].subject, /^3 Tasks Need Your Attention/);
  assert.ok(b.mails[0].body.includes(t1.name)); assert.ok(b.mails[0].body.includes('Late one')); assert.ok(!b.mails[0].body.includes(t3.name)); assert.ok(b.mails[0].body.includes(t2.id));
  b.ctx.dailyChecks(); assert.strictEqual(b.mails.length, 1, 'rerun adds nothing');
});
test('reminders skip people who are not registered, and finished work', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), t = assign(b, a, pid, { due: future(1) }).task;
  edit(b, a, t.id, { status: 'Completed', completedAt: '2026-11-05' }, { status: 'Not Started' }); b.mails.length = 0;
  b.ctx.dailyChecks(); assert.strictEqual(b.mails.filter(m => m.body.includes(t.id)).length, 0);
});

// ---------- Sheet ----------
test('every change reaches the same Sheet row and the audit log; no duplicate rows', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const t = assign(b, a, pid).task;
  const count = () => b.ss.getSheetByName('Tasks').getRange(2, 1, b.ss.getSheetByName('Tasks').getLastRow() - 1, 1).getValues().filter(r => r[0] === t.id).length;
  edit(b, a, t.id, { priority: 'P0' }, { priority: 'P1' }); assert.strictEqual(row(b, 'Tasks', t.id).priority, 'P0');
  edit(b, a, t.id, { due: future(9) }, { due: t.due }); assert.strictEqual(row(b, 'Tasks', t.id).due, future(9));
  edit(b, a, t.id, { status: 'In Progress' }, { status: 'Not Started' }); assert.strictEqual(row(b, 'Tasks', t.id).status, 'In Progress');
  edit(b, a, t.id, { progress: 60 }, { progress: 0 }); assert.strictEqual(row(b, 'Tasks', t.id).progress, 60);
  edit(b, a, t.id, { status: 'Completed', progress: 100, completedAt: '2026-11-05' }, { status: 'In Progress', progress: 60 }); assert.strictEqual(row(b, 'Tasks', t.id).status, 'Completed'); assert.strictEqual(row(b, 'Tasks', t.id).completedAt, '2026-11-05');
  assert.strictEqual(count(), 1);
  const acts = pull(b, a).state.audit.filter(x => x.taskId === t.id).map(x => x.action);
  for (const x of ['priority_changed', 'deadline_changed', 'status_changed', 'progress_changed']) assert.ok(acts.includes(x), x);
});
test('two managers changing one field: the second is refused and told; different fields both land', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); b.setProjectOwner(pid, 'mgr@suraasa.com'); const m = s('mgr@suraasa.com'); const t = assign(b, a, pid).task;
  assert.ok(edit(b, a, t.id, { priority: 'P0' }, { priority: 'P1' }).ok);
  const r = edit(b, m, t.id, { priority: 'P3' }, { priority: 'P1' });
  assert.strictEqual(r.rejected[0].code, 'conflict'); assert.strictEqual(r.rejected[0].current, 'P0'); assert.strictEqual(row(b, 'Tasks', t.id).priority, 'P0');
  assert.ok(edit(b, m, t.id, { desc: 'New words' }, { desc: t.desc }).ok); assert.strictEqual(row(b, 'Tasks', t.id).priority, 'P0');
});
test('two assignments in a row get different IDs and neither overwrites the other', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  const x = assign(b, a, pid, { name: 'One' }).task, y = assign(b, a, pid, { name: 'Two', ownerEmail: 'priya@suraasa.com' }).task;
  assert.notStrictEqual(x.id, y.id); assert.strictEqual(row(b, 'Tasks', x.id).name, 'One'); assert.strictEqual(row(b, 'Tasks', y.id).name, 'Two');
});
test('if the Sheet fails partway the save reports it, and a notification problem never stops a save', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const t = assign(b, a, pid).task;
  const sh = b.ss.getSheetByName('Tasks'), real = sh.getRange.bind(sh); let boom = true;
  sh.getRange = (r, c, nr, nc) => { if (boom && r > 1 && nr === 1 && nc > 20) { boom = false; throw new Error('Service unavailable'); } return real(r, c, nr, nc); };
  const r = edit(b, a, t.id, { desc: 'During outage' }, { desc: t.desc }); assert.ok(!r.ok); assert.match(r.error, /Only part of this save/);
  sh.getRange = real;
  assert.ok(edit(b, a, t.id, { desc: 'After outage' }, { desc: t.desc }).ok); assert.strictEqual(row(b, 'Tasks', t.id).desc, 'After outage');
  const n = b.ss.getSheetByName('NotificationLog'); delete b.ss.sheets.NotificationLog; const orig = b.ctx.queue_;
  b.ctx.queue_ = () => { throw new Error('log tab is gone'); };
  assert.ok(assign(b, a, pid, { name: 'Still saved' }).ok); b.ctx.queue_ = orig; b.ss.sheets.NotificationLog = n;
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'notification_error'));
});
test('integration status reports the truth and holds no secrets', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); assign(b, a, pid); b.props.set('AUTH_CLIENT_SECRET_TEST', 'hush');
  const r = b.post({ action: 'integration_status', session: a });
  assert.strictEqual(r.api, 5); assert.strictEqual(r.auth.required, true); assert.strictEqual(r.auth.clientIdSet, true); assert.strictEqual(r.email.mode, 'live'); assert.strictEqual(r.email.accepted, 1); assert.strictEqual(r.automation.retry, false); assert.strictEqual(r.sheet.problems.length, 0);
  assert.ok(!JSON.stringify(r).includes('hush'));
});
test('a test email goes only to the person who pressed the button', () => {
  const { b, s } = company(); const r = b.post({ action: 'test_email', session: s('boss@suraasa.com'), to: 'rahul@suraasa.com' });
  assert.ok(r.ok); assert.strictEqual(b.mails[0].to, 'boss@suraasa.com');
});

// ---------- employee directory ----------
test('a new employee gets an ID; a Super Admin can edit and deactivate; IDs never change', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com');
  const add = b.post({ action: 'apply', session: a, requestId: 'u1', ops: [{ c: 'users', id: 'New.Joiner@Suraasa.com', rec: { name: 'New Joiner', role: 'Task Owner', department: 'Sales', designation: 'Setter', managerEmail: 'mgr@suraasa.com', joiningDate: '2026-11-01' } }] });
  assert.ok(add.ok, JSON.stringify(add));
  let u = b.ctx.userByEmail_('new.joiner@suraasa.com'); assert.match(u.employeeId, /^EMP-\d{3}$/); assert.strictEqual(u.department, 'Sales'); assert.strictEqual(u.managerEmail, 'mgr@suraasa.com'); const id = u.employeeId;
  b.post({ action: 'apply', session: a, requestId: 'u2', ops: [{ c: 'users', id: 'new.joiner@suraasa.com', rec: { designation: 'Senior Setter', aliases: 'NJ, Newbie', active: false, employeeId: 'EMP-999', addedBy: 'Fake' } }] });
  u = b.ctx.userByEmail_('new.joiner@suraasa.com'); assert.strictEqual(u.designation, 'Senior Setter'); assert.strictEqual(u.employeeId, id); assert.strictEqual(u.addedBy, 'Boss Lady'); assert.strictEqual(u.aliases.join(), 'NJ,Newbie'); assert.strictEqual(u.rawName, 'New Joiner (NJ, Newbie)'); assert.strictEqual(u.active, false);
});
test('employees must have an official address, a name and a real manager', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com');
  const tryUser = (id, rec) => b.post({ action: 'apply', session: a, requestId: 'v' + Math.random(), ops: [{ c: 'users', id, rec }] });
  assert.ok(tryUser('x@gmail.com', { name: 'X', role: 'Task Owner' }).rejected);
  assert.ok(tryUser('y@suraasa.com', { name: ' ', role: 'Task Owner' }).rejected);
  assert.ok(tryUser('z@suraasa.com', { name: 'Z', role: 'Task Owner', managerEmail: 'ghost@suraasa.com' }).rejected);
  assert.ok(tryUser('q@suraasa.com', { name: 'Q', role: 'Task Owner', managerEmail: 'q@suraasa.com' }).rejected);
});
test('managers and employees cannot edit the directory', () => {
  const { b, s } = company();
  for (const w of ['mgr@suraasa.com', 'rahul@suraasa.com', 'view@suraasa.com']) assert.ok(b.post({ action: 'apply', session: s(w), requestId: 'p' + w, ops: [{ c: 'users', id: w, rec: { role: 'Administrator' } }] }).rejected, w);
});

// ---------- upgrading the Sheet that exists today ----------
/** The Sheet as the deployed script left it: no Users tab, _extra last, and a column someone added by hand. */
function oldSheet() {
  const b = createBackend({ strict: true, props: { AUTH_REQUIRED: 'false', AUTH_OFF_UNTIL: String(Date.now() + 1e9), EMAIL_MODE: 'live' } });
  b.load(data());
  const ss = b.ss;
  for (const key of ['Tasks', 'Projects']) {
    const sh = ss.getSheetByName(key), w = sh.getLastColumn(), rows = sh.getLastRow(), head = sh.getRange(1, 1, 1, w).getValues()[0];
    const keep = head.map((h, i) => [h, i]).filter(x => !b.ctx.SCHEMA.find(s => s.tab === key).tail.includes(x[0]));
    const all = sh.getRange(1, 1, rows, w).getValues().map(r => keep.map(k => r[k[1]]).concat(''));
    all[0][all[0].length - 1] = 'My notes'; all.slice(1).forEach((r, i) => { r[r.length - 1] = 'note ' + i; });
    sh.cells = all;
  }
  for (const t of ['Users', 'NotificationLog', 'AuditLog', 'Trash', 'Snapshots']) delete ss.sheets[t];
  return b;
}
test('upgrade: all data survives, hand-added columns stay, new columns go right of _extra', () => {
  const b = oldSheet(), src = data();
  const sig = tab => JSON.stringify(b.ss.getSheetByName(tab).getRange(2, 1, b.ss.getSheetByName(tab).getLastRow() - 1, 5).getValues());
  const before = { Tasks: sig('Tasks'), Projects: sig('Projects'), Risks: sig('Risks') };
  b.ctx.setupSheet(); b.ctx.setupSheet();
  for (const t of Object.keys(before)) assert.strictEqual(sig(t), before[t], t);
  const head = b.ss.getSheetByName('Tasks').getRange(1, 1, 1, b.ss.getSheetByName('Tasks').getLastColumn()).getValues()[0];
  assert.strictEqual(head.indexOf('_extra'), 20, 'older columns did not move'); assert.ok(head.indexOf('ownerEmail') > 20); assert.ok(head.includes('My notes'));
  const st = b.post({ action: 'pull' }).state;
  assert.strictEqual(st.tasks.length, src.tasks.length); assert.strictEqual(st.projects.length, src.projects.length); assert.strictEqual(st.projects[0].milestones.length, src.projects[0].milestones.length);
  const rowOne = row(b, 'Tasks', src.tasks[0].id); assert.strictEqual(rowOne['My notes'], 'note 0');
  assert.ok(b.post({ action: 'apply', ops: [{ c: 'tasks', id: src.tasks[0].id, set: { desc: 'Saved after upgrade' }, base: { desc: st.tasks[0].desc } }] }).ok, 'saves work on the upgraded Sheet');
  assert.strictEqual(row(b, 'Tasks', src.tasks[0].id)['My notes'], 'note 0');
});
test('upgrade: a four-column Users tab gains the directory columns; IDs are added; rights and hand columns stay', () => {
  const b = oldSheet(); const ss = b.ss, sh = ss.insertSheet('Users');
  sh.cells = [['email', 'name', 'role', 'active', 'addedBy', 'addedAt', 'Phone'], ['AK@Suraasa.com', 'Ankit Khanna (AK)', 'management', 'TRUE', '', '', '999'], ['x@suraasa.com', 'Akhand Mishra', 'employee', 'TRUE', '', '', '111']];
  b.ctx.setupSheet();
  const u = b.ctx.userByEmail_('ak@suraasa.com'); assert.strictEqual(u.role, 'Administrator'); assert.strictEqual(u.employeeId, 'EMP-001'); assert.strictEqual(u.aliases.join(), 'AK');
  assert.strictEqual(sh.getRange(2, 7).getValues()[0][0], '999');
  b.ctx.backfillEmployeeIds_(); assert.strictEqual(b.ctx.userByEmail_('ak@suraasa.com').employeeId, 'EMP-001');
});
test('upgrade: matching owners to emails is exact, sends nothing and can run twice', () => {
  const b = oldSheet(); b.ctx.setupSheet(); b.addUser({ email: 'akhand@suraasa.com', name: 'Akhand Mishra', role: 'Employee' });
  const st = b.post({ action: 'pull' }).state, t = st.tasks.find(x => /^TBD/.test(x.owner)), named = st.tasks.find(x => x.owner === 'Head of Sales' || x.owner === 'Akhand Mishra');
  const sh = b.ss.getSheetByName('Tasks'); sh.getRange(b.ctx.rowOfId_(sh, 1, named.id), 7).setValue('Akhand Mishra');
  b.mails.length = 0;
  assert.ok(b.ctx.backfillOwnerEmails() >= 1); assert.strictEqual(b.ctx.backfillOwnerEmails(), 0);
  assert.strictEqual(row(b, 'Tasks', named.id).ownerEmail, 'akhand@suraasa.com'); assert.strictEqual(row(b, 'Tasks', t.id).ownerEmail, ''); assert.strictEqual(b.mails.length, 0);
});
test('upgrade: an existing task in the old layout still reads and its owner still has rights', () => {
  const b = oldSheet(); b.ctx.setupSheet(); b.addUser({ email: 'akhand@suraasa.com', name: 'Akhand Mishra', role: 'Employee' });
  const t = b.post({ action: 'pull' }).state.tasks[0], sh = b.ss.getSheetByName('Tasks'); sh.getRange(b.ctx.rowOfId_(sh, 1, t.id), 7).setValue('Akhand Mishra');
  b.props.set('AUTH_CLIENT_ID', CLIENT); b.props.set('AUTH_REQUIRED', 'true'); b.props.set('AUTH_DOMAIN', 'suraasa.com');
  const s = b.sessionFor('akhand@suraasa.com').session;
  assert.ok(pull(b, s).state.tasks.some(x => x.id === t.id));
  assert.ok(edit(b, s, t.id, { status: 'In Progress' }, { status: t.status }).ok);
});

// ---------- found by the independent review ----------
test('a manager cannot hide someone else inside "their own" task on a project they do not manage', () => {
  const { b, pid, s } = company(); const m = s('mgr@suraasa.com');
  for (const rec of [{ ownerEmail: 'mgr@suraasa.com, rahul@suraasa.com' }, { owner: 'Manny Ger, Rahul Verma' }, { ownerEmail: 'rahul@suraasa.com' }]) {
    const r = b.post({ action: 'apply', session: m, requestId: 'x' + Math.random(), ops: [{ c: 'tasks', id: 'X' + Math.random(), create: true, rec: Object.assign({ name: 'Sneaky', projectId: pid, status: 'Not Started' }, rec) }] });
    assert.ok(r.rejected, JSON.stringify(rec));
  }
  assert.strictEqual(b.mails.length, 0);
  assert.ok(b.post({ action: 'apply', session: m, requestId: 'mine', ops: [{ c: 'tasks', id: 'OWN1', create: true, rec: { name: 'Mine', projectId: pid, status: 'Not Started', ownerEmail: 'mgr@suraasa.com' } }] }).ok, 'own task still works');
});
test('writing yourself a task does not unlock its project', () => {
  const { b, pid, s } = company(); const r = s('rahul@suraasa.com');
  const before = pull(b, r).state.projects.find(p => p.id === pid);
  assert.ok(b.post({ action: 'apply', session: r, requestId: 'self', ops: [{ c: 'tasks', id: 'S1', create: true, rec: { name: 'Mine', projectId: pid, status: 'Not Started', ownerEmail: 'rahul@suraasa.com' } }] }).ok);
  const after = pull(b, r).state; const p = after.projects.find(x => x.id === pid);
  assert.ok(after.tasks.some(t => t.id === 'S1'), 'they still see the task');
  assert.strictEqual(Object.keys(p).length, Object.keys(before).length); assert.strictEqual(p.objective, undefined);
  const c = b.post({ action: 'apply', session: r, requestId: 'cmt', ops: [{ c: 'updates', id: 'U9', create: true, rec: { projectId: pid, week: '2026-11-02', author: 'Rahul Verma' } }] }); assert.ok(c.rejected);
});
test('a name two people share gives neither of them rights', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com'); b.addUser({ email: 'rahul2@suraasa.com', name: 'Rahul Verma', role: 'Employee' });
  const t = pull(b, a).state.tasks[0], sh = b.ss.getSheetByName('Tasks'); sh.getRange(b.ctx.rowOfId_(sh, 1, t.id), 7).setValue('Rahul Verma');
  assert.ok(!pull(b, s('rahul2@suraasa.com')).state.tasks.some(x => x.id === t.id));
  assert.ok(!pull(b, s('rahul@suraasa.com')).state.tasks.some(x => x.id === t.id));
  assert.ok(edit(b, s('rahul2@suraasa.com'), t.id, { progress: 5 }, { progress: 0 }).rejected);
});
test('running out of the daily email limit costs no attempts, however long it lasts', () => {
  const o = { mailQuota: 0 }; const { b, pid, s } = company(o); const r = assign(b, s('boss@suraasa.com'), pid);
  const sh = b.ss.getSheetByName('NotificationLog'), col = b.ctx.NOTIF_COLS.indexOf('nextAttemptAt') + 1;
  for (let i = 0; i < 9; i++) { const e = emails(b).find(x => x.taskId === r.task.id); sh.getRange(e._row, col).setValue(new Date(Date.now() - 1000).toISOString()); b.ctx.processNotifications(); }
  const e = emails(b).find(x => x.taskId === r.task.id); assert.strictEqual(e.deliveryStatus, 'failed'); assert.strictEqual(e.attempts, '0');
});
test('upgrade: blank and repeated column headings lose nothing', () => {
  const b = createBackend({ strict: true, props: { AUTH_REQUIRED: 'false', AUTH_OFF_UNTIL: String(Date.now() + 1e9) } });
  const sh = b.ss.insertSheet('Mine'); sh.cells = [['id', 'Rate', '', 'Rate', 'name'], ['1', 'a', 'kept', 'b', 'x']];
  b.ctx.migrateColumns_(sh, sh.cells[0].slice(), ['id', 'name', 'status']);
  const head = sh.cells[0], row = sh.cells[1], all = row.join('|');
  assert.strictEqual(row[head.indexOf('name')], 'x'); for (const v of ['a', 'b', 'kept']) assert.ok(all.includes(v), v);
});
test('upgrade: a formula in a hand-added column stays a formula', () => {
  const b = oldSheet(), sh = b.ss.getSheetByName('Tasks'), head = sh.cells[0], at = head.indexOf('My notes');
  sh.cells[1][at] = '=1+1'; b.ctx.setupSheet();
  const h = sh.cells[0]; assert.strictEqual(sh.cells[1][h.indexOf('My notes')], '=1+1'); assert.ok(h.indexOf('My notes') > h.indexOf('assignedAt'));
});
test('editing milestones keeps columns added by hand on that project\'s rows', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com'); const st = pull(b, a).state, p = st.projects.find(x => (x.milestones || []).length > 1);
  const sh = b.ss.getSheetByName('Milestones'), w = sh.getLastColumn(); sh.getRange(1, w + 1).setValue('Hand'); 
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues(); rows.forEach((r, i) => { if (r[0] === p.id) sh.getRange(i + 2, w + 1).setValue('note-' + r[1]); });
  const next = p.milestones.map((m, i) => (i ? m : Object.assign({}, m, { name: 'Renamed' })));
  const res = b.post({ action: 'apply', session: a, requestId: 'ms', ops: [{ c: 'projects', id: p.id, set: { milestones: next }, base: { milestones: p.milestones } }] }); assert.ok(res.ok, JSON.stringify(res).slice(0, 300));
  const after = sh.getRange(2, 1, sh.getLastRow() - 1, w + 1).getValues().filter(r => r[0] === p.id);
  assert.strictEqual(after.length, p.milestones.length); after.forEach(r => assert.strictEqual(r[w], 'note-' + r[1]));
});
test('IDs keep counting past 999', () => {
  const b = createBackend(); assert.strictEqual(b.ctx.nextTaskId_([{ id: 'T-999' }]), 'T-1000'); assert.strictEqual(b.ctx.nextTaskId_([{ id: 'T-007' }]), 'T-008');
  assert.strictEqual(b.ctx.nextEmployeeId_([{ employeeId: 'EMP-999' }]), 'EMP-1000');
});
test('a "restore" from a non-admin cannot forge history, and notes cannot be forged on a new record', () => {
  const { b, pid, s } = company(); const r = s('rahul@suraasa.com');
  b.post({ action: 'apply', session: r, requestId: 'f1', ops: [{ c: 'tasks', id: 'F1', create: true, restoreOf: 'x', rec: { name: 'F', projectId: pid, status: 'Not Started', ownerEmail: 'rahul@suraasa.com', createdBy: 'Boss Lady', originalDue: '2020-01-01' } }] });
  assert.strictEqual((pull(b, r).state.tasks.find(t => t.id === 'F1') || {}).createdBy, 'Rahul Verma');
  const n = b.post({ action: 'apply', session: r, requestId: 'f2', ops: [{ c: 'tasks', id: 'F2', create: true, rec: { name: 'G', projectId: pid, status: 'Not Started', ownerEmail: 'rahul@suraasa.com', notes: [{ id: 'n', text: 'Approved', author: 'Boss Lady', ts: '2026-01-01' }] } }] });
  assert.ok(n.rejected);
  const t = 'F1', w = edit(b, r, t, { notes: [{ id: 'n2', text: 'Approved', who: 'Rahul Verma', author: 'Boss Lady', ts: '2026-01-01' }] }, { notes: [] });
  assert.ok(w.rejected, 'who and author must both be the person');
});
test('test emails never reach an employee after going live, and do not use up the real one', () => {
  let down = true; const { b, pid, s } = company({ mailFails: () => down, props: { AUTH_CLIENT_ID: CLIENT, AUTH_DOMAIN: 'suraasa.com', EMAIL_MODE: 'test' } }); const a = s('boss@suraasa.com');
  const t = assign(b, a, pid, { due: future(1) }).task; b.ctx.dailyChecks();
  down = false; b.props.set('EMAIL_MODE', 'live'); b.ss.getSheetByName('NotificationLog'); const col = b.ctx.NOTIF_COLS.indexOf('nextAttemptAt') + 1;
  emails(b).filter(x => x.deliveryStatus === 'failed').forEach(e => b.ss.getSheetByName('NotificationLog').getRange(e._row, col).setValue(new Date(Date.now() - 1000).toISOString()));
  b.ctx.processNotifications();
  assert.ok(b.mails.length >= 1); assert.ok(b.mails.every(m => m.to === 'owner@suraasa.com'), b.mails.map(m => m.to).join());
  b.mails.length = 0; b.ctx.dailyChecks();
  assert.ok(b.mails.some(m => m.to === 'rahul@suraasa.com' && m.body.includes(t.id)), 'the first live morning still sends');
});
test('retrying one row of a batch does not abandon it, and emails turned off stay queued', () => {
  let down = true; const { b, pid, s } = company({ mailFails: () => down }); const a = s('boss@suraasa.com');
  const r = assign(b, a, pid); const e = emails(b).find(x => x.taskId === r.task.id);
  assert.ok(b.post({ action: 'notification_retry', session: a, id: e.notificationId }).requeued === 1);
  assert.strictEqual(emails(b).find(x => x.taskId === r.task.id).deliveryStatus, 'failed'); assert.strictEqual(emails(b).find(x => x.taskId === r.task.id).attempts, '1');
  b.props.set('ASSIGN_EMAIL', 'off'); const col = b.ctx.NOTIF_COLS.indexOf('nextAttemptAt') + 1; b.ss.getSheetByName('NotificationLog').getRange(e._row, col).setValue(new Date(Date.now() - 1000).toISOString());
  b.ctx.processNotifications(); assert.strictEqual(emails(b).find(x => x.taskId === r.task.id).deliveryStatus, 'failed');
  down = false; b.props.delete('ASSIGN_EMAIL'); b.ctx.processNotifications();
  assert.strictEqual(emails(b).find(x => x.taskId === r.task.id).deliveryStatus, 'accepted');
});
test('direct Sheet edits are shown to Super Admins only', () => {
  const { b, s } = company(); const sh = b.ss.getSheetByName('AuditLog');
  sh.getRange(sh.getLastRow() + 1, 1, 1, 14).setValues([['id', '2026-11-05', '', 'Sheet', 'risks', 'R1', '', '', 'sheet_edit', '', 'old secret', 'new secret', 'Edited', '']]);
  assert.ok(!JSON.stringify(pull(b, s('view@suraasa.com')).state.audit).includes('new secret'));
  assert.ok(JSON.stringify(pull(b, s('boss@suraasa.com')).state.audit).includes('new secret'));
});
test('a manager can write progress history only for projects they manage', () => {
  const { b, pid, s } = company(); const r = b.post({ action: 'snapshot', session: s('mgr@suraasa.com'), rows: [{ date: '2026-11-05', projectId: pid, progress: 100, active: 1 }] }); assert.strictEqual(r.added, 0);
  b.setProjectOwner(pid, 'mgr@suraasa.com'); assert.strictEqual(b.post({ action: 'snapshot', session: s('mgr@suraasa.com'), rows: [{ date: '2026-11-05', projectId: pid, progress: 10, active: 1 }] }).added, 1);
});
test('a known confirmation ID does not fetch someone else\'s task, and daily notices stay private', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); assign(b, a, pid, { name: 'Boss only' }, 'KEY-1'); b.setProjectOwner(pid, 'mgr@suraasa.com');
  const r = assign(b, s('mgr@suraasa.com'), pid, { name: 'Other' }, 'KEY-1'); assert.ok(!JSON.stringify(r.task || {}).includes('Boss only'));
  assert.strictEqual(b.ctx.notifiedFor_('KEY-1', { email: 'priya@suraasa.com' }).length, 0);
});
test('a formula typed into a task is stored as text and read back unchanged', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const t = assign(b, a, pid, { name: '=IMPORTXML("http://evil","//a")' }).task;
  assert.strictEqual(row(b, 'Tasks', t.id).name[0], "'"); assert.ok(pull(b, a).state.tasks.find(x => x.id === t.id).name.startsWith('=IMPORTXML'));
});
test('one huge digest stays within Google\'s email size', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); const big = 'x'.repeat(590);
  const ts = []; for (let i = 0; i < 60; i++) ts.push({ c: 'tasks', id: 'B' + i, create: true, rec: { name: 'Task ' + i, desc: big, projectId: pid, status: 'Not Started', ownerEmail: 'rahul@suraasa.com', due: future(30), priority: 'P2' } });
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'bulk', ops: ts }).ok);
  assert.ok(b.mails[0].htmlBody.length < 150000, String(b.mails[0].htmlBody.length)); assert.ok(b.mails[0].body.includes('30 more')); assert.match(b.mails[0].subject, /^60 New Items/);
});

// ---------- found when the fixes were reviewed again ----------
test('an employee cannot hand a colleague access by naming them answerable', () => {
  const { b, pid, s } = company(); const r = s('rahul@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: r, requestId: 'q1', ops: [{ c: 'tasks', id: 'Q1', create: true, rec: { name: 'Mine', projectId: pid, status: 'Not Started', ownerEmail: 'rahul@suraasa.com', accountable: 'Priya Nair' } }] }).ok);
  assert.strictEqual(row(b, 'Tasks', 'Q1').accountable, 'TBD');
  assert.strictEqual(pull(b, s('priya@suraasa.com')).state.projects.find(p => p.id === pid).objective, undefined);
});
test('people who share a name can still file their own tasks, and cannot touch each other\'s notes', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'); b.addUser({ email: 'rahul2@suraasa.com', name: 'Rahul Verma', role: 'Employee' });
  const r = s('rahul@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: r, requestId: 'n1', ops: [{ c: 'tasks', id: 'N1', create: true, rec: { name: 'Own', projectId: pid, status: 'Not Started', owner: 'Rahul Verma' } }] }).ok);
  assert.strictEqual(row(b, 'Tasks', 'N1').ownerEmail, 'rahul@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: r, requestId: 'n2', ops: [{ c: 'tasks', id: 'N1S', create: true, rec: { name: 'Sub', projectId: pid, parent: 'N1', kind: 'Subtask', status: 'Not Started', owner: 'Rahul Verma' } }] }).ok, 'subtask too');
  assert.ok(pull(b, r).state.tasks.some(t => t.id === 'N1'));
  const t = assign(b, a, pid).task; assert.ok(edit(b, r, t.id, { notes: [{ id: 'z', type: 'comment', text: 'Mine', author: 'Rahul Verma', ts: '2026-11-05' }] }, { notes: [] }).ok, 'adding a note works');
  const m = b.post({ action: 'apply', session: s('rahul2@suraasa.com'), requestId: 'n3', ops: [{ c: 'tasks', id: t.id, set: { notes: [] }, base: { notes: [{ id: 'z', type: 'comment', text: 'Mine', author: 'Rahul Verma', ts: '2026-11-05' }] } }] }); assert.ok(m.rejected);
});
test('comments keep their hand-added cells when an earlier comment is removed', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com'); const p = pull(b, a).state.projects[0];
  const one = { who: 'Boss Lady', text: 'one', ts: '2026-11-01T00:00:00Z' }, two = { who: 'Boss Lady', text: 'two', ts: '2026-11-02T00:00:00Z' };
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'c1', ops: [{ c: 'projects', id: p.id, set: { comments: [one, two] }, base: { comments: p.comments } }] }).ok);
  const sh = b.ss.getSheetByName('Comments'), w = sh.getLastColumn(); sh.getRange(1, w + 1).setValue('Hand');
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach((r, i) => { if (r[2] === 'one' || r[2] === 'two') sh.getRange(i + 2, w + 1).setValue('note for ' + r[2]); });
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'c2', ops: [{ c: 'projects', id: p.id, set: { comments: [two] }, base: { comments: [one, two] } }] }).ok);
  const left = sh.getRange(2, 1, sh.getLastRow() - 1, w + 1).getValues().filter(r => r[0] === p.id);
  assert.strictEqual(left.length, 1); assert.strictEqual(left[0][w], 'note for two');
});
test('test mode holds back everything, even an email queued while live; a batch never mixes modes', () => {
  let down = true; const { b, pid, s } = company({ mailFails: () => down }); const a = s('boss@suraasa.com');
  const r = assign(b, a, pid); down = false; b.props.set('EMAIL_MODE', 'test');
  const e = emails(b).find(x => x.taskId === r.task.id); b.ss.getSheetByName('NotificationLog').getRange(e._row, b.ctx.NOTIF_COLS.indexOf('nextAttemptAt') + 1).setValue(new Date(Date.now() - 1000).toISOString());
  b.ctx.processNotifications();
  assert.strictEqual(b.mails.length, 0, 'it waits rather than going to the test inbox');
  b.props.set('EMAIL_MODE', 'live'); b.ctx.processNotifications();
  assert.strictEqual(b.mails.length, 1); assert.strictEqual(b.mails[0].to, 'rahul@suraasa.com');
  const q = company(), t = q.b; assign(t, q.s('boss@suraasa.com'), q.pid); t.props.set('EMAIL_MODE', 'test'); assign(t, q.s('boss@suraasa.com'), q.pid);
  const ids = emails(t).map(x => x.batchId); assert.ok(ids.every(x => /\|(live|test)$/.test(x)));
});
test('an old record with an unusual ID can still be restored', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), sh = b.ss.getSheetByName('Tasks'), t = assign(b, a, pid).task;
  sh.getRange(b.ctx.rowOfId_(sh, 1, t.id), 1).setValue('T 77');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'd77', ops: [{ c: 'tasks', id: 'T 77', del: true }] }).ok);
  const row77 = pull(b, a).state.trash.find(x => x.recordId === 'T 77');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'r77', ops: [{ c: 'tasks', id: 'T 77', create: true, restoreOf: row77.trashId, rec: JSON.parse(row77.record) }] }).ok);
});
test('a task ID cannot be a formula, and a repeated column cannot override the real one', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'id1', ops: [{ c: 'tasks', id: '=ID1', create: true, rec: { name: 'X', projectId: pid, status: 'Not Started' } }] }).rejected);
  const sh = b.ss.getSheetByName('Tasks'), w = sh.getLastColumn(); const t = pull(b, a).state.tasks[0];
  sh.getRange(1, w + 1).setValue('status'); sh.getRange(b.ctx.rowOfId_(sh, 1, t.id), w + 1).setValue('Completed');
  assert.strictEqual(pull(b, a).state.tasks.find(x => x.id === t.id).status, t.status);
});
test('a quoted formula reads back cleanly in list fields too', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com'); const p = pull(b, a).state.projects[0];
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'l1', ops: [{ c: 'projects', id: p.id, set: { metrics: ['=ROI>2'] }, base: { metrics: p.metrics } }] }).ok);
  assert.strictEqual(pull(b, a).state.projects[0].metrics.join(), '=ROI>2');
});

// ---------- checked against Google's documentation ----------
test('an account with a suraasa.com address that the organisation does not manage is refused', () => {
  const { b } = company(); const t = { aud: CLIENT, iss: 'accounts.google.com', email: 'boss@suraasa.com', email_verified: 'true', exp: String(Date.now() / 1000 + 999) };
  b.tokens['h.d.none'] = t; b.tokens['h.d.other'] = Object.assign({}, t, { hd: 'evil.com' });
  assert.ok(/Workspace/.test(b.post({ action: 'login', idToken: 'h.d.none' }).error));
  assert.ok(/Workspace/.test(b.post({ action: 'login', idToken: 'h.d.other' }).error));
  b.tokens['h.d.real'] = Object.assign({}, t, { hd: 'suraasa.com' }); assert.ok(b.post({ action: 'login', idToken: 'h.d.real' }).ok);
});
test('junk never reaches Google, and nobody can flood others out of signing in', () => {
  let calls = 0; const { b } = company({ onFetch: () => { calls++; } });
  for (const t of ['junk', 'a.b', '<script>.b.c', 'a.b.' + 'x'.repeat(5000), b.token('boss@suraasa.com', { aud: 'other' }), b.token('stranger@suraasa.com'), b.token('boss@suraasa.com', { hd: 'evil.com' })]) assert.ok(!b.post({ action: 'login', idToken: t }).ok); assert.strictEqual(calls, 0, 'stopped locally');
  let last; for (let i = 0; i < 40; i++) last = b.post({ action: 'login', idToken: 'a.b.c' });
  assert.strictEqual(calls, 30); assert.ok(/Too many/.test(last.error));
  for (let i = 0; i < 15; i++) last = b.post({ action: 'login', idToken: b.token('priya@suraasa.com', { sub: String(i) }) });
  assert.ok(/Too many/.test(last.error), 'one person is limited');
  assert.ok(b.post({ action: 'login', idToken: b.token('boss@suraasa.com') }).ok, 'and everyone else can still sign in');
});
test('one failed check with Google gets a second try, and a real outage is reported plainly', () => {
  let n = 0; const { b } = company({ onFetch: () => (++n === 1 ? { getResponseCode: () => 503, getContentText: () => '' } : null) });
  const s = b.sessionFor('boss@suraasa.com'); assert.ok(s.ok, JSON.stringify(s)); assert.strictEqual(n, 2);
  let m = 0; const down = company({ onFetch: () => { m++; throw new Error('network'); } }).b;
  const r = down.post({ action: 'login', idToken: 'a.b.c' }); assert.ok(!r.ok && /could not confirm/.test(r.error)); assert.strictEqual(m, 2);
});
test('oversized session and request IDs are refused calmly, within Google\'s 250 character key limit', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), put = b.cache.set.bind(b.cache), get = b.cache.get.bind(b.cache);
  const guard = k => { if (k.length > 250) throw new Error('Argument too large: key'); }; b.cache.get = k => { guard(k); return get(k); }; b.cache.set = (k, v) => { guard(k); return put(k, v); };
  assert.strictEqual(b.post({ action: 'pull', session: 'x'.repeat(500) }).auth, true);
  assert.ok(b.post({ action: 'logout', session: 'x'.repeat(500) }).ok);
  const r = assign(b, a, pid, {}, 'R'.repeat(500)); assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  assert.ok(edit(b, a, r.task.id, { progress: 5 }, { progress: 0 }, 'Q'.repeat(500)).ok);
});

// ---------- found by tracing both briefs line by line ----------
test('a task can be assigned to several people by email, and each is told', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  const r = assign(b, a, pid, { ownerEmail: 'rahul@suraasa.com, PRIYA@suraasa.com' }); assert.ok(r.ok, r.error);
  const t = row(b, 'Tasks', r.task.id); assert.strictEqual(t.ownerEmail, 'rahul@suraasa.com, priya@suraasa.com'); assert.strictEqual(t.owner, 'Rahul Verma, Priya Nair');
  assert.strictEqual(b.mails.map(m => m.to).sort().join(), 'priya@suraasa.com,rahul@suraasa.com');
  for (const e of ['rahul@suraasa.com', 'priya@suraasa.com']) assert.ok(pull(b, s(e)).state.tasks.some(x => x.id === r.task.id), e);
  assert.strictEqual(assign(b, a, pid, { ownerEmail: 'rahul@suraasa.com, nobody@suraasa.com' }).code, 'unknown_employee');
  assert.strictEqual(assign(b, a, pid, { ownerEmail: 'rahul@suraasa.com, gone@suraasa.com' }).code, 'inactive_employee');
});
test('a Manager can update only their own reports, and only three fields', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com'), m = s('mgr@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'mg1', ops: [{ c: 'users', id: 'rahul@suraasa.com', rec: { managerEmail: 'mgr@suraasa.com' } }] }).ok);
  assert.ok(b.post({ action: 'apply', session: m, requestId: 'mg2', ops: [{ c: 'users', id: 'rahul@suraasa.com', rec: { department: 'Sales', designation: 'Setter', joiningDate: '2026-01-05' } }] }).ok);
  assert.strictEqual(b.ctx.userByEmail_('rahul@suraasa.com').designation, 'Setter');
  for (const rec of [{ role: 'Administrator' }, { active: false }, { name: 'New' }, { managerEmail: '' }]) assert.ok(b.post({ action: 'apply', session: m, requestId: 'x' + Math.random(), ops: [{ c: 'users', id: 'rahul@suraasa.com', rec }] }).rejected, JSON.stringify(rec));
  assert.ok(b.post({ action: 'apply', session: m, requestId: 'mg3', ops: [{ c: 'users', id: 'priya@suraasa.com', rec: { department: 'X' } }] }).rejected, 'someone else\'s report');
  assert.ok(pull(b, m).state.directory.find(u => u.email === 'rahul@suraasa.com').managerEmail === 'mgr@suraasa.com');
});
test('the old owner of a task is told, with nothing else about it', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), t = assign(b, a, pid, { name: 'Moved on' }).task;
  edit(b, a, t.id, { ownerEmail: 'priya@suraasa.com' }, { ownerEmail: t.ownerEmail });
  const st = pull(b, s('rahul@suraasa.com')).state;
  assert.ok(st.audit.some(x => x.action === 'owner_changed' && x.taskId === t.id)); assert.ok(!st.tasks.some(x => x.id === t.id));
  assert.ok(!st.audit.some(x => x.taskId === t.id && x.action !== 'owner_changed'));
  const row1 = st.audit.find(x => x.taskId === t.id); assert.strictEqual(row1.newValue, ''); assert.strictEqual(row1.actorName, ''); assert.ok(!/Priya|Moved on/.test(JSON.stringify(row1)), JSON.stringify(row1));
});
test('a new project\'s owner and a newly named manager are both told', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'pn', ops: [{ c: 'projects', id: 'PRJ-77', create: true, rec: { name: 'New one', ownerEmail: 'mgr@suraasa.com', status: 'Not Started' } }] }).ok);
  assert.ok(pull(b, s('mgr@suraasa.com')).state.audit.some(x => x.action === 'project_assigned' && x.newValue === 'Manny Ger')); assert.strictEqual(b.mails.length, 1); b.mails.length = 0;
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'pm', ops: [{ c: 'projects', id: pid, set: { managerEmails: ['other@suraasa.com'] }, base: {} }] }).ok);
  assert.strictEqual(b.mails.length, 1); assert.strictEqual(b.mails[0].to, 'other@suraasa.com');
});
test('the exact moment of completion is stamped by the server and cannot be forged', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), t = assign(b, a, pid).task;
  edit(b, a, t.id, { status: 'Completed', completedAt: '2026-11-05', progress: 100, completedTs: '2000-01-01' }, { status: 'Not Started', progress: 0 });
  const got = pull(b, a).state.tasks.find(x => x.id === t.id).completedTs; assert.ok(got && !got.startsWith('2000'));
});
test('direct edits to the Users and AuditLog tabs are logged, and a Users edit refreshes the site', () => {
  const { b, s } = company(); const a = s('boss@suraasa.com'), v = b.get({ action: 'version' }).version;
  const sh = b.ss.getSheetByName('Users');
  b.ctx.onEdit({ range: sh.getRange(2, 2), oldValue: 'x', value: 'y' });
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'sheet_edit' && x.entityType === 'users')); assert.ok(b.get({ action: 'version' }).version > v);
  b.ctx.onEdit({ range: b.ss.getSheetByName('AuditLog').getRange(2, 2), oldValue: 'x', value: 'y' });
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'sheet_edit' && x.entityType === 'auditlog'));
});
test('files: owners and managers can upload, others cannot, and unsafe types are refused', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), t = assign(b, a, pid).task, data = Buffer.from('hello').toString('base64');
  const up = (who, o) => b.post(Object.assign({ action: 'upload', session: who, kind: 'task', id: t.id, name: 'plan.pdf', data }, o));
  const r = up(s('rahul@suraasa.com')); assert.ok(r.ok, r.error); assert.match(r.attachment.url, /^https:\/\/drive\.google\.com/);
  assert.strictEqual(b.ctx.DriveApp.files[0].type, 'application/pdf'); assert.strictEqual(b.ctx.DriveApp.files[0].sharing, 'dv');
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'file_uploaded' && x.taskId === t.id));
  assert.strictEqual(up(s('priya@suraasa.com')).code, 'denied'); assert.strictEqual(up(s('view@suraasa.com')).code, 'denied');
  assert.strictEqual(up(s('rahul@suraasa.com'), { kind: 'project', id: pid }).code, 'denied');
  for (const name of ['page.html', 'run.exe', 'a.svg', 'noext', 'x.pdf.js', 'old.doc', 'old.xls', 'old.ppt']) assert.strictEqual(up(a, { name }).code, 'invalid', name);
  assert.strictEqual(up(a, { data: '' }).code, 'invalid'); assert.strictEqual(up(a, { data: '!!bad' }).code, 'invalid'); assert.strictEqual(up(a, { data: 'A'.repeat(15000000) }).code, 'invalid');
  assert.strictEqual(b.ctx.DriveApp.files[b.ctx.DriveApp.files.length - 1].name.includes('../'), false);
  const w = up(a, { name: '../../etc/pass:wd.pdf' }); assert.ok(w.ok); assert.ok(!w.attachment.name.includes('/'));
  assert.ok(!up(a, { name: 'cod\u202Efdp.pdf' }).attachment.name.includes('\u202E'));
  const count = () => pull(b, a).state.tasks.find(x => x.id === t.id).attachments.length, had = count();
  up(s('rahul@suraasa.com'), { name: 'one.pdf' }); up(s('rahul@suraasa.com'), { name: 'two.pdf' }); assert.strictEqual(count(), had + 2, 'two uploads are both kept');
  assert.strictEqual(b.post({ action: 'upload', kind: 'task', id: t.id, name: 'a.pdf', data }).auth, true);
});
test('if the organisation blocks link sharing, the upload says so', () => {
  const { b, pid, s } = company({ noSharing: true }); const a = s('boss@suraasa.com'), t = assign(b, a, pid).task;
  const r = b.post({ action: 'upload', session: a, kind: 'task', id: t.id, name: 'a.pdf', data: 'aGk=' }); assert.ok(r.ok); assert.match(r.note, /only the Sheet owner/);
});
test('co-owners can change their own links, not each other\'s', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), t = assign(b, a, pid, { ownerEmail: 'rahul@suraasa.com, priya@suraasa.com' }).task;
  const link = { name: 'x', url: 'https://example.com/1', by: 'Rahul Verma', ts: '2026-11-05' };
  assert.ok(edit(b, s('rahul@suraasa.com'), t.id, { attachments: [link] }, {}).ok);
  assert.ok(edit(b, s('priya@suraasa.com'), t.id, { attachments: [Object.assign({}, link, { url: 'https://evil.example' })] }, { attachments: [link] }).rejected);
  assert.ok(edit(b, s('priya@suraasa.com'), t.id, { attachments: [] }, { attachments: [link] }).rejected);
  assert.ok(edit(b, s('rahul@suraasa.com'), t.id, { attachments: [] }, { attachments: [link] }).ok, 'your own can go');
});
test('blank, repeated and too many emails are handled on every path', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com');
  assert.strictEqual(assign(b, a, pid, { ownerEmail: ' , ' }).field, 'ownerEmail');
  const t = assign(b, a, pid).task;
  assert.ok(edit(b, a, t.id, { ownerEmail: 'priya@suraasa.com, PRIYA@suraasa.com;priya@suraasa.com' }, { ownerEmail: t.ownerEmail }).ok);
  assert.strictEqual(row(b, 'Tasks', t.id).ownerEmail, 'priya@suraasa.com');
  const many = Array.from({ length: 11 }, (_, i) => 'x' + i + '@suraasa.com').join(', ');
  assert.ok(/at most 10/.test(edit(b, a, t.id, { ownerEmail: many }, { ownerEmail: 'priya@suraasa.com' }).rejected[0].reason));
});
test('someone removed and added back as a project manager is told again', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), set = (v, base, id) => b.post({ action: 'apply', session: a, requestId: id, ops: [{ c: 'projects', id: pid, set: { managerEmails: v }, base: { managerEmails: base } }] });
  set(['other@suraasa.com'], undefined, 'x1'); set([], ['other@suraasa.com'], 'x2'); set(['other@suraasa.com'], [], 'x3');
  assert.strictEqual(b.mails.filter(m => m.to === 'other@suraasa.com').length, 2);
});
test('reopening a task clears its completion time, and Manager replies carry no roles', () => {
  const { b, pid, s } = company(); const a = s('boss@suraasa.com'), t = assign(b, a, pid).task;
  edit(b, a, t.id, { status: 'Completed', progress: 100, completedAt: '2026-11-05' }, { status: 'Not Started', progress: 0 });
  edit(b, a, t.id, { status: 'In Progress', progress: 0, completedAt: '' }, { status: 'Completed', progress: 100, completedAt: '2026-11-05' });
  assert.strictEqual(pull(b, a).state.tasks.find(x => x.id === t.id).completedTs, undefined);
  b.post({ action: 'apply', session: a, requestId: 'mm', ops: [{ c: 'users', id: 'rahul@suraasa.com', rec: { managerEmail: 'mgr@suraasa.com' } }] });
  const r = b.post({ action: 'apply', session: s('mgr@suraasa.com'), requestId: 'mn', ops: [{ c: 'users', id: 'rahul@suraasa.com', rec: { department: 'Sales' } }] });
  assert.ok(r.ok); assert.ok(!(r.entries || []).some(x => x.entityType === 'users'));
  assert.ok(pull(b, a).state.audit.some(x => x.action === 'user_changed' && /changed: department/.test(x.text)));
});
test('the server and the site use the same status rules', () => {
  const b = createBackend(), E = require('../src/engine.js');
  assert.strictEqual(JSON.stringify(b.ctx.TRANSITIONS), JSON.stringify(E.TRANSITIONS));
});
test('the Google profile picture is stored, and only from Google\'s image host', () => {
  const { b } = company(); const t = { aud: CLIENT, iss: 'accounts.google.com', hd: 'suraasa.com', email: 'rahul@suraasa.com', email_verified: 'true', exp: String(Date.now() / 1000 + 999) };
  b.tokens['p.i.c'] = Object.assign({}, t, { picture: 'https://lh3.googleusercontent.com/a/abc=s96-c' }); assert.ok(b.post({ action: 'login', idToken: 'p.i.c' }).ok);
  assert.strictEqual(b.ctx.userByEmail_('rahul@suraasa.com').photoUrl, 'https://lh3.googleusercontent.com/a/abc=s96-c');
  b.tokens['p.i.d'] = Object.assign({}, t, { picture: 'https://evil.example/x.png' }); assert.ok(b.post({ action: 'login', idToken: 'p.i.d' }).ok);
  assert.strictEqual(b.ctx.userByEmail_('rahul@suraasa.com').photoUrl, 'https://lh3.googleusercontent.com/a/abc=s96-c');
});

// ---------- passwords ----------
function pwBackend() {
  const b = createBackend({ strict: true, props: { AUTH_DOMAIN: 'suraasa.com' } });
  b.addUser({ email: 'boss@suraasa.com', name: 'Boss', role: 'Administrator' });
  b.addUser({ email: 'staff@suraasa.com', name: 'Staff', role: 'Task Owner' });
  b.addUser({ email: 'left@suraasa.com', name: 'Left', role: 'Task Owner', active: false });
  return b;
}
const signIn = (b, email, password) => b.post({ action: 'password_login', email, password });
test('sign-in works with no Google client ID at all', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const p = b.get({ action: 'ping' }); assert.strictEqual(p.api, 5); assert.strictEqual(p.auth.clientId, ''); assert.strictEqual(p.signInReady, true);
  const r = signIn(b, 'Staff@Suraasa.com ', 'correct horse battery');
  assert.ok(r.ok && r.session); assert.strictEqual(r.mustChange, false);
  const s = b.post({ action: 'pull', session: r.session }); assert.ok(s.ok !== false && s.state); assert.strictEqual(s.me.email, 'staff@suraasa.com');
});
test('a wrong password, an unknown email and a person with no password all get the same answer', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const a1 = signIn(b, 'staff@suraasa.com', 'wrong password'), a2 = signIn(b, 'nobody@suraasa.com', 'wrong password'), a3 = signIn(b, 'boss@suraasa.com', 'wrong password');
  assert.ok(!a1.ok && !a1.session); assert.strictEqual(a1.error, a2.error); assert.strictEqual(a1.error, a3.error);
});
test('five wrong tries lock that person for a while, and nobody else', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false); b.ctx.pwStore_('boss@suraasa.com', 'another long password', false);
  for (let i = 0; i < 5; i++) signIn(b, 'staff@suraasa.com', 'wrong password');
  const r = signIn(b, 'staff@suraasa.com', 'correct horse battery');
  assert.ok(!r.ok && /Too many/.test(r.error));
  assert.ok(signIn(b, 'boss@suraasa.com', 'another long password').ok);
});
test('a right password after a few wrong ones clears the count', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  for (let i = 0; i < 4; i++) signIn(b, 'staff@suraasa.com', 'wrong password');
  assert.ok(signIn(b, 'staff@suraasa.com', 'correct horse battery').ok);
  for (let i = 0; i < 4; i++) signIn(b, 'staff@suraasa.com', 'wrong password');
  assert.ok(signIn(b, 'staff@suraasa.com', 'correct horse battery').ok);
});
test('someone made inactive cannot sign in, even with the right password', () => {
  const b = pwBackend(); b.ctx.pwStore_('left@suraasa.com', 'correct horse battery', false);
  assert.ok(!signIn(b, 'left@suraasa.com', 'correct horse battery').ok);
});
test('a temporary password opens nothing until the person chooses their own', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'temp-pass-1234', true);
  const r = signIn(b, 'staff@suraasa.com', 'temp-pass-1234');
  assert.ok(r.ok && r.mustChange);
  const blocked = b.post({ action: 'pull', session: r.session }); assert.ok(blocked.auth === true && !blocked.state);
  assert.ok(b.post({ action: 'apply', session: r.session, requestId: 'x', ops: [] }).auth === true);
  assert.ok(/at least 10/.test(b.post({ action: 'password_change', session: r.session, newPassword: 'short' }).error));
  assert.ok(/different/.test(b.post({ action: 'password_change', session: r.session, newPassword: 'temp-pass-1234' }).error));
  assert.ok(b.post({ action: 'password_change', session: r.session, newPassword: 'my own good password' }).ok);
  assert.ok(b.post({ action: 'pull', session: r.session }).state, 'the same session now works');
  assert.ok(!signIn(b, 'staff@suraasa.com', 'temp-pass-1234').ok, 'the temporary password has stopped working');
  assert.strictEqual(signIn(b, 'staff@suraasa.com', 'my own good password').mustChange, false);
});
test('changing a password needs the current one, and wrong guesses count', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const s = signIn(b, 'staff@suraasa.com', 'correct horse battery').session;
  assert.ok(/current password/.test(b.post({ action: 'password_change', session: s, currentPassword: 'guess', newPassword: 'new long password' }).error));
  assert.ok(/current password/.test(b.post({ action: 'password_change', session: s, newPassword: 'new long password' }).error));
  assert.ok(b.post({ action: 'password_change', session: s, currentPassword: 'correct horse battery', newPassword: 'new long password' }).ok);
  assert.ok(signIn(b, 'staff@suraasa.com', 'new long password').ok);
  for (let i = 0; i < 5; i++) b.post({ action: 'password_change', session: s, currentPassword: 'guess', newPassword: 'another long password' });
  assert.ok(/Too many/.test(b.post({ action: 'password_change', session: s, currentPassword: 'new long password', newPassword: 'another long password' }).error));
});
test('a changed password ends every other session', async () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const one = signIn(b, 'staff@suraasa.com', 'correct horse battery').session, two = signIn(b, 'staff@suraasa.com', 'correct horse battery').session;
  const wait = Date.now() + 3; while (Date.now() < wait); // so the new password is newer than both sessions
  assert.ok(b.post({ action: 'password_change', session: one, currentPassword: 'correct horse battery', newPassword: 'new long password' }).ok);
  assert.ok(b.post({ action: 'pull', session: one }).state, 'the session that changed it stays');
  assert.ok(b.post({ action: 'pull', session: two }).auth === true, 'the other one is ended');
});
test('only a Super Admin can reset a password, and the result works once', () => {
  const b = pwBackend(); b.ctx.pwStore_('boss@suraasa.com', 'boss long password', false); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const staff = signIn(b, 'staff@suraasa.com', 'correct horse battery').session, boss = signIn(b, 'boss@suraasa.com', 'boss long password').session;
  const no = b.post({ action: 'password_reset', session: staff, email: 'boss@suraasa.com' });
  assert.ok(!no.ok && no.code === 'denied' && !no.tempPassword); assert.ok(signIn(b, 'boss@suraasa.com', 'boss long password').ok);
  assert.ok(b.post({ action: 'password_reset', email: 'boss@suraasa.com' }).auth === true, 'nobody signed in gets nothing');
  assert.ok(!b.post({ action: 'password_reset', session: boss, email: 'left@suraasa.com' }).ok);
  const wait = Date.now() + 3; while (Date.now() < wait);
  const r = b.post({ action: 'password_reset', session: boss, email: 'staff@suraasa.com' });
  assert.ok(r.ok && /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(r.tempPassword), r.tempPassword);
  assert.ok(!/[01ilo]/.test(r.tempPassword));
  assert.ok(b.post({ action: 'pull', session: staff }).auth === true, 'their old session has ended');
  assert.ok(!signIn(b, 'staff@suraasa.com', 'correct horse battery').ok, 'their old password has stopped');
  assert.strictEqual(signIn(b, 'staff@suraasa.com', r.tempPassword).mustChange, true);
  const log = JSON.stringify(b.ss.getSheetByName('AuditLog').cells);
  assert.ok(log.includes('password_reset') && !log.includes(r.tempPassword));
});
test('a reset gets a locked-out person back in straight away', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  for (let i = 0; i < 5; i++) signIn(b, 'staff@suraasa.com', 'wrong password');
  b.ctx.pwStore_('staff@suraasa.com', 'temp-pass-1234', true);
  assert.ok(signIn(b, 'staff@suraasa.com', 'temp-pass-1234').ok);
});
test('the Sheet menu gives the first person a temporary password, for a listed person only', () => {
  const b = pwBackend(), shown = []; let answer = 'BOSS@suraasa.com';
  b.ctx.SpreadsheetApp.getUi = () => ({ Button: { OK: 'ok' }, ButtonSet: { OK_CANCEL: 1, OK: 2 }, prompt: () => ({ getSelectedButton: () => 'ok', getResponseText: () => answer }), alert: (...x) => { shown.push(x.join(' ')); } });
  b.ctx.tempPasswordMenu();
  const temp = (shown[0].match(/[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}/) || [])[0];
  assert.ok(temp); assert.strictEqual(signIn(b, 'boss@suraasa.com', temp).mustChange, true);
  answer = 'stranger@suraasa.com'; b.ctx.tempPasswordMenu();
  assert.ok(/not an active person/.test(shown[1])); assert.ok(!b.props.has('pw:stranger@suraasa.com'));
});
test('the emergency switch cannot leave a lasting Super Admin behind', () => {
  const b = pwBackend(); b.ctx.pwStore_('left@suraasa.com', 'old long password', false);
  b.props.set('AUTH_REQUIRED', 'false'); b.props.set('AUTH_OFF_UNTIL', String(Date.now() + 60000));
  const r = b.post({ action: 'apply', requestId: 'x1', ops: [{ c: 'users', id: 'left@suraasa.com', rec: { role: 'Administrator', active: true } }] });
  assert.ok(!r.ok && r.rejected[0].code === 'denied', JSON.stringify(r));
  b.props.delete('AUTH_REQUIRED'); b.props.delete('AUTH_OFF_UNTIL');
  assert.ok(!signIn(b, 'left@suraasa.com', 'old long password').ok);
});
test('invented emails leave nothing behind, so they cannot flood out a lock or a session', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const before = b.cache.size, props = b.props.size;
  for (let i = 0; i < 50; i++) signIn(b, 'made-up' + i + '@suraasa.com', 'wrong password');
  assert.strictEqual(b.cache.size, before); assert.strictEqual(b.props.size, props);
});
test('a lock survives the cache being cleared', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  for (let i = 0; i < 5; i++) signIn(b, 'staff@suraasa.com', 'wrong password');
  b.cache.clear();
  assert.ok(/Too many/.test(signIn(b, 'staff@suraasa.com', 'correct horse battery').error));
});
test('a lock ends by itself', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  for (let i = 0; i < 5; i++) signIn(b, 'staff@suraasa.com', 'wrong password');
  b.props.set('pwf:staff@suraasa.com', JSON.stringify({ n: 5, u: Date.now() - 1 }));
  assert.ok(signIn(b, 'staff@suraasa.com', 'correct horse battery').ok);
});
test('making someone inactive or removing them ends their password and sessions for good', () => {
  const b = pwBackend(); b.ctx.pwStore_('boss@suraasa.com', 'boss long password', false); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  const boss = signIn(b, 'boss@suraasa.com', 'boss long password').session, staff = signIn(b, 'staff@suraasa.com', 'correct horse battery').session;
  assert.ok(b.post({ action: 'apply', session: boss, requestId: 'u1', ops: [{ c: 'users', id: 'staff@suraasa.com', rec: { active: false } }] }).ok);
  assert.ok(b.post({ action: 'apply', session: boss, requestId: 'u2', ops: [{ c: 'users', id: 'staff@suraasa.com', rec: { active: true } }] }).ok);
  assert.ok(b.post({ action: 'pull', session: staff }).auth === true, 'the old session has ended');
  assert.ok(!signIn(b, 'staff@suraasa.com', 'correct horse battery').ok, 'the old password has gone');
  b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  assert.ok(b.post({ action: 'apply', session: boss, requestId: 'u3', ops: [{ c: 'users', id: 'staff@suraasa.com', del: true }] }).ok);
  assert.ok(!b.props.has('pw:staff@suraasa.com'));
});
test('a temporary password expires', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'temp-pass-1234', true);
  const rec = JSON.parse(b.props.get('pw:staff@suraasa.com'));
  assert.ok(rec.e > Date.now() + 2.9 * 86400000 && rec.e < Date.now() + 3.1 * 86400000);
  rec.e = Date.now() - 1; b.props.set('pw:staff@suraasa.com', JSON.stringify(rec));
  const r = signIn(b, 'staff@suraasa.com', 'temp-pass-1234'); assert.ok(!r.ok && !r.session && /expired/.test(r.error));
});
test('a reset also ends a Google session', () => {
  const b = pwBackend(); b.props.set('AUTH_CLIENT_ID', CLIENT);
  const g = b.sessionFor('staff@suraasa.com').session, wait = Date.now() + 3; while (Date.now() < wait);
  assert.ok(b.post({ action: 'pull', session: g }).state);
  b.ctx.pwStore_('staff@suraasa.com', 'temp-pass-1234', true);
  assert.ok(b.post({ action: 'pull', session: g }).auth === true);
});
test('the emergency switch cannot be used to take over an account', () => {
  const b = pwBackend(); b.ctx.pwStore_('staff@suraasa.com', 'correct horse battery', false);
  b.props.set('AUTH_REQUIRED', 'false'); b.props.set('AUTH_OFF_UNTIL', String(Date.now() + 60000));
  assert.ok(!b.post({ action: 'password_reset', email: 'staff@suraasa.com' }).ok);
});
test('passwords are never saved as text, and the same password hashes differently for two people', () => {
  const b = pwBackend(); const pw = 'correct horse battery';
  b.ctx.pwStore_('staff@suraasa.com', pw, true); b.ctx.pwStore_('boss@suraasa.com', pw, false);
  const s = signIn(b, 'staff@suraasa.com', pw).session;
  b.post({ action: 'password_change', session: s, newPassword: 'my own good password' });
  const everything = JSON.stringify([...b.props.entries()]) + JSON.stringify(Object.values(b.ss.sheets).map(x => x.cells)) + JSON.stringify([...b.cache.entries()]);
  assert.ok(!everything.includes(pw) && !everything.includes('my own good password'));
  assert.notStrictEqual(JSON.parse(b.props.get('pw:staff@suraasa.com')).h, JSON.parse(b.props.get('pw:boss@suraasa.com')).h);
  assert.ok(!JSON.stringify(b.ss.getSheetByName('Users').cells).includes(JSON.parse(b.props.get('pw:boss@suraasa.com')).h), 'no hash in the Sheet');
  assert.ok(JSON.stringify(b.ss.getSheetByName('AuditLog').cells).includes('password_changed'));
});
test('bad sign-in input is refused without an error', () => {
  const b = pwBackend();
  for (const [e, p] of [['', ''], ['no-at-sign', 'x'], ['a@b.c', ''], ['a b@suraasa.com', 'x'], ['x'.repeat(300) + '@suraasa.com', 'x'], ['staff@suraasa.com', 'x'.repeat(201)], [{ a: 1 }, ['x']]]) {
    const r = signIn(b, e, p); assert.ok(r.ok === false && r.auth === true, JSON.stringify(r));
  }
  assert.ok(b.post({ action: 'password_change', session: 'junk', newPassword: 'long enough password' }).auth === true);
});
// ---------- edits in the Sheet ----------
test('every edit in the Sheet counts, even two within a second', () => {
  const { b } = company(), sh = b.ss.getSheetByName('Tasks'), v = b.get({ action: 'version' }).version;
  b.ctx.onEdit({ range: sh.getRange(2, 5), oldValue: 'x', value: 'y' });
  const one = b.get({ action: 'version' }).version;
  b.ctx.onEdit({ range: sh.getRange(3, 5), oldValue: 'x', value: 'y' });
  assert.ok(one > v); assert.ok(b.get({ action: 'version' }).version > one);
});
test('the version check answers from the cache, and every kind of change updates it', () => {
  const { b, s } = company(), a = s('boss@suraasa.com'), reads = b.ctx.metaMap_;
  const v = b.get({ action: 'version' }).version; let n = 0;
  b.ctx.metaMap_ = () => { n++; return reads(); };
  b.get({ action: 'version' }); assert.strictEqual(n, 0, 'no Sheet read');
  b.ctx.metaMap_ = reads;
  const t = pull(b, a).state.tasks[0];
  assert.ok(b.post({ action: 'apply', session: a, requestId: 'q1', ops: [{ c: 'tasks', id: t.id, set: { progress: 7 }, base: { progress: t.progress } }] }).ok);
  assert.ok(b.get({ action: 'version' }).version > v, 'a save from the site');
  const w = b.get({ action: 'version' }).version;
  b.cache.delete('ver');
  assert.strictEqual(b.get({ action: 'version' }).version, w, 'and the Sheet still answers if the cache is empty');
});
test('adding or removing rows counts, and formatting does not', () => {
  const { b } = company(), v = () => b.get({ action: 'version' }).version, start = v();
  b.ctx.onSheetChange({ changeType: 'FORMAT' }); b.ctx.onSheetChange({ changeType: 'EDIT' }); b.ctx.onSheetChange(null);
  assert.strictEqual(v(), start);
  b.ctx.onSheetChange({ changeType: 'REMOVE_ROW' }); assert.ok(v() > start);
  const n = v(); b.ctx.onSheetChange({ changeType: 'INSERT_ROW' }); assert.ok(v() > n);
});
test('turning on instant updates makes one trigger, however many times it is clicked', () => {
  const { b } = company(); b.ctx.SpreadsheetApp.getUi = () => ({ alert() {} });
  b.ctx.turnOnInstantUpdates(); b.ctx.turnOnInstantUpdates();
  assert.strictEqual(b.ctx.ScriptApp.triggers.filter(t => t.getHandlerFunction() === 'onSheetChange').length, 1);
});
test('an edit made while the tabs are being read still looks new afterwards', () => {
  const { b, s } = company(), a = s('boss@suraasa.com'), sheets = b.ctx.readTab_; let done = false;
  b.ctx.readTab_ = function (...x) { if (!done) { done = true; b.ctx.bumpVersion_('edit during a read'); } return sheets(...x); };
  const r = pull(b, a); b.ctx.readTab_ = sheets;
  assert.ok(r.version < b.get({ action: 'version' }).version);
});
const failed = results.filter(r => r[0] === 'FAIL');
results.forEach(r => console.log(r[0], r[1]));
console.log(results.length - failed.length + ' of ' + results.length + ' passed');
