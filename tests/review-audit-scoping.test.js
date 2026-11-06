// Test suite for Review Finding 1: get_audit and get_snapshots permission scoping & redaction
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
function setupFixture() {
  const b = createBackend({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_REQUIRED: 'true', AUTH_DOMAIN: 'suraasa.com' } });
  b.props.set('AUTH_REQUIRED', 'false');
  b.load(seedState());
  b.props.set('AUTH_REQUIRED', 'true');
  b.addUser({ email: 'admin@suraasa.com', name: 'Super Admin', role: 'Administrator' });
  b.addUser({ email: 'manager@suraasa.com', name: 'Manager Bob', role: 'Project Owner' });
  b.addUser({ email: 'other_manager@suraasa.com', name: 'Other Manager', role: 'Project Owner' });
  b.addUser({ email: 'employee@suraasa.com', name: 'Employee Alice', role: 'Task Owner' });
  b.addUser({ email: 'other_emp@suraasa.com', name: 'Employee Charlie', role: 'Task Owner' });
  b.addUser({ email: 'viewer@suraasa.com', name: 'Viewer Dave', role: 'Viewer' });

  const ad = b.sessionFor('admin@suraasa.com').session;

  // Create Project A (open) and Project B (restricted to Other Manager)
  const pA = 'PRJ-TEST-A', pB = 'PRJ-TEST-B';
  b.post({
    action: 'apply', session: ad,
    ops: [
      { c: 'projects', id: pA, create: true, rec: { id: pA, name: 'Open Project A', owner: 'Manager Bob', restricted: false } },
      { c: 'projects', id: pB, create: true, rec: { id: pB, name: 'Restricted Project B', owner: 'Other Manager', restricted: true } },
      // Tasks in Project A
      { c: 'tasks', id: 'T-ALICE-1', create: true, rec: { id: 'T-ALICE-1', name: 'Alice Task 1', projectId: pA, owner: 'Employee Alice', ownerEmail: 'employee@suraasa.com', status: 'In Progress' } },
      { c: 'tasks', id: 'T-CHARLIE-1', create: true, rec: { id: 'T-CHARLIE-1', name: 'Charlie Task 1', projectId: pA, owner: 'Employee Charlie', ownerEmail: 'other_emp@suraasa.com', status: 'In Progress' } },
      // Task in Project B
      { c: 'tasks', id: 'T-SECRET-1', create: true, rec: { id: 'T-SECRET-1', name: 'Secret Task B', projectId: pB, owner: 'Employee Charlie', ownerEmail: 'other_emp@suraasa.com', status: 'In Progress' } }
    ]
  });

  // Reassign a task formerly owned by Alice to Charlie
  b.post({
    action: 'apply', session: ad,
    ops: [
      { c: 'tasks', id: 'T-ALICE-TRANSFERRED', create: true, rec: { id: 'T-ALICE-TRANSFERRED', name: 'Alice Handover Task', projectId: pA, owner: 'Employee Alice', ownerEmail: 'employee@suraasa.com', status: 'In Progress' } }
    ]
  });
  b.post({
    action: 'apply', session: ad,
    ops: [
      { c: 'tasks', id: 'T-ALICE-TRANSFERRED', set: { owner: 'Employee Charlie', ownerEmail: 'other_emp@suraasa.com' }, base: { owner: 'Employee Alice', ownerEmail: 'employee@suraasa.com' } }
    ]
  });

  // Add snapshots for Project A and Project B
  const snapSh = b.ss.getSheetByName('Snapshots');
  const row1 = snapSh.getLastRow() + 1;
  snapSh.getRange(row1, 1, 1, 8).setValues([['2026-11-06', pA, 50, 2, 1, 0, 0, 'Green']]);
  const row2 = snapSh.getLastRow() + 1;
  snapSh.getRange(row2, 1, 1, 8).setValues([['2026-11-06', pB, 20, 1, 0, 1, 0, 'Red']]);

  return b;
}

const sess = (b, email) => b.sessionFor(email).session;

console.log('\n====================================================');
console.log('  REVIEW FIX 1: AUDIT & SNAPSHOT SCOPING TESTS');
console.log('====================================================\n');

