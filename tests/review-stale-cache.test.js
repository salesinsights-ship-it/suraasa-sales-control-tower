// Test suite for Review Finding 3: Stale cache, hand edits, hand deletes, and shifted rows
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
function setup() {
  const b = createBackend({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_REQUIRED: 'true', AUTH_DOMAIN: 'suraasa.com' } });
  b.props.set('AUTH_REQUIRED', 'false');
  b.load(seedState());
  b.props.set('AUTH_REQUIRED', 'true');
  b.addUser({ email: 'admin@suraasa.com', name: 'Super Admin', role: 'Administrator' });
  return b;
}

const session = b => b.sessionFor('admin@suraasa.com').session;

console.log('\n====================================================');
console.log('  REVIEW FIX 3: STALE CACHE & HAND EDITS TESTS');
console.log('====================================================\n');

test('row deleted by hand in the Sheet is rejected as missing and NOT recreated', () => {
  const b = setup();
  const s = session(b);
  const st = b.post({ action: 'pull', session: s }).state;
  const t = st.tasks[0];
  assert.ok(t, 'found a task');

  // Simulate hand delete in the Tasks sheet: delete the row
  const sh = b.ss.getSheetByName('Tasks');
  const row = b.ctx.rowOfId_(sh, 1, t.id);
  assert.ok(row > 0, 'found row in Sheet');
  sh.deleteRow(row);

  // An update save sent from a browser that still had the old task in its cache
  const res = b.post({
    action: 'apply', session: s,
    ops: [{ c: 'tasks', id: t.id, set: { status: 'Completed' }, base: { status: t.status } }]
  });

  assert.strictEqual(res.ok, false);
  assert.ok(res.rejected && res.rejected.length > 0, 'rejected');
  assert.strictEqual(res.rejected[0].code, 'missing');
  assert.strictEqual(res.rejected[0].reason, 'This record no longer exists.');

  // Confirm the task was NOT recreated in the Sheet
  const checkRow = b.ctx.rowOfId_(sh, 1, t.id);
  assert.strictEqual(checkRow, -1, 'deleted task was NOT resurrected');
});

test('row edited by hand in the Sheet is detected and cannot be overwritten with stale data', () => {
  const b = setup();
  const s = session(b);
  const st = b.post({ action: 'pull', session: s }).state;
  const t = st.tasks[0];

  // Hand edit: someone directly changes status in the Sheet to 'Blocked'
  const sh = b.ss.getSheetByName('Tasks');
  const row = b.ctx.rowOfId_(sh, 1, t.id);
  const statusCol = b.ctx.schemaFor_('tasks').cols.indexOf('status') + 1;
  sh.getRange(row, statusCol).setValue('Blocked');

  // Website tries to save 'Completed' with old base value
  const res = b.post({
    action: 'apply', session: s,
    ops: [{ c: 'tasks', id: t.id, set: { status: 'Completed' }, base: { status: t.status } }]
  });

  assert.strictEqual(res.ok, false);
  assert.ok(res.rejected && res.rejected.length > 0);
  assert.strictEqual(res.rejected[0].code, 'conflict');
  assert.ok(/Status was changed/i.test(res.rejected[0].reason), res.rejected[0].reason);

  // Live Sheet value remains 'Blocked'
  assert.strictEqual(sh.getRange(row, statusCol).getValues()[0][0], 'Blocked');
});

test('hand edit to a different field is preserved when saving another field', () => {
  const b = setup();
  const s = session(b);
  const st = b.post({ action: 'pull', session: s }).state;
  const t = st.tasks[0];

  // Hand edit priority in the Sheet to 'P0'
  const sh = b.ss.getSheetByName('Tasks');
  const row = b.ctx.rowOfId_(sh, 1, t.id);
  const prioCol = b.ctx.schemaFor_('tasks').cols.indexOf('priority') + 1;
  sh.getRange(row, prioCol).setValue('P0');

  // Website updates only desc
  const res = b.post({
    action: 'apply', session: s,
    ops: [{ c: 'tasks', id: t.id, set: { desc: 'Updated description from website' }, base: { desc: t.desc || '' } }]
  });

  assert.ok(res.ok, 'save accepted for different field');
  // Hand edit to priority was preserved!
  assert.strictEqual(sh.getRange(row, prioCol).getValues()[0][0], 'P0', 'hand edited priority is preserved');
});

test('rows shifted or sorted by hand are detected and written to correct new row', () => {
  const b = setup();
  const s = session(b);
  const st = b.post({ action: 'pull', session: s }).state;
  const t1 = st.tasks[0], t2 = st.tasks[1];

  const sh = b.ss.getSheetByName('Tasks');
  const r1 = b.ctx.rowOfId_(sh, 1, t1.id);
  const r2 = b.ctx.rowOfId_(sh, 1, t2.id);

  // Swap rows in the Sheet to simulate manual sorting/shift
  const vals1 = sh.getRange(r1, 1, 1, 30).getValues()[0];
  const vals2 = sh.getRange(r2, 1, 1, 30).getValues()[0];
  sh.getRange(r1, 1, 1, 30).setValues([vals2]);
  sh.getRange(r2, 1, 1, 30).setValues([vals1]);

  // Save changes to t1
  const res = b.post({
    action: 'apply', session: s,
    ops: [{ c: 'tasks', id: t1.id, set: { desc: 'Sorted row test' }, base: { desc: t1.desc || '' } }]
  });

  assert.ok(res.ok, 'save succeeded despite shifted rows');
  // Confirm t1 was written to its NEW row (r2) and did NOT corrupt t2 at r1
  const checkR1 = sh.getRange(r1, 1).getValues()[0][0];
  const checkR2 = sh.getRange(r2, 1).getValues()[0][0];
  assert.strictEqual(checkR1, t2.id, 't2 is still in row 1');
  assert.strictEqual(checkR2, t1.id, 't1 was updated in row 2');
});

console.log('\nResults:');
results.forEach(r => console.log(r[0] + ' ' + r[1]));
console.log(`\n${results.filter(r => r[0] === 'PASS').length} of ${results.length} passed\n`);
if (results.some(r => r[0] === 'FAIL')) process.exit(1);

