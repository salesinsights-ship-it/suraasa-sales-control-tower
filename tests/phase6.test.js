// Phase 6 Verification Test Suite
// Tests concurrent website + Sheet edits, two browsers, stale/empty cache,
// row shifting/sorting in Sheet, instant deactivation, and security rules.
// Run: node tests/phase6.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createBackend } = require('./mock-gas');

const CLIENT = 'test.apps.googleusercontent.com';
const data = () => new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8') + ';return buildSeed();')();
const future = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

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

function setupCompany() {
  const b = createBackend({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_DOMAIN: 'suraasa.com' } });
  b.load(data());
  [
    ['admin@suraasa.com', 'Admin User', 'Administrator'],
    ['mgr@suraasa.com', 'Manager Mike', 'Project Owner'],
    ['worker@suraasa.com', 'Worker Bob', 'Task Owner'],
    ['viewer@suraasa.com', 'Viewer Val', 'Viewer']
  ].forEach(u => b.addUser({ email: u[0], name: u[1], role: u[2] }));
  b.addUser({ email: 'inactive@suraasa.com', name: 'Inactive Ian', role: 'Task Owner', active: false });
  b.props.set('AUTH_REQUIRED', 'true');
  const s = e => b.sessionFor(e).session;
  return { b, s };
}

// ============================================================
// 1. TWO BROWSERS EDITING THE SAME TASK
// ============================================================

test('two browsers changing different fields of the same task both succeed', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');
  const t = b.post({ action: 'pull', session: adm }).state.tasks[0];

  // Browser 1 changes status
  const r1 = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Browser 1',
    requestId: 'req-b1-diff',
    ops: [{ c: 'tasks', id: t.id, set: { status: 'In Progress' }, base: { status: t.status } }]
  });
  assert.ok(r1.ok, 'Browser 1 edit should succeed');

  // Browser 2 changes priority
  const r2 = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Browser 2',
    requestId: 'req-b2-diff',
    ops: [{ c: 'tasks', id: t.id, set: { priority: 'P0' }, base: { priority: t.priority } }]
  });
  assert.ok(r2.ok, 'Browser 2 edit should succeed');

  const after = b.post({ action: 'pull', session: adm }).state.tasks.find(x => x.id === t.id);
  assert.strictEqual(after.status, 'In Progress');
  assert.strictEqual(after.priority, 'P0');
});

test('two browsers changing the same field: second is refused with conflict, no silent overwrite', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');
  const t = b.post({ action: 'pull', session: adm }).state.tasks[0];

  // Browser 1 updates due date
  const r1 = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Browser 1',
    requestId: 'req-b1-same',
    ops: [{ c: 'tasks', id: t.id, set: { due: future(10) }, base: { due: t.due } }]
  });
  assert.ok(r1.ok);

  // Browser 2 attempts to update due date based on original stale due date
  const r2 = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Browser 2',
    requestId: 'req-b2-same',
    ops: [{ c: 'tasks', id: t.id, set: { due: future(20) }, base: { due: t.due } }]
  });
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.rejected[0].code, 'conflict');
  assert.strictEqual(r2.rejected[0].field, 'due');

  // Verify Browser 1's date is preserved and not overwritten
  const after = b.post({ action: 'pull', session: adm }).state.tasks.find(x => x.id === t.id);
  assert.strictEqual(after.due, future(10));
});

test('two browsers adding notes simultaneously: both notes are preserved without loss', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');
  const t = b.post({ action: 'pull', session: adm }).state.tasks[0];

  const note1 = { id: 'n1', type: 'comment', text: 'Note from Browser 1', author: 'Admin User', ts: new Date().toISOString() };
  const note2 = { id: 'n2', type: 'comment', text: 'Note from Browser 2', author: 'Admin User', ts: new Date().toISOString() };

  // Browser 1 adds note
  const r1 = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Admin User',
    requestId: 'req-b1-note',
    ops: [{ c: 'tasks', id: t.id, set: { notes: [note1] }, base: { notes: [] } }]
  });
  assert.ok(r1.ok);

  // Browser 2 adds note concurrently (base was still empty)
  const r2 = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Admin User',
    requestId: 'req-b2-note',
    ops: [{ c: 'tasks', id: t.id, set: { notes: [note2] }, base: { notes: [] } }]
  });
  assert.ok(r2.ok);

  const after = b.post({ action: 'pull', session: adm }).state.tasks.find(x => x.id === t.id);
  assert.strictEqual(after.notes.length, 2);
  const texts = after.notes.map(n => n.text);
  assert.ok(texts.includes('Note from Browser 1'));
  assert.ok(texts.includes('Note from Browser 2'));
});

// ============================================================
// 2. EDITS ON WEBSITE AND IN SHEET AT THE SAME MOMENT
// ============================================================