test('Super Admin sees all audit rows via get_audit', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_audit', session: sess(b, 'admin@suraasa.com'), limit: 1000 });
  assert.ok(res.ok);
  assert.ok(Array.isArray(res.audit));
  assert.ok(res.audit.some(r => r.taskId === 'T-ALICE-1'), 'sees Alice task audit');
  assert.ok(res.audit.some(r => r.taskId === 'T-CHARLIE-1'), 'sees Charlie task audit');
  assert.ok(res.audit.some(r => r.projectId === 'PRJ-TEST-B'), 'sees restricted Project B audit');
});

test('Manager cannot see audit rows of restricted projects they do not own', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_audit', session: sess(b, 'manager@suraasa.com'), limit: 1000 });
  assert.ok(res.ok);
  assert.ok(res.audit.some(r => r.projectId === 'PRJ-TEST-A'), 'sees open Project A audit');
  assert.ok(!res.audit.some(r => r.projectId === 'PRJ-TEST-B'), 'hidden from restricted Project B audit');
});

test('Employee (Task Owner) get_audit hides other employees tasks and unassigned projects', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_audit', session: sess(b, 'employee@suraasa.com'), limit: 1000 });
  assert.ok(res.ok);
  // Employee Alice must see audit for her own task
  assert.ok(res.audit.some(r => r.taskId === 'T-ALICE-1'), 'Alice sees audit for her own task');
  // Employee Alice MUST NOT see audit for Charlie task
  assert.ok(!res.audit.some(r => r.taskId === 'T-CHARLIE-1'), 'Alice CANNOT see Charlie task audit');
  // Alice MUST NOT see restricted Project B audit
  assert.ok(!res.audit.some(r => r.projectId === 'PRJ-TEST-B'), 'Alice CANNOT see Project B audit');
});

test('Employee (Task Owner) get_audit redacts details for former owned task', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_audit', session: sess(b, 'employee@suraasa.com'), limit: 1000 });
  assert.ok(res.ok);
  const transferred = res.audit.find(r => r.taskId === 'T-ALICE-TRANSFERRED');
  assert.ok(transferred, 'Alice sees audit entry for task formerly owned');
  assert.strictEqual(transferred.actorName, '', 'actorName is redacted');
  assert.strictEqual(transferred.actorEmail, '', 'actorEmail is redacted');
  assert.strictEqual(transferred.newValue, '', 'newValue is redacted');
  assert.strictEqual(transferred.text, 'A task you owned was given to someone else.', 'text is redacted message');
});

test('Super Admin sees all snapshots via get_snapshots', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_snapshots', session: sess(b, 'admin@suraasa.com') });
  assert.ok(res.ok);
  assert.ok(res.snapshots.some(s => s.projectId === 'PRJ-TEST-A'));
  assert.ok(res.snapshots.some(s => s.projectId === 'PRJ-TEST-B'));
});

test('Manager get_snapshots hides restricted projects not owned', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_snapshots', session: sess(b, 'manager@suraasa.com') });
  assert.ok(res.ok);
  assert.ok(res.snapshots.some(s => s.projectId === 'PRJ-TEST-A'));
  assert.ok(!res.snapshots.some(s => s.projectId === 'PRJ-TEST-B'), 'Project B snapshot hidden from Manager');
});

test('Employee get_snapshots hides projects where employee has no work', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_snapshots', session: sess(b, 'employee@suraasa.com') });
  assert.ok(res.ok);
  assert.ok(res.snapshots.some(s => s.projectId === 'PRJ-TEST-A'), 'Alice has tasks in Project A');
  assert.ok(!res.snapshots.some(s => s.projectId === 'PRJ-TEST-B'), 'Alice has no tasks in Project B');
});

test('Viewer get_snapshots hides restricted projects', () => {
  const b = setupFixture();
  const res = b.post({ action: 'get_snapshots', session: sess(b, 'viewer@suraasa.com') });
  assert.ok(res.ok);
  assert.ok(res.snapshots.some(s => s.projectId === 'PRJ-TEST-A'));
  assert.ok(!res.snapshots.some(s => s.projectId === 'PRJ-TEST-B'), 'Project B snapshot hidden from Viewer');
});

console.log('\nResults:');
results.forEach(r => console.log(r[0] + ' ' + r[1]));
console.log(`\n${results.filter(r => r[0] === 'PASS').length} of ${results.length} passed\n`);
if (results.some(r => r[0] === 'FAIL')) process.exit(1);
