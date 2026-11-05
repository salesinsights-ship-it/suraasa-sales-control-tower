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
  assert.ok(/not been set up/.test(b.post({ action: 'login', idToken: 'x' }).error));
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
  assert.ok(b.post({ action: 'login', idToken: 'tok-rahul@suraasa.com' }).error.includes('no access'));
});
test('a token from the wrong issuer is refused', () => {
  const { b } = company(); b.tokens.bad = { aud: CLIENT, iss: 'https://evil.example', email: 'boss@suraasa.com', email_verified: 'true', exp: String(Date.now() / 1000 + 999) };
  assert.ok(/did not come from Google/.test(b.post({ action: 'login', idToken: 'bad' }).error));
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
  assert.strictEqual(r.employee.name, 'Rahul Verma');
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
  assert.strictEqual(r.api, 4); assert.strictEqual(r.auth.required, true); assert.strictEqual(r.auth.clientIdSet, true); assert.strictEqual(r.email.mode, 'live'); assert.strictEqual(r.email.accepted, 1); assert.strictEqual(r.automation.retry, false); assert.strictEqual(r.sheet.problems.length, 0);
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

const failed = results.filter(r => r[0] === 'FAIL');
results.forEach(r => console.log(r[0], r[1]));
console.log(results.length - failed.length + ' of ' + results.length + ' passed');