test('website save and direct Sheet edit at the same moment both persist', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');
  const t = b.post({ action: 'pull', session: adm }).state.tasks[0];

  // 1. Direct Sheet edit happens on 'due'
  const sh = b.ss.getSheetByName('Tasks');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const dueCol = head.indexOf('due') + 1;
  const newSheetDue = future(45);
  // Find task row in sheet
  let taskRow = -1;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][head.indexOf('id')] === t.id) { taskRow = i + 2; break; }
  }
  assert.ok(taskRow > 1);

  // Simulate human edit directly in Sheet (triggers onEdit + bumpVersion)
  sh.getRange(taskRow, dueCol).setValue(newSheetDue);
  b.ctx.onEdit({
    range: sh.getRange(taskRow, dueCol),
    value: newSheetDue,
    oldValue: t.due,
    user: { getEmail: () => 'editor@suraasa.com' }
  });

  // 2. Website applies change on 'status'
  const r = b.post({
    action: 'apply',
    session: adm,
    actorName: 'Web User',
    requestId: 'req-web-sheet-simultaneous',
    ops: [{ c: 'tasks', id: t.id, set: { status: 'In Progress' }, base: { status: t.status } }]
  });
  assert.ok(r.ok, 'Website apply should succeed even after direct Sheet edit');

  // Verify both edits landed in Sheet
  const after = b.post({ action: 'pull', session: adm }).state.tasks.find(x => x.id === t.id);
  assert.strictEqual(after.status, 'In Progress', 'Website status edit persisted');
  assert.strictEqual(after.due, newSheetDue, 'Sheet direct due edit persisted');

  // Verify audit log has entries for both
  const audit = b.post({ action: 'get_audit', session: adm }).audit;
  assert.ok(audit.some(a => a.action === 'sheet_edit' && a.newValue === newSheetDue));
  assert.ok(audit.some(a => a.action === 'status_changed' && a.newValue === 'In Progress'));
});

// ============================================================
// 3. STALE CACHE AND EMPTY CACHE EVICTION
// ============================================================

test('empty cache eviction gracefully falls back to reading the Sheet', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');

  // Populate cache via pull
  const r1 = b.post({ action: 'pull', session: adm });
  assert.ok(r1.ok);

  // Evict data cache (simulating Google Apps Script cache eviction / purge of data keys)
  for (const k of [...b.cache.keys()]) {
    if (k.startsWith('raw_v') || k.startsWith('rowmap_') || k === 'ver' || k === 'users_list') {
      b.cache.delete(k);
    }
  }

  // Subsequent pull must transparently re-read Sheet and rebuild cache
  const r2 = b.post({ action: 'pull', session: adm });
  assert.ok(r2.ok);
  assert.strictEqual(r2.state.tasks.length, r1.state.tasks.length);
  assert.strictEqual(r2.version, r1.version);

  // Verify cache was re-populated with versioned chunks
  const hasMeta = [...b.cache.keys()].some(k => k.startsWith('raw_v') && k.endsWith('_m'));
  assert.ok(hasMeta, 'Cache chunks should be rebuilt after cache miss');
});

test('stale cache version automatically detects newer Sheet version and refreshes', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');

  const r1 = b.post({ action: 'pull', session: adm });
  const oldVer = r1.version;

  // Manually bump sheet version via bumpVersion_
  const newVer = b.ctx.bumpVersion_('manual bump');
  assert.strictEqual(newVer, oldVer + 1);

  // Pull should see new version, miss old raw_v<oldVer> cache, and return fresh state
  const r2 = b.post({ action: 'pull', session: adm });
  assert.strictEqual(r2.version, newVer);
  assert.ok(r2.ok);
});

// ============================================================
// 4. ROWS SORTED OR REMOVED BY HAND IN GOOGLE SHEET
// ============================================================

