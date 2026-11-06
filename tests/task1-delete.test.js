// Tests for Task 1: Super Admin can delete any task, and role limits on deletions
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
function test(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ' :: ' + e.message]);
    process.exitCode = 1;
  }
}

const CLIENT = 'test.apps.googleusercontent.com';
function secured() {
  const b = createBackend({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_REQUIRED: 'true', AUTH_DOMAIN: 'suraasa.com' } });
  b.props.set('AUTH_REQUIRED', 'false');
  b.load(seedState());
  b.props.set('AUTH_REQUIRED', 'true');
  b.addUser({ email: 'admin@suraasa.com', name: 'Super Admin', role: 'Administrator' });
  b.addUser({ email: 'hos@suraasa.com', name: 'Head of Sales', role: 'Project Owner' });
  b.addUser({ email: 'pm2@suraasa.com', name: 'Second PM', role: 'Project Owner' });
  b.addUser({ email: 'employee@suraasa.com', name: 'Employee One', role: 'Task Owner' });
  b.addUser({ email: 'viewer@suraasa.com', name: 'Viewer One', role: 'Viewer' });
  return b;
}

const session = (b, email) => b.sessionFor(email).session;

console.log('\n====================================================');
console.log('  TASK 1 TEST SUITE: ROLE-BASED TASK DELETIONS');
console.log('====================================================\n');

test('Super Admin can delete a task they do not own', () => {
  const b = secured();
  const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const notOwned = st.tasks.find(t => t.owner !== 'Super Admin');
  assert.ok(notOwned, 'found a task not owned by admin');

  const res = b.post({
    action: 'apply',
    session: ad,
    ops: [{ c: 'tasks', id: notOwned.id, del: true }]
  });
  assert.ok(res.ok, 'deletion accepted by server');

  const after = b.post({ action: 'pull', session: ad }).state;
  assert.ok(!after.tasks.some(t => t.id === notOwned.id), 'task removed from active tasks');
  const trashEntry = after.trash.find(x => x.recordId === notOwned.id);
  assert.ok(trashEntry, 'task placed in Trash');
  assert.strictEqual(trashEntry.collection, 'tasks');
  assert.ok(after.audit.some(a => a.action === 'deleted' && a.entityId === notOwned.id), 'recorded in AuditLog');
});

test('Super Admin can delete a task in a restricted project', () => {
  const b = secured();
  const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const p = st.projects[0];
  // Mark project restricted
  b.post({ action: 'apply', session: ad, ops: [{ c: 'projects', id: p.id, set: { restricted: true }, base: {} }] });

  const t = st.tasks.find(x => x.projectId === p.id);
  assert.ok(t, 'found task in restricted project');

  const res = b.post({
    action: 'apply',
    session: ad,
    ops: [{ c: 'tasks', id: t.id, del: true }]
  });
  assert.ok(res.ok, 'super admin deleted task in restricted project');
});

test('Super Admin can delete a completed task', () => {
  const b = secured();
  const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const t = st.tasks[0];
  // Mark task completed
  b.post({ action: 'apply', session: ad, ops: [{ c: 'tasks', id: t.id, set: { status: 'Completed' }, base: { status: t.status } }] });

  const res = b.post({
    action: 'apply',
    session: ad,
    ops: [{ c: 'tasks', id: t.id, del: true }]
  });
  assert.ok(res.ok, 'super admin deleted completed task');
});

test('Manager (Project Owner) can delete a task in their own project', () => {
  const b = secured();
  const sHos = session(b, 'hos@suraasa.com');
  const st = b.post({ action: 'pull', session: sHos }).state;
  const myProj = st.projects.find(p => p.accountable === 'Head of Sales' || p.owner === 'Head of Sales');
  assert.ok(myProj, 'found project owned by Head of Sales');
  const t = st.tasks.find(x => x.projectId === myProj.id);
  assert.ok(t, 'found task in own project');

  const res = b.post({
    action: 'apply',
    session: sHos,
    ops: [{ c: 'tasks', id: t.id, del: true }]
  });
  assert.ok(res.ok, 'project owner deleted task in own project');
});

test('Manager (Project Owner) cannot delete a task in a project they do NOT own', () => {
  const b = secured();
  const sHos = session(b, 'hos@suraasa.com');
  const ad = session(b, 'admin@suraasa.com');
  const fullSt = b.post({ action: 'pull', session: ad }).state;
  const otherProj = fullSt.projects.find(p => p.accountable !== 'Head of Sales' && p.owner !== 'Head of Sales');
  assert.ok(otherProj, 'found other project');
  const t = fullSt.tasks.find(x => x.projectId === otherProj.id);
  assert.ok(t, 'found task in other project');

  const res = b.post({
    action: 'apply',
    session: sHos,
    ops: [{ c: 'tasks', id: t.id, del: true }]
  });
  assert.ok(!res.ok, 'manager refused deletion on unowned project');
  assert.strictEqual(res.rejected[0].code, 'denied');
});

test('Employee (Task Owner) cannot delete a task they own', () => {
  const b = secured();
  const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const t = st.tasks[0];
  // Assign task to employee
  b.post({ action: 'apply', session: ad, ops: [{ c: 'tasks', id: t.id, set: { owner: 'Employee One', ownerEmail: 'employee@suraasa.com' }, base: { owner: t.owner } }] });

  const sEmp = session(b, 'employee@suraasa.com');
  const res = b.post({
    action: 'apply',
    session: sEmp,
    ops: [{ c: 'tasks', id: t.id, del: true }]
  });
  assert.ok(!res.ok, 'employee cannot delete task');
  assert.strictEqual(res.rejected[0].code, 'denied');
});

test('Viewer cannot delete any task', () => {
  const b = secured();
  const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const t = st.tasks[0];

  const sViewer = session(b, 'viewer@suraasa.com');
  const res = b.post({
    action: 'apply',
    session: sViewer,
    ops: [{ c: 'tasks', id: t.id, del: true }]
  });
  assert.ok(!res.ok, 'viewer cannot delete task');
  assert.strictEqual(res.rejected[0].code, 'denied');
  assert.ok(/Viewers cannot change anything/.test(res.rejected[0].reason));
});

test('Save refusing more than 25 deletions in one save', () => {
  const b = secured();
  const ad = session(b, 'admin@suraasa.com');
  const st = b.post({ action: 'pull', session: ad }).state;
  const tasksToDelete = st.tasks.slice(0, 26).map(t => ({ c: 'tasks', id: t.id, del: true }));
  assert.ok(tasksToDelete.length >= 26, 'have 26 tasks to test batch limit');

  const res = b.post({
    action: 'apply',
    session: ad,
    ops: tasksToDelete
  });
  assert.ok(!res.ok, 'batch of >25 deletions refused');
  assert.ok(/more than 25 records/.test(res.error));
});

test('canDeleteT client-side logic correctly scopes roles', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.ok(appSrc.includes('const canDeleteT = t => isAdmin() || (t ? canManageT(t) : false);'), 'canDeleteT helper defined');
  assert.ok(appSrc.includes('const canDel = canDeleteT(t);'), 'taskRow uses canDeleteT');
  assert.ok(appSrc.includes('const allowed = list.filter(canDeleteT);'), 'deleteTasks uses canDeleteT');
  assert.ok(appSrc.includes('(canDel ? \'<button class="btn danger ghost" data-act="del-task"'), 'modal footer uses canDel');
});

for (const [status, name] of results) {
  console.log(`${status} ${name}`);
}

const failed = results.filter(r => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length} of ${results.length} passed\n`);
if (failed.length) process.exit(1);