test('rows sorted or shifted by hand: ID mismatch is detected and full scan safely writes to correct row', () => {
  const { b, s } = setupCompany();
  const adm = s('admin@suraasa.com');
  const t1 = b.post({ action: 'pull', session: adm }).state.tasks[0];
  const t2 = b.post({ action: 'pull', session: adm }).state.tasks[1];

  // Prime the cached ID-to-row map by performing a save on t1
  const prime = b.post({
    action: 'apply',
    session: adm,
    ops: [{ c: 'tasks', id: t1.id, set: { priority: 'P2' }, base: { priority: t1.priority } }]
  });
  assert.ok(prime.ok);

  // Now simulate someone manually swapping row 2 and row 3 in the Sheet
  const sh = b.ss.getSheetByName('Tasks');
  const row2Vals = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
  const row3Vals = sh.getRange(3, 1, 1, sh.getLastColumn()).getValues()[0];

  // Swap them physically in cells without updating cache
  sh.getRange(2, 1, 1, sh.getLastColumn()).setValues([row3Vals]);
  sh.getRange(3, 1, 1, sh.getLastColumn()).setValues([row2Vals]);

  // Now send a save for t1 (whose old map entry points to row 2, which now holds t2!)
  const r = b.post({
    action: 'apply',
    session: adm,
    ops: [{ c: 'tasks', id: t1.id, set: { status: 'In Progress' }, base: { status: t1.status } }]
  });
  assert.ok(r.ok, 'Save should succeed by detecting row shift and falling back to full scan');

  // Verify t1 was updated at its NEW row (row 3) and t2 was NOT corrupted
  const row2After = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
  const row3After = sh.getRange(3, 1, 1, sh.getLastColumn()).getValues()[0];
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idCol = head.indexOf('id');
  const statusCol = head.indexOf('status');

  assert.strictEqual(row3After[idCol], t1.id, 'Row 3 should contain t1');
  assert.strictEqual(row3After[statusCol], 'In Progress', 't1 status should be In Progress');
  assert.strictEqual(row2After[idCol], t2.id, 'Row 2 should still contain t2');
  assert.strictEqual(row2After[statusCol], t2.status, 't2 status should remain uncorrupted');
});

// ============================================================
// 5. SECURITY: DEACTIVATION, LOCKOUT, TEMPORARY PASSWORDS & ROLES
// ============================================================

test('deactivation immediately clears users cache and denies access on next request', () => {
  const { b, s } = setupCompany();
  const workerSession = s('worker@suraasa.com');

  // Worker can pull initially
  const rInit = b.post({ action: 'pull', session: workerSession });
  assert.ok(rInit.ok && rInit.state);

  // Admin deactivates worker
  const admSession = s('admin@suraasa.com');
  const rDeact = b.post({
    action: 'apply',
    session: admSession,
    ops: [{ c: 'users', id: 'worker@suraasa.com', rec: { active: false }, base: { active: true } }]
  });
  assert.ok(rDeact.ok);

  // Worker tries to pull immediately: must be refused with auth error
  const rBlocked = b.post({ action: 'pull', session: workerSession });
  assert.strictEqual(rBlocked.ok, false);
  assert.strictEqual(rBlocked.auth, true);
});

test('five wrong password attempts locks out user for 15 minutes', () => {
  const b = createBackend({ strict: true, props: { AUTH_DOMAIN: 'suraasa.com' } });
  b.addUser({ email: 'locked@suraasa.com', name: 'Lock User', role: 'Task Owner' });
  b.ctx.pwStore_('locked@suraasa.com', 'mypassword123', false);

  const signIn = pw => b.post({ action: 'password_login', email: 'locked@suraasa.com', password: pw });

  // 4 wrong attempts: wrong error
  for (let i = 0; i < 4; i++) {
    const r = signIn('wrong' + i);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /not right/);
  }

  // 5th wrong attempt triggers lockout
  const r5 = signIn('wrong5');
  assert.strictEqual(r5.ok, false);

  // 6th attempt even with correct password is locked out
  const r6 = signIn('mypassword123');
  assert.strictEqual(r6.ok, false);
  assert.match(r6.error, /Too many wrong tries/);

  // Admin resets password: immediately clears lockout
  b.addUser({ email: 'super@suraasa.com', name: 'Super Admin', role: 'Administrator' });
  b.ctx.pwStore_('super@suraasa.com', 'superpass123', false);
  const superSession = b.post({ action: 'password_login', email: 'super@suraasa.com', password: 'superpass123' }).session;
  assert.ok(superSession, 'Super admin should sign in');
  const resetRes = b.post({ action: 'password_reset', session: superSession, email: 'locked@suraasa.com' });
  assert.ok(resetRes.ok && resetRes.tempPassword);

  // Can now sign in with temporary password
  const rAfterReset = signIn(resetRes.tempPassword);
  assert.ok(rAfterReset.ok);
  assert.strictEqual(rAfterReset.mustChange, true);
});

test('role limits: Task Owner cannot modify project scope or access unauthorized projects', () => {
  const { b, s } = setupCompany();
  const workerSession = s('worker@suraasa.com');
  const st = b.post({ action: 'pull', session: workerSession }).state;
  const p = st.projects[0];

  // Worker tries to change project name: must be denied
  const r = b.post({
    action: 'apply',
    session: workerSession,
    ops: [{ c: 'projects', id: p.id, set: { name: 'Hacked Project Name' }, base: { name: p.name } }]
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.rejected[0].code, 'denied');
});

// Run summary
console.log('\n====================================================');
console.log('  PHASE 6 TEST SUITE: BEHAVIORAL VERIFICATION');
console.log('====================================================\n');
let passed = 0;
results.forEach(([status, name]) => {
  console.log(`${status} ${name}`);
  if (status === 'PASS') passed++;
});
console.log(`\n${passed} of ${results.length} passed\n`);
if (passed < results.length) process.exit(1);
