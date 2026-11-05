/**
 * ============================================================
 *  Suraasa Sales Control Tower: Google Sheet backend (API 4)
 * ============================================================
 *  Paste this whole file over Code.gs in the Sheet's Apps Script
 *  editor, run setupSheet once, then Deploy > Manage deployments >
 *  Edit > New version. The /exec URL stays the same.
 *
 *  It is built on the version already running, so every existing
 *  tab and column stays as it is. It adds the tabs Users, AuditLog,
 *  Trash, Snapshots and NotificationLog. New columns go to the right
 *  of `_extra`, so an older script can still read the Sheet.
 *
 *  Nothing is readable without a Google sign-in. There is no setting
 *  that leaves the data open, apart from the one-hour emergency switch
 *  in the Sheet menu, which turns itself off.
 *
 *  Sheet conventions
 *  -----------------
 *  - Row 1 = header = field name used by the website. Do not rename.
 *  - Dates are text in YYYY-MM-DD. Lists are separated by a new line
 *    inside the cell or by ", ".
 *  - Leave the ID blank on a new row: one is generated on the next pull.
 *  - The `_extra` column holds fields the Sheet has no column for (JSON).
 *    Leave it alone.
 *  - AuditLog is append-only. Corrections are new rows.
 * ============================================================
 */

var APP = 'Suraasa Sales Control Tower';
var META_SHEET = '_Meta';
var ACTIVITY_SHEET = 'Activity';
var EXTRA = '_extra';
var NL = '\n';
var API = 4;
var DEFAULT_SITE_URL = 'https://suraasa-sales-control-tower-rouge.vercel.app/';

var STATUS_P = ['Not Started', 'In Progress', 'On Hold', 'Blocked', 'Completed'];
var STATUS_T = ['Backlog', 'Not Started', 'In Progress', 'Blocked', 'On Hold', 'In Review', 'Awaiting Approval', 'Changes Requested', 'Completed', 'Cancelled'];
var PRIOS = ['P0', 'P1', 'P2', 'P3'];
var HML = ['High', 'Medium', 'Low'];
var PRIO_WORDS = { P0: 'Critical', P1: 'High', P2: 'Medium', P3: 'Low' };

/**
 * One entry per tab. `cols` is the column order; `lists` are array
 * fields with their separator; `bools`/`nums` get type coercion;
 * `drop` adds a dropdown validation on that column; `prefix` is used to
 * auto-generate IDs for rows whose ID cell is blank.
 */
var SCHEMA = [
  { tab: 'Projects', key: 'projects', id: 'id', prefix: 'PRJ', width: 220,
    cols: ['id', 'name', 'category', 'type', 'program', 'valueClass', 'priority', 'priorityProposed', 'status', 'owner', 'accountable', 'sponsor', 'start', 'due', 'datesProposed', 'objective', 'problem', 'outcome', 'impact', 'metrics', 'dependencies', 'risks', 'assumptions', 'hypothesis', 'successCriteria', 'testPeriod', 'baseline', 'cadence', 'nextAction', 'priorityRationale', 'flags', 'clarification', 'parent', 'completedAt'],
    tail: ['ownerEmail', 'accountableEmail'],
    lists: { metrics: NL, dependencies: NL, risks: NL, assumptions: NL, flags: ', ' },
    bools: ['priorityProposed', 'datesProposed'],
    drop: { status: STATUS_P, priority: PRIOS,
      category: ['Revenue Generation', 'Funnel Conversion & Sales Productivity', 'B2B Business Development', 'Marketing & Demand Generation', 'Cross-functional Dependencies'],
      type: ['Project', 'Strategic Project', 'Experiment', 'Recurring Operation', 'Recurring Programme', 'Project → Recurring Ops', 'Dependency Cluster', 'Recurring Operation + Experiment'],
      valueClass: ['Revenue-generating', 'Conversion improvement', 'Operational efficiency', 'Strategic growth', 'Experiment', 'Dependency'] } },
  { tab: 'Workstreams', key: 'workstreams', nested: 'projects', parentKey: 'projectId', id: 'id', prefix: 'WS',
    cols: ['projectId', 'id', 'name'] },
  { tab: 'Milestones', key: 'milestones', nested: 'projects', parentKey: 'projectId', id: 'id', prefix: 'MS',
    cols: ['projectId', 'id', 'name', 'due', 'status', 'ws'],
    drop: { status: ['Pending', 'In Progress', 'Completed'] } },
  { tab: 'RACI', key: 'raci', nested: 'projects', parentKey: 'projectId',
    cols: ['projectId', 'item', 'R', 'A', 'C', 'I'],
    lists: { R: ', ', C: ', ', I: ', ' } },
  { tab: 'Comments', key: 'comments', nested: 'projects', parentKey: 'projectId',
    cols: ['projectId', 'who', 'text', 'ts'] },
  { tab: 'Tasks', key: 'tasks', id: 'id', prefix: 'T',
    cols: ['id', 'projectId', 'ws', 'ms', 'name', 'desc', 'owner', 'accountable', 'start', 'due', 'priority', 'status', 'progress', 'kind', 'parent', 'dependency', 'deliverable', 'criteria', 'datesProposed', 'completedAt'],
    tail: ['ownerEmail', 'assignedBy', 'assignedByEmail', 'assignedAt'],
    nums: ['progress'], bools: ['datesProposed'],
    drop: { status: STATUS_T, priority: PRIOS, kind: ['Task', 'Subtask', 'Recurring', 'Decision'] } },
  { tab: 'Risks', key: 'risks', id: 'id', prefix: 'R',
    cols: ['id', 'projectId', 'desc', 'impact', 'probability', 'mitigation', 'owner', 'deadline', 'status', 'source'],
    drop: { impact: HML, probability: HML, status: ['Open', 'Mitigated', 'Resolved', 'Escalated', 'Closed'] } },
  { tab: 'Dependencies', key: 'dependencies', id: 'id', prefix: 'DP',
    cols: ['id', 'projectId', 'desc', 'responsible', 'externalOwner', 'status', 'requiredBy', 'escalation'],
    drop: { status: ['Open', 'Escalated', 'Resolved', 'Closed'] } },
  { tab: 'Decisions', key: 'decisions', id: 'id', prefix: 'DEC',
    cols: ['id', 'projectId', 'decision', 'owner', 'raised', 'requiredBy', 'impact', 'status', 'final', 'source', 'decidedAt'],
    drop: { status: ['Open', 'Pending Ankit Khanna decision', 'Decided', 'Deferred', 'Closed', 'Escalated'] } },
  { tab: 'Actions', key: 'actions', id: 'id', prefix: 'A',
    cols: ['id', 'kind', 'action', 'why', 'ownerRole', 'priority', 'output', 'dependency', 'timeline', 'projectId', 'taskId', 'bucket'],
    drop: { kind: ['Pending action', 'Recommendation'], priority: PRIOS,
      bucket: ['Implement immediately', 'Requires a decision', 'Requires technology / CRM support', 'Requires another department', 'Requires a pilot / experiment', 'Requires a complete project plan'] } },
  { tab: 'WeeklyUpdates', key: 'updates', id: 'id', prefix: 'U',
    cols: ['id', 'projectId', 'week', 'author', 'rag', 'progress', 'completed', 'blockers', 'missed', 'next', 'decisions', 'ts'],
    drop: { rag: ['Green', 'Amber', 'Red', 'Grey'] } },
  { tab: 'Programs', key: 'programs', id: 'id', prefix: 'SI',
    cols: ['id', 'name', 'objective', 'children', 'note'],
    lists: { children: ', ' } },
  { tab: 'Roles', key: 'roles',
    cols: ['name', 'kind', 'note'],
    drop: { kind: ['Confirmed', 'Confirmed (team)', 'External', 'Proposed role'] } }
];

/** All columns of a tab. `tail` columns sit right of `_extra`, so older code that reads by position still works. */
function allCols_(s) { return s.cols.concat([EXTRA]).concat(s.tail || []); }
function ensureCols_(sh, n) { var max = sh.getMaxColumns(); if (n > max) sh.insertColumnsAfter(max, n - max); }

// ------------------------------------------------------------
//  Menu + setup
// ------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Control Tower')
    .addItem('Set up / repair tabs', 'setupSheet')
    .addItem('Bump version (force website refresh)', 'bumpVersionMenu')
    .addItem('Show sync status', 'showStatus')
    .addSeparator()
    .addItem('Set Google sign-in client ID', 'enableSignIn')
    .addItem('Emergency: open access for one hour', 'disableSignIn')
    .addItem('Back up this Sheet now', 'backupNow')
    .addItem('Turn on daily backup, reminders and email retries', 'turnOnDailyBackup')
    .addSeparator()
    .addItem('Replace AK with Ankit Khanna', 'replaceAkWithAnkitKhanna')
    .addSeparator()
    .addItem('Match task owners to registered emails', 'backfillOwnerEmailsMenu')
    .addSeparator()
    .addItem('Send a test email to me', 'sendTestEmail')
    .addItem('Emails: test mode (everything comes to me)', 'emailTestMode')
    .addItem('Emails: go live (employees receive them)', 'emailGoLive')
    .addItem('Turn off emails', 'turnOffAssignmentEmails')
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActive();
  SCHEMA.forEach(function (s) {
    var sh = ss.getSheetByName(s.tab) || ss.insertSheet(s.tab);
    var cols = allCols_(s);
    ensureCols_(sh, cols.length);
    var existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    var sameHeader = existing.length >= cols.length && cols.every(function (c, i) { return existing[i] === c; });
    if (!sameHeader) {
      if (sh.getLastRow() > 0 && existing.join('') !== '') {
        // The usual upgrade: open a gap after _extra. Everything to its right moves with its formulas and formats.
        if (!insertTail_(sh, s, existing)) migrateColumns_(sh, existing, cols); // header differs: move data by column name
      } else {
        sh.getRange(1, 1, 1, cols.length).setValues([cols]);
      }
    }
    var hdr = sh.getRange(1, 1, 1, cols.length);
    hdr.setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff').setWrap(false);
    sh.setFrozenRows(1);
    // whole data area = plain text so dates / IDs / ISO timestamps are never auto-converted
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), cols.length).setNumberFormat('@');
    if (s.nums) s.nums.forEach(function (c) { sh.getRange(2, cols.indexOf(c) + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('0'); });
    // dropdowns
    if (s.drop) Object.keys(s.drop).forEach(function (c) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(s.drop[c], true).setAllowInvalid(true).build();
      sh.getRange(2, cols.indexOf(c) + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
    });
    // column widths: long-text columns wider
    cols.forEach(function (c, i) {
      var w = /^(id|projectId|ws|ms|parent|status|priority|kind|rag|progress|start|due|raised|requiredBy|deadline|week|datesProposed|priorityProposed|completedAt|decidedAt|taskId)$/.test(c) ? 110
        : /^(desc|objective|problem|outcome|impact|mitigation|why|action|decision|final|criteria|text|note|metrics|dependencies|risks|assumptions|priorityRationale|escalation|progress|completed|blockers|missed|next|decisions)$/.test(c) ? 320 : 170;
      if (c === EXTRA) w = 60;
      sh.setColumnWidth(i + 1, w);
    });
    if (cols.indexOf(EXTRA) >= 0) sh.getRange(1, cols.indexOf(EXTRA) + 1).setNote('Internal: JSON of fields that have no column. Leave alone.');
  });
  // Activity tab
  var act = ss.getSheetByName(ACTIVITY_SHEET) || ss.insertSheet(ACTIVITY_SHEET);
  if (act.getLastRow() === 0) act.getRange(1, 1, 1, 2).setValues([['ts', 'text']]);
  act.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  act.setFrozenRows(1); act.setColumnWidth(1, 180); act.setColumnWidth(2, 700);
  act.getRange(2, 1, Math.max(act.getMaxRows() - 1, 1), 2).setNumberFormat('@');
  // Meta tab
  var meta = ss.getSheetByName(META_SHEET) || ss.insertSheet(META_SHEET);
  if (meta.getLastRow() === 0) {
    meta.getRange(1, 1, 7, 2).setValues([
      ['key', 'value'],
      ['version', '0'],
      ['updatedAt', ''],
      ['updatedBy', ''],
      ['lastPushAt', ''],
      ['governance', ''],
      ['meta', '']
    ]);
  }
  meta.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  meta.setColumnWidth(1, 120); meta.setColumnWidth(2, 600);
  meta.getRange(2, 1, Math.max(meta.getMaxRows() - 1, 1), 2).setNumberFormat('@');
  meta.hideSheet();
  ensureSystemTabs_();
  backfillEmployeeIds_();
  backfillOwnerEmails();
  // remove the default empty "Sheet1" if present and empty
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  // put Projects first
  ss.setActiveSheet(ss.getSheetByName('Projects')); ss.moveActiveSheet(1);
  try { SpreadsheetApp.getUi().alert('Control Tower sheet is ready.\n\nYour data was kept. Next: check the Users tab, then Deploy > Manage deployments > New version. See docs/DEPLOYMENT.md.'); } catch (e) {}
}

function insertTail_(sh, s, existing) {
  var base = s.cols.concat([EXTRA]), tail = s.tail || [];
  if (!tail.length || !base.every(function (c, i) { return existing[i] === c; }) || tail.some(function (c) { return existing.indexOf(c) >= 0; })) return false;
  sh.insertColumnsAfter(base.length, tail.length);
  sh.getRange(1, base.length + 1, 1, tail.length).setValues([tail]);
  return true;
}
/** Values with any formulas in place, so rewriting a block of cells does not turn a formula into its result. */
function gridOf_(rng) {
  var vals = rng.getValues(), forms = rng.getFormulas();
  return vals.map(function (r, i) { return r.map(function (v, j) { return forms[i][j] || v; }); });
}
function migrateColumns_(sh, oldCols, newCols) {
  var n = sh.getLastRow();
  var data = n > 1 ? gridOf_(sh.getRange(2, 1, n - 1, oldCols.length)) : [];
  // Each column is tracked by its position, so a blank or repeated heading cannot lose or overwrite data.
  var from = newCols.map(function (c) { return oldCols.indexOf(c); }), heads = newCols.slice();
  oldCols.forEach(function (c, i) {
    if (from.indexOf(i) >= 0) return;
    if (c === '' && !data.some(function (r) { return r[i] !== '' && r[i] != null; })) return;
    from.push(i); heads.push(c); // added by hand: moves to the right, never dropped
  });
  ensureCols_(sh, Math.max(heads.length, oldCols.length));
  var out = data.map(function (row) { return from.map(function (i) { return i >= 0 ? row[i] : ''; }); });
  sh.getRange(1, 1, 1, heads.length).setValues([heads]);
  if (out.length) { sh.getRange(2, 1, out.length, heads.length).setValues(out); }
  if (oldCols.length > heads.length) sh.getRange(1, heads.length + 1, n, oldCols.length - heads.length).clearContent();
}

// ------------------------------------------------------------
//  Versioning
// ------------------------------------------------------------
function metaSheet_() { var ss = SpreadsheetApp.getActive(); return ss.getSheetByName(META_SHEET) || (setupSheet(), ss.getSheetByName(META_SHEET)); }
function metaMap_() {
  var sh = metaSheet_(); var n = sh.getLastRow(); var m = {}; if (n < 2) return m;
  sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r) { if (r[0] !== '') m[String(r[0])] = r[1]; });
  return m;
}
function metaSet_(obj) {
  var sh = metaSheet_(); var n = sh.getLastRow();
  var keys = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
  // One cell per key, so a save and a hand edit cannot undo each other's other values.
  Object.keys(obj).forEach(function (k) {
    var i = -1; keys.forEach(function (r, j) { if (String(r[0]) === k) i = j; });
    if (i >= 0) { sh.getRange(i + 2, 2, 1, 1).setNumberFormat('@').setValues([[obj[k]]]); return; }
    keys.push([k]);
    ensureRows_(sh, keys.length + 1);
    sh.getRange(keys.length + 1, 1, 1, 2).setNumberFormat('@').setValues([[k, obj[k]]]);
  });
}
function getVersion_() { var v = parseInt(metaMap_().version, 10); return isNaN(v) ? 0 : v; }
function bumpVersion_(by) {
  var v = getVersion_() + 1;
  metaSet_({ version: String(v), updatedAt: new Date().toISOString(), updatedBy: by || 'sheet' });
  return v;
}
function bumpVersionMenu() { var v = bumpVersion_('menu'); SpreadsheetApp.getUi().alert('Version is now ' + v + '. Connected websites will refresh within a few seconds.'); }
function showStatus() { var m = metaMap_(); SpreadsheetApp.getUi().alert('Version: ' + m.version + '\nLast change: ' + m.updatedAt + ' by ' + m.updatedBy + '\nLast website push: ' + (m.lastPushAt || 'never')); }

/** Simple trigger: any human edit in a data tab bumps the version so websites pull. */
function onEdit(e) {
  var sheet, name;
  try { sheet = e.range.getSheet(); name = sheet.getName(); } catch (x) { return; }
  if (name === META_SHEET || name === ACTIVITY_SHEET) return;
  if (name !== USERS_SHEET && name !== AUDIT_SHEET && !SCHEMA.some(function (s) { return s.tab === name; })) return;
  var who = '';
  try { who = e.user && e.user.getEmail ? e.user.getEmail() : ''; } catch (x) { /* not available to every account type */ }
  var lock = LockService.getScriptLock(), locked = false;
  try { locked = lock.tryLock(4000); } catch (x) { /* carry on: the edit itself has already happened */ }
  try {
    if (SpreadsheetApp.getActive().getSheetByName(AUDIT_SHEET)) {
      appendRows_(AUDIT_SHEET, [[Utilities.getUuid(), new Date().toISOString(), who, who || 'Google Sheet', name.toLowerCase(), e.range.getA1Notation(), '', '', 'sheet_edit', '', short_(e.oldValue), short_(e.value), 'Edited ' + name + ' ' + e.range.getA1Notation() + ' directly in the Sheet', '']]);
    }
    // Several edits within 2 seconds count as one version change.
    var cache = CacheService.getScriptCache();
    if (!cache.get('editBump')) { cache.put('editBump', '1', 2); bumpVersion_('sheet edit' + (who ? ' by ' + who : '')); }
  } catch (err) { /* never block the person's edit */ }
  if (locked) { try { lock.releaseLock(); } catch (x) {} }
}

// ------------------------------------------------------------
//  Web app API
// ------------------------------------------------------------
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    var cfg = authCfg_();
    var pub = { required: cfg.required, clientId: cfg.required ? cfg.clientId : '', domain: cfg.domain };
    if (action === 'ping') return json_({ ok: true, app: APP, api: API, version: getVersion_(), auth: pub, signInReady: !!cfg.clientId });
    if (action === 'version') return json_({ ok: true, version: getVersion_() });
    if (action === 'pull') {
      if (cfg.required) return json_(authError_());
      return json_(fullPull_({ role: 'Administrator', name: '' }));
    }
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function fullPull_(a) {
  ensureSystemTabs_();
  var res = pull_();
  res.api = API;
  res.state.audit = readAudit_(600);
  res.state.snapshots = readTable_(SNAP_SHEET, SNAP_COLS).slice(-1500);
  var m = metaMap_();
  try { if (m.options) res.state.options = JSON.parse(m.options); } catch (x) {}
  res.state = scopeState_(res.state, a);
  delete res.state.meta.sync; // the website keeps its own connection settings
  if (a.role === 'Project Owner') res.state.directory = directory_();
  if (a.role === 'Administrator') {
    res.state.directory = directory_();
    res.state.users = users_();
    res.state.trash = readTable_(TRASH_SHEET, TRASH_COLS).filter(function (t) { return !t.restoredAt; }).slice(-200).reverse().map(function (t) {
      return { trashId: t.trashId, ts: t.ts, actorName: t.actorName, collection: t.collection, recordId: t.recordId, record: t.record + t.record2 + t.record3 + t.record4, restoredAt: t.restoredAt };
    });
  }
  if (!a.open) res.me = a; // with sign-in off, the server does not know who this is
  res.auth = { required: authCfg_().required };
  if (a.role === 'Administrator' || a.role === 'Project Owner') res.sheetUrl = SpreadsheetApp.getActive().getUrl();
  return res;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var body = {};
    try { body = JSON.parse(e.postData && e.postData.contents || '{}'); } catch (x) { return json_({ ok: false, error: 'Body is not JSON' }); }
    var action = body.action || 'push';
    if (action === 'login') return json_(login_(body));
    if (action === 'logout') return json_(logout_(body));
    var a = actor_(body);
    if (!a) return json_(authError_());
    lock.waitLock(25000); locked = true;
    if (action === 'pull') return json_(fullPull_(a));
    if (action === 'apply') { var applied = apply_(body, a); SpreadsheetApp.flush(); return json_(applied); }
    if (action === 'assign') { var given = assign_(body, a); SpreadsheetApp.flush(); return json_(given); }
    if (action === 'upload') return json_(upload_(body, a));
    if (action === 'notification_log') return json_(notificationLog_(a));
    if (action === 'notification_retry') { var retried = notificationRetry_(body, a); SpreadsheetApp.flush(); return json_(retried); }
    if (action === 'notification_resend') { var resent = notificationResend_(body, a); SpreadsheetApp.flush(); return json_(resent); }
    if (action === 'integration_status') return json_(integrationStatus_(a));
    if (action === 'test_email') return json_(testEmail_(a));
    if (action === 'snapshot') return json_(a.role === 'Viewer' || a.role === 'Task Owner' ? { ok: true, added: 0 } : snapshot_(body, a));
    if (action === 'push') {
      if (authCfg_().required) return json_({ ok: false, error: 'This version of the site is out of date. Refresh the page.' });
      var pushed = push_(body); SpreadsheetApp.flush(); return json_(pushed);
    }
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
  finally { if (locked) { try { lock.releaseLock(); } catch (x) {} } }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ------------------------------------------------------------
//  PULL — sheet → state JSON
// ------------------------------------------------------------
function pull_() {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(META_SHEET)) setupSheet();
  var state = {};
  var nestedBuckets = {};
  var idsNeeded = [];
  SCHEMA.forEach(function (s) {
    var rows = readTab_(ss, s, idsNeeded);
    if (s.nested) { nestedBuckets[s.key] = rows; } else { state[s.key] = rows; }
  });
  // write back any generated IDs (only happens for rows a human added without an ID)
  if (idsNeeded.length) { idsNeeded.forEach(function (w) { w.sheet.getRange(w.row, w.col).setValue(w.id); }); }
  // reassemble nested collections into projects
  var byId = {};
  (state.projects || []).forEach(function (p) { p.workstreams = []; p.milestones = []; p.raci = []; p.comments = []; byId[p.id] = p; });
  Object.keys(nestedBuckets).forEach(function (k) {
    nestedBuckets[k].forEach(function (r) {
      var p = byId[r.projectId]; if (!p) return; // orphan row: project no longer exists
      delete r.projectId; p[k].push(r);
    });
  });
  // activity + governance + meta
  var act = ss.getSheetByName(ACTIVITY_SHEET); var activity = [];
  if (act && act.getLastRow() > 1) activity = act.getRange(2, 1, act.getLastRow() - 1, 2).getValues().filter(function (r) { return r[0] !== '' || r[1] !== ''; }).map(function (r) { return { ts: cell_(r[0]), text: cell_(r[1]) }; });
  var m = metaMap_();
  var governance = null, meta = null;
  try { governance = m.governance ? JSON.parse(m.governance) : null; } catch (x) {}
  try { meta = m.meta ? JSON.parse(m.meta) : null; } catch (x) {}
  state.updates = state.updates || [];
  state.activity = activity;
  state.governance = governance;
  state.meta = meta || { app: APP, schema: 1 };
  state.meta.syncVersion = parseInt(m.version, 10) || 0;
  var empty = !(state.projects && state.projects.length) && !(state.tasks && state.tasks.length);
  return { ok: true, version: parseInt(m.version, 10) || 0, updatedAt: m.updatedAt || '', updatedBy: m.updatedBy || '', empty: empty, state: state };
}

function readTab_(ss, s, idsNeeded) {
  var sh = ss.getSheetByName(s.tab); if (!sh) return [];
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn(); if (lastRow < 2 || lastCol < 1) return [];
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  var usedIds = {};
  var ours = {}; allCols_(s).forEach(function (c) { ours[c] = true; }); // columns added by hand stay in the Sheet, out of the records
  if (s.id) data.forEach(function (r) { var v = r[header.indexOf(s.id)]; if (v !== '' && v != null) usedIds[String(v)] = true; });
  data.forEach(function (r, ri) {
    if (r.every(function (v) { return v === '' || v == null; })) return; // blank row
    var o = {};
    header.forEach(function (h, i) {
      if (!h || !ours[h] || header.indexOf(h) !== i) return; // a repeated heading cannot override the real column
      var v = r[i];
      if (typeof v === 'string' && /^'=/.test(v)) v = v.slice(1);
      if (h === EXTRA) { if (v) { try { var ex = JSON.parse(v); Object.keys(ex).forEach(function (k) { o[k] = ex[k]; }); } catch (x) {} } return; }
      if (s.tail && s.tail.indexOf(h) >= 0 && (v === '' || v == null) && o[h] !== undefined) return;
      if (s.lists && s.lists[h] !== undefined) { o[h] = splitList_(v); return; }
      if (s.bools && s.bools.indexOf(h) >= 0) { o[h] = toBool_(v); return; }
      if (s.nums && s.nums.indexOf(h) >= 0) { var n = parseFloat(v); o[h] = isNaN(n) ? 0 : n; return; }
      o[h] = cell_(v);
    });
    // required-ish defaults so the website never sees undefined where it expects a string
    s.cols.concat(s.tail || []).forEach(function (c) { if (o[c] === undefined) o[c] = (s.lists && s.lists[c] !== undefined) ? [] : (s.bools && s.bools.indexOf(c) >= 0) ? false : (s.nums && s.nums.indexOf(c) >= 0) ? 0 : ''; });
    if (s.key === 'projects' && o.program === '') o.program = null;
    // auto-ID for rows added by hand
    if (s.id && (o[s.id] === '' || o[s.id] == null)) {
      var pfx = s.prefix;
      if (s.prefix === 'MS' || s.prefix === 'WS') pfx = s.prefix + '-' + String(o.projectId || '').replace(/^[A-Z]+-/, '');
      var k = 1, cand;
      do { cand = pfx + '-' + (k < 1000 ? ('00' + k).slice(-3) : k); k++; } while (usedIds[cand]);
      usedIds[cand] = true; o[s.id] = cand;
      idsNeeded.push({ sheet: sh, row: ri + 2, col: header.indexOf(s.id) + 1, id: cand });
    }
    out.push(o);
  });
  return out;
}

// ------------------------------------------------------------
//  PUSH — state JSON → sheet
// ------------------------------------------------------------
function push_(body) {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(META_SHEET)) setupSheet();
  var state = body.state;
  if (!state || !Array.isArray(state.projects) || !Array.isArray(state.tasks)) return { ok: false, error: 'Payload has no projects/tasks' };
  var current = getVersion_();
  var existing = ss.getSheetByName('Projects');
  var haveRows = existing ? Math.max(existing.getLastRow() - 1, 0) : 0;
  if (!body.force && haveRows >= 5 && state.projects.length < haveRows * 0.5) return { ok: false, error: 'Refused: this save would remove more than half of the projects. Refresh the page.' };
  var base = body.baseVersion;
  if (base !== undefined && base !== null && !body.force && Number(base) !== current) {
    return { ok: false, conflict: true, version: current, message: 'Sheet changed since the website last synced (sheet v' + current + ', website v' + base + ').' };
  }
  // flatten nested project collections
  var flat = { workstreams: [], milestones: [], raci: [], comments: [] };
  state.projects.forEach(function (p) {
    (p.workstreams || []).forEach(function (w) { flat.workstreams.push(Object.assign({ projectId: p.id }, w)); });
    (p.milestones || []).forEach(function (m) { flat.milestones.push(Object.assign({ projectId: p.id }, m)); });
    (p.raci || []).forEach(function (r) { flat.raci.push(Object.assign({ projectId: p.id }, r)); });
    (p.comments || []).forEach(function (c) { flat.comments.push(Object.assign({ projectId: p.id }, c)); });
  });
  // Check everything first: writeTab_ clears a tab before filling it.
  var oversized = SCHEMA.filter(function (s) { return (s.nested ? flat[s.key] : (state[s.key] || [])).some(function (o) { return tooBig_(rowValues_(s, o)); }); })[0];
  if (oversized) return { ok: false, error: 'A record in ' + oversized.tab + ' is too long to store. Nothing was saved.' };
  SCHEMA.forEach(function (s) {
    var rows = s.nested ? flat[s.key] : (state[s.key] || []);
    writeTab_(ss, s, rows);
  });
  // activity
  var act = ss.getSheetByName(ACTIVITY_SHEET);
  var activity = (state.activity || []).slice(0, 500);
  clearData_(act, 2);
  ensureRows_(act, activity.length + 1);
  if (activity.length) act.getRange(2, 1, activity.length, 2).setNumberFormat('@').setValues(activity.map(function (a) { return [a.ts || '', a.text || '']; }));
  // meta
  var meta = Object.assign({}, state.meta || {}); delete meta.syncVersion;
  var v = current + 1;
  metaSet_({
    version: String(v), updatedAt: new Date().toISOString(), updatedBy: 'website' + (body.client ? ' (' + body.client + ')' : ''),
    lastPushAt: new Date().toISOString(),
    governance: JSON.stringify(state.governance || null),
    meta: JSON.stringify(meta)
  });
  return { ok: true, version: v, updatedAt: new Date().toISOString() };
}

function writeTab_(ss, s, rows) {
  var sh = ss.getSheetByName(s.tab) || ss.insertSheet(s.tab);
  var cols = allCols_(s);
  ensureCols_(sh, cols.length);
  var lastCol = sh.getLastColumn();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (header.slice(0, cols.length).join('\u0001') !== cols.join('\u0001')) { sh.getRange(1, 1, 1, cols.length).setValues([cols]); header = cols; if (lastCol > cols.length) sh.getRange(1, cols.length + 1, 1, lastCol - cols.length).clearContent(); }
  clearData_(sh, cols.length);
  if (!rows.length) return;
  var values = rows.map(function (o) { return rowValues_(s, o); });
  ensureRows_(sh, values.length + 1);
  var rng = sh.getRange(2, 1, values.length, cols.length);
  rng.setNumberFormat('@');
  if (s.nums) s.nums.forEach(function (c) { sh.getRange(2, cols.indexOf(c) + 1, values.length, 1).setNumberFormat('0'); });
  rng.setValues(values);
}

function clearData_(sh, ncols) {
  var lastRow = sh.getLastRow(); var lastCol = ncols || Math.max(sh.getLastColumn(), 1);
  if (lastRow >= 2) sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
}

// ------------------------------------------------------------
//  Cell helpers
// ------------------------------------------------------------
function cell_(v) {
  if (v == null) return '';
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  var s = String(v);
  if (/^'=/.test(s)) return s.slice(1);
  // Accept dates typed as dd/mm/yyyy or dd-mm-yyyy and normalise to yyyy-mm-dd
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}
/** Text from people is never allowed to run as a formula in the Sheet. */
function safeCell_(v) { return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v; }
function toBool_(v) { if (typeof v === 'boolean') return v; var s = String(v == null ? '' : v).trim().toLowerCase(); return s === 'true' || s === 'yes' || s === '1'; }
function splitList_(v) {
  if (v == null || v === '') return [];
  if (v instanceof Date) return [cell_(v)];
  var s = String(v);
  var parts = s.indexOf('\n') >= 0 ? s.split(/\r?\n/) : s.split(/\s*,\s*/);
  return parts.map(function (x) { return x.trim(); }).filter(Boolean);
}

// ============================================================
//  API 3: sign-in, permissions, record-level saves, audit log
//  Nothing below changes the existing tabs. New record fields
//  travel in each tab's _extra column.
// ============================================================
var USERS_SHEET = 'Users', AUDIT_SHEET = 'AuditLog', TRASH_SHEET = 'Trash', SNAP_SHEET = 'Snapshots', NOTIF_SHEET = 'NotificationLog';
// Stored names. The site shows them as Super Admin, Manager, Employee and Viewer.
var ROLES = ['Administrator', 'Project Owner', 'Task Owner', 'Viewer'];
var ROLE_WORDS = { 'management': 'Administrator', 'admin': 'Administrator', 'administrator': 'Administrator', 'super admin': 'Administrator', 'superadmin': 'Administrator', 'manager': 'Project Owner', 'project owner': 'Project Owner', 'employee': 'Task Owner', 'task owner': 'Task Owner', 'viewer': 'Viewer' };
var USER_COLS = ['email', 'name', 'role', 'active', 'addedBy', 'addedAt', 'employeeId', 'department', 'designation', 'managerEmail', 'joiningDate', 'updatedAt', 'photoUrl'];
var USER_EDIT = ['name', 'role', 'active', 'department', 'designation', 'managerEmail', 'joiningDate', 'aliases'];
var MANAGER_EDIT = ['department', 'designation', 'joiningDate']; // what a Manager may change for people who report to them
var SESSION_IDLE_SECONDS = 21600; // Apps Script's cache keeps a value for six hours at most
var SESSION_MAX_MS = 12 * 3600 * 1000;
var MAX_OWNERS = 10;
var LOGIN_LIMIT_PER_PERSON = 10, LOGIN_LIMIT_UNREADABLE = 30;
var AUDIT_COLS = ['activityId', 'ts', 'actorEmail', 'actorName', 'entityType', 'entityId', 'projectId', 'taskId', 'action', 'field', 'oldValue', 'newValue', 'text', 'requestId'];
var TRASH_COLS = ['trashId', 'ts', 'actorName', 'collection', 'recordId', 'record', 'restoredAt', 'record2', 'record3', 'record4'];
var CELL_MAX = 49000; // Sheets refuses a cell over 50,000 characters
var SNAP_COLS = ['date', 'projectId', 'progress', 'done', 'active', 'overdue', 'blocked', 'health'];
var NESTED = ['workstreams', 'milestones', 'raci', 'comments'];
var APPEND_ONLY = ['comments', 'notes'];
var STAMPS = ['updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'originalDue', 'assignedBy', 'assignedByEmail', 'assignedAt', 'completedTs'];
var TRANSITIONS = {
  'Backlog': ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
  'Not Started': ['Backlog', 'In Progress', 'Blocked', 'On Hold', 'Completed', 'Cancelled'],
  'In Progress': ['Not Started', 'Blocked', 'On Hold', 'In Review', 'Awaiting Approval', 'Completed', 'Cancelled'],
  'Blocked': ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
  'On Hold': ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Cancelled'],
  'In Review': ['Not Started', 'In Progress', 'On Hold', 'Awaiting Approval', 'Changes Requested', 'Completed', 'Cancelled'],
  'Awaiting Approval': ['Not Started', 'In Progress', 'On Hold', 'In Review', 'Changes Requested', 'Completed', 'Cancelled'],
  'Changes Requested': ['Not Started', 'In Progress', 'On Hold', 'In Review', 'Blocked', 'Completed', 'Cancelled'],
  'Completed': ['In Progress', 'Not Started', 'On Hold', 'In Review', 'Awaiting Approval', 'Cancelled'],
  'Cancelled': ['Not Started', 'In Progress', 'On Hold', 'Completed']
};
// Fields a task owner may change on their own task. Scope, owner and dates stay with the project owner.
var TASK_OWNER_FIELDS = ['status', 'progress', 'notes', 'checklist', 'blocker', 'completedAt', 'latestUpdate', 'attachments', 'cancelReason', 'review', 'extensionRequest', 'actualEffort'];

function props_() { return PropertiesService.getScriptProperties(); }
/** Sign-in is always required. The only exception is the emergency switch, which ends by itself. */
function authCfg_() {
  var p = props_();
  var off = p.getProperty('AUTH_REQUIRED') === 'false' && Number(p.getProperty('AUTH_OFF_UNTIL') || 0) > Date.now();
  return { required: !off, clientId: p.getProperty('AUTH_CLIENT_ID') || '', domain: p.getProperty('AUTH_DOMAIN') || 'suraasa.com' };
}
function siteUrl_() { return String(props_().getProperty('SITE_URL') || DEFAULT_SITE_URL).replace(/\/*$/, '/'); }
function itemLink_(kind, id) { return siteUrl_() + '#' + (kind === 'project' ? 'project' : 'task') + '=' + encodeURIComponent(id); }

function ensureSystemTabs_() {
  var ss = SpreadsheetApp.getActive();
  [[USERS_SHEET, USER_COLS], [AUDIT_SHEET, AUDIT_COLS], [TRASH_SHEET, TRASH_COLS], [SNAP_SHEET, SNAP_COLS], [NOTIF_SHEET, NOTIF_COLS]].forEach(function (t) {
    var sh = ss.getSheetByName(t[0]);
    if (!sh) {
      sh = ss.insertSheet(t[0]);
      sh.getRange(1, 1, 1, t[1].length).setValues([t[1]]);
      sh.getRange(1, 1, 1, t[1].length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), t[1].length).setNumberFormat('@');
      if (t[0] !== USERS_SHEET) { try { sh.protect().setWarningOnly(true); } catch (x) { /* protection is a courtesy only */ } }
    }
  });
  ensureUserColumns_();
}
/** Adds any missing directory columns at the right of the Users tab. Columns already there, and hand-added ones, stay put. */
function ensureUserColumns_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if (!sh) return;
  var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); }) : [];
  var missing = USER_COLS.filter(function (c) { return have.indexOf(c) < 0; });
  if (!missing.length) return;
  ensureCols_(sh, have.length + missing.length);
  sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
}

// ---------- users and sessions ----------
/** Plain words such as "Super Admin", "Manager" and "employee" are accepted in the Users tab. */
function roleOf_(v) {
  var r = String(v == null ? '' : v).trim();
  return ROLE_WORDS[r.toLowerCase()] || (ROLES.indexOf(r) >= 0 ? r : 'Viewer');
}
function userColumns_(sh) {
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0], at = {};
  head.forEach(function (h, i) { var k = String(h).trim(); if (k && at[k] === undefined) at[k] = i; });
  return at;
}
function users_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var at = userColumns_(sh);
  if (at.email === undefined) return [];
  var cell = function (r, k) { return at[k] === undefined ? '' : r[at[k]]; };
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().filter(function (r) { return String(cell(r, 'email')).trim() !== ''; }).map(function (r) {
    // "Manish Pandey (Head of Sales)": the part in brackets is another name tasks may use for this person.
    var raw = String(cell(r, 'name')).trim(), m = raw.match(/^(.*?)\s*\((.+)\)$/);
    return { email: String(cell(r, 'email')).trim().toLowerCase(), name: m ? m[1] : raw, rawName: raw, aliases: m ? m[2].split(/\s*,\s*/) : [], role: roleOf_(cell(r, 'role')), active: toBool_(cell(r, 'active')), addedBy: String(cell(r, 'addedBy') || ''), addedAt: String(cell(r, 'addedAt') || ''), employeeId: String(cell(r, 'employeeId') || ''), department: String(cell(r, 'department') || ''), designation: String(cell(r, 'designation') || ''), managerEmail: String(cell(r, 'managerEmail') || '').trim().toLowerCase(), joiningDate: cell_(cell(r, 'joiningDate')), updatedAt: String(cell(r, 'updatedAt') || ''), photoUrl: String(cell(r, 'photoUrl') || '') };
  });
}
function userByEmail_(email) {
  email = String(email || '').trim().toLowerCase();
  return users_().filter(function (u) { return u.email === email; })[0] || null;
}
/** What a manager needs to assign work by email. Roles and history stay with Super Admins. */
function directory_() {
  return users_().filter(function (u) { return u.active; }).map(function (u) { return { employeeId: u.employeeId, name: u.name, email: u.email, department: u.department, designation: u.designation, managerEmail: u.managerEmail, joiningDate: u.joiningDate, photoUrl: u.photoUrl }; });
}
function nextEmployeeId_(users) {
  var top = 0;
  users.forEach(function (u) { var m = String(u.employeeId || '').match(/^EMP-(\d+)$/); if (m) top = Math.max(top, Number(m[1])); });
  return 'EMP-' + (top + 1 < 100 ? ('00' + (top + 1)).slice(-3) : String(top + 1));
}
/** Gives everyone already in the Users tab an ID. Existing IDs never change. */
function backfillEmployeeIds_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return 0;
  var at = userColumns_(sh), n = 0, list = users_();
  if (at.employeeId === undefined || at.email === undefined) return 0;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  rows.forEach(function (r, i) {
    if (String(r[at.email]).trim() === '' || String(r[at.employeeId]).trim() !== '') return;
    var id = nextEmployeeId_(list);
    list.push({ employeeId: id });
    sh.getRange(i + 2, at.employeeId + 1).setValue(id);
    n++;
  });
  return n;
}
function login_(body) {
  var cfg = authCfg_();
  if (!cfg.required) return { ok: true, open: true };
  if (!cfg.clientId) return { ok: false, auth: true, error: 'Google sign-in has not been set up yet. Ask your administrator.' };
  var idToken = String(body.idToken || '');
  if (!idToken) return { ok: false, auth: true, error: 'Sign in with your Suraasa Google account.' };
  if (idToken.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(idToken)) return { ok: false, auth: true, error: 'Google could not confirm this sign-in. Try again.' };
  // Nothing here is trusted yet. It only stops junk cheaply, and keeps one person's flood from blocking anyone else.
  var seen = readClaims_(idToken), who = '';
  if (seen) {
    var early = claimProblem_(seen, cfg);
    if (early) return { ok: false, auth: true, error: early };
    who = String(seen.email || '').toLowerCase();
    var known = userByEmail_(who);
    if (!known || !known.active) return noAccess_(who);
  }
  var cache = CacheService.getScriptCache(), bucket = 'login:' + (who || 'unread') + ':' + Math.floor(Date.now() / 60000), tries = Number(cache.get(bucket) || 0);
  if (tries >= (who ? LOGIN_LIMIT_PER_PERSON : LOGIN_LIMIT_UNREADABLE)) return { ok: false, auth: true, error: 'Too many sign-ins just now. Wait a minute and try again.' };
  cache.put(bucket, String(tries + 1), 120);
  var res = checkToken_(idToken);
  if (res.getResponseCode() !== 200) return { ok: false, auth: true, error: 'Google could not confirm this sign-in. Try again.' };
  var t = JSON.parse(res.getContentText());
  var problem = claimProblem_(t, cfg);
  if (problem) return { ok: false, auth: true, error: problem };
  var email = String(t.email || '').toLowerCase();
  var u = userByEmail_(email);
  if (!u || !u.active) return noAccess_(email);
  try { storePhoto_(u, t.picture); } catch (x) { /* a picture is never worth failing a sign-in */ }
  var token = Utilities.getUuid() + Utilities.getUuid();
  var now = Date.now();
  CacheService.getScriptCache().put('sess:' + token, JSON.stringify({ e: email, t: now, x: now + SESSION_MAX_MS }), SESSION_IDLE_SECONDS);
  return { ok: true, session: token, user: publicUser_(u) };
}
/** The Google profile picture is the employee's picture. Only Google's own image host is accepted. */
function storePhoto_(u, url) {
  if (!/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\/[^\s"'<>]+$/i.test(String(url || '')) || url === u.photoUrl) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return; // the next sign-in will try again
  try {
    ensureUserColumns_();
    var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET), at = userColumns_(sh), n = sh.getLastRow();
    sh.getRange(2, at.email + 1, n - 1, 1).getValues().some(function (r, i) {
      if (String(r[0]).trim().toLowerCase() !== u.email) return false;
      sh.getRange(i + 2, at.photoUrl + 1).setNumberFormat('@').setValue(url);
      return true;
    });
  } finally { lock.releaseLock(); }
}
/** Google warns this check can fail now and then, or be throttled, so one failure gets a second try. */
function checkToken_(idToken) {
  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), res = null;
  for (var i = 0; i < 2; i++) {
    try { res = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); } catch (x) { res = null; }
    if (res && res.getResponseCode() < 500 && res.getResponseCode() !== 429) return res;
    if (i === 0) Utilities.sleep(500);
  }
  return res || { getResponseCode: function () { return 503; } };
}
/** A session is two IDs. Anything else is not looked up: Google refuses cache keys over 250 characters. */
function validSession_(v) { return /^[0-9a-f-]{72}$/i.test(String(v || '')); }
/** Reads a token's claims without checking them. Only Google's answer is ever trusted. */
function readClaims_(idToken) {
  try {
    var part = idToken.split('.')[1];
    while (part.length % 4) part += '=';
    var o = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString());
    return o && typeof o === 'object' ? o : null;
  } catch (x) { return null; }
}
function claimProblem_(t, cfg) {
  var email = String(t.email || '').toLowerCase();
  if (t.aud !== cfg.clientId) return 'This sign-in was issued for a different app.';
  if (t.iss !== 'https://accounts.google.com' && t.iss !== 'accounts.google.com') return 'This sign-in did not come from Google.';
  if (String(t.email_verified) !== 'true') return 'This Google account is not verified.';
  // Google: the email's domain alone does not show that the organisation manages the account. `hd` does.
  if (email.split('@')[1] !== cfg.domain || t.hd !== cfg.domain) return 'Use your @' + cfg.domain + ' Workspace account.';
  if (Number(t.exp || 0) * 1000 < Date.now()) return 'This sign-in expired. Try again.';
  return '';
}
function noAccess_(email) { return { ok: false, auth: true, denied: true, error: 'Your account has no access yet. Ask an administrator to add ' + email + '.' }; }
function logout_(body) {
  if (validSession_(body.session)) CacheService.getScriptCache().remove('sess:' + String(body.session));
  return { ok: true };
}
function publicUser_(u) { return { email: u.email, name: u.name, aliases: u.aliases || [], role: u.role, employeeId: u.employeeId || '', department: u.department || '', designation: u.designation || '', managerEmail: u.managerEmail || '', joiningDate: u.joiningDate || '', photoUrl: u.photoUrl || '' }; }
/** Returns who is calling. Role is read fresh on every request, so a role change or deactivation applies at once. */
function actor_(body) {
  var cfg = authCfg_();
  if (!cfg.required) return { open: true, email: '', name: String(body.actorName || 'Website').slice(0, 80), aliases: [], role: 'Administrator' };
  if (!validSession_(body.session)) return null;
  var cache = CacheService.getScriptCache(), key = 'sess:' + String(body.session), raw = cache.get(key);
  if (!raw) return null;
  var s;
  try { s = JSON.parse(raw); } catch (x) { return null; }
  if (!s || !s.e || Date.now() > s.x) { cache.remove(key); return null; }
  var all = users_(), u = all.filter(function (x) { return x.email === s.e; })[0];
  if (!u || !u.active) { cache.remove(key); return null; }
  if (Date.now() - s.t > 600000) { s.t = Date.now(); cache.put(key, JSON.stringify(s), SESSION_IDLE_SECONDS); } // still in use, so the idle limit moves on
  // A name two people share belongs to neither of them: only their email counts.
  var me = publicUser_(u);
  me.nameShared = peopleNamed_(u.name, all).length > 1;
  me.aliases = me.aliases.filter(function (n) { return peopleNamed_(n, all).length === 1; });
  return me;
}
function authError_() { return { ok: false, auth: true, error: 'Your session has ended. Sign in again.' }; }

// ---------- what a person may see and do ----------
/** True only for a confirmed name. "TBD — proposed: AK" gives AK no rights, and "AK" never matches "Mak". */
function isMine_(field, a) {
  var names = typeof a === 'string' ? [a] : (a.nameShared ? [] : [a.name]).concat(a.aliases || []);
  names = names.filter(Boolean).map(function (n) { return String(n).trim().toLowerCase(); });
  if (!names.length || /^\s*tbd/i.test(String(field || ''))) return false;
  return String(field || '').split(/\s*[,\/&]\s*|\s+or\s+/i).some(function (x) { return names.indexOf(x.trim().toLowerCase()) >= 0; });
}
/** A registered email decides. Records from before emails were stored fall back to the exact name. */
function holds_(rec, nameField, emailField, a) {
  var mail = String(rec[emailField] || '').toLowerCase();
  if (mail && a.email) return mail.split(/\s*,\s*/).indexOf(a.email) >= 0;
  return isMine_(rec[nameField], a);
}
function ownsTask_(t, a) { return holds_(t, 'owner', 'ownerEmail', a); }
/** Exactly this one person, so a list with someone else in it cannot pass as "my own task". */
function soleOwner_(t, a) {
  var mails = String(t.ownerEmail || '').toLowerCase().split(/\s*,\s*/).filter(Boolean);
  if (mails.length) return mails.length === 1 && !!a.email && mails[0] === a.email;
  return ownerNames_(t.owner).length === 1 && isMine_(t.owner, a);
}
/** Work someone else gave this person. A task they wrote for themselves gives them no view of the project. */
function givenWork_(t, a) { return (ownsTask_(t, a) || isMine_(t.accountable, a)) && !(a.email && String(t.assignedByEmail || '').toLowerCase() === a.email); }
function ownsProject_(p, a) { return !!p && (holds_(p, 'owner', 'ownerEmail', a) || holds_(p, 'accountable', 'accountableEmail', a) || (!!a.email && (p.managerEmails || []).indexOf(a.email) >= 0)); }
function canSeeProject_(p, tasks, a) {
  if (a.role === 'Administrator' || !p.restricted) return true;
  if (ownsProject_(p, a) || isMine_(p.sponsor, a)) return true;
  if ((p.members || []).some(function (m) { return isMine_(m, a); })) return true;
  return tasks.some(function (t) { return t.projectId === p.id && ownsTask_(t, a); });
}
function scopeState_(state, a) {
  if (a.role === 'Administrator') return state;
  var seen = {};
  state.projects = state.projects.filter(function (p) { var ok = canSeeProject_(p, state.tasks, a); if (ok) seen[p.id] = true; return ok; });
  ['tasks', 'risks', 'dependencies', 'decisions', 'updates', 'actions'].forEach(function (k) {
    state[k] = (state[k] || []).filter(function (r) { return !r.projectId || seen[r.projectId]; });
  });
  var general = ['decisions', 'risks', 'dependencies', 'actions', 'updates'];
  state.audit = (state.audit || []).filter(function (r) { return r.action !== 'sheet_edit' && (r.projectId ? seen[r.projectId] : general.indexOf(r.entityType) >= 0); });
  state.snapshots = (state.snapshots || []).filter(function (r) { return seen[r.projectId]; });
  if (a.role === 'Task Owner') {
    // Employees see their own tasks and subtasks, and only what belongs to the projects those tasks are in.
    var mine = {}, theirs = {};
    state.tasks.forEach(function (t) { if (ownsTask_(t, a) || isMine_(t.accountable, a)) mine[t.id] = true; if (givenWork_(t, a)) theirs[t.projectId] = true; });
    var grew = true;
    while (grew) {
      grew = false;
      state.tasks.forEach(function (t) { if (!mine[t.id] && t.parent && mine[t.parent]) { mine[t.id] = true; grew = true; } });
    }
    state.tasks = state.tasks.filter(function (t) { return mine[t.id]; });
    // Other projects: just enough to choose one for a new task.
    state.projects = state.projects.map(function (p) {
      return theirs[p.id] ? p : { id: p.id, name: p.name, status: p.status, priority: '', workstreams: [], milestones: [], raci: [], comments: [] };
    });
    ['risks', 'dependencies', 'decisions', 'updates', 'actions'].forEach(function (k) {
      state[k] = (state[k] || []).filter(function (r) { return r.projectId ? theirs[r.projectId] : isMine_(r.owner, a); });
    });
    // The one thing kept about a task someone no longer owns: that it moved on, so they are told.
    state.audit = state.audit.filter(function (r) { return r.taskId ? mine[r.taskId] || (r.action === 'owner_changed' && r.field === 'owner' && isMine_(r.oldValue, a)) : theirs[r.projectId]; }).map(function (r) {
      if (!r.taskId || mine[r.taskId]) return r;
      return { activityId: r.activityId, ts: r.ts, actorName: '', actorEmail: '', entityType: r.entityType, entityId: r.entityId, projectId: r.projectId, taskId: r.taskId, action: r.action, field: r.field, oldValue: r.oldValue, newValue: '', text: 'A task you owned was given to someone else.', requestId: '' };
    });
    state.snapshots = state.snapshots.filter(function (r) { return theirs[r.projectId]; });
  }
  state.activity = []; // the old free-text list names projects and has no project field to filter on
  return state;
}
function changedFields_(cur, next) {
  var out = [];
  var keys = {};
  Object.keys(cur || {}).forEach(function (k) { keys[k] = true; });
  Object.keys(next || {}).forEach(function (k) { keys[k] = true; });
  Object.keys(keys).forEach(function (k) { if (STAMPS.indexOf(k) < 0 && canon_(cur ? cur[k] : '') !== canon_(next ? next[k] : '')) out.push(k); });
  return out;
}
function hasWorkIn_(pid, st, a) { return st.tasks.some(function (t) { return t.projectId === pid && givenWork_(t, a); }); }
/** Returns a refusal message, or '' when allowed. Checked on the server for every record. */
function deny_(a, coll, cur, next, st) {
  if (a.role === 'Administrator') return '';
  if (a.role === 'Viewer') return 'Viewers cannot change anything.';
  if (coll === 'users' && a.role === 'Project Owner' && cur && next && a.email && cur.managerEmail === a.email) {
    var off = USER_EDIT.filter(function (k) { return MANAGER_EDIT.indexOf(k) < 0 && canon_(cur[k]) !== canon_(next[k]); });
    if (!off.length) return '';
    return 'Only a Super Admin can change ' + off.join(', ') + '.';
  }
  if (['governance', 'options', 'users', 'roles', 'programs'].indexOf(coll) >= 0) return 'Only an administrator can change this.';
  var rec = next || cur;
  var byId = function (id) { return st.projects.filter(function (p) { return p.id === id; })[0]; };
  if (coll === 'projects') {
    if (!cur) return a.role === 'Project Owner' ? '' : 'Only project owners can create projects.';
    if (!next) return 'Only an administrator can delete a project.';
    if (ownsProject_(cur, a) && a.role === 'Project Owner') return '';
    var ch = changedFields_(cur, next);
    if (ch.length === 1 && APPEND_ONLY.indexOf(ch[0]) >= 0 && (a.role !== 'Task Owner' || hasWorkIn_(cur.id, st, a))) return '';
    return 'Only this project\'s owner can change it.';
  }
  var proj = byId(rec.projectId);
  var from = cur ? byId(cur.projectId) : proj;
  if (a.role === 'Project Owner' && ownsProject_(proj, a) && ownsProject_(from, a)) return '';
  if (cur && next && cur.projectId !== next.projectId) return 'Only the owner of both projects can move this.';
  if (['risks', 'decisions', 'actions', 'dependencies'].indexOf(coll) >= 0 && cur && next && isMine_(cur.owner || cur.responsible, a)) {
    var off = changedFields_(cur, next).filter(function (f) { return f === 'owner' || f === 'responsible'; });
    return off.length ? 'Ask the project owner to reassign this.' : '';
  }
  if (coll === 'tasks' && cur && next) {
    if (!ownsTask_(cur, a)) {
      var cf = changedFields_(cur, next);
      return a.role !== 'Task Owner' && cf.length === 1 && APPEND_ONLY.indexOf(cf[0]) >= 0 ? '' : 'Only the task owner or project owner can change this task.';
    }
    var bad = changedFields_(cur, next).filter(function (f) { return TASK_OWNER_FIELDS.indexOf(f) < 0; });
    return bad.length ? 'Task owners cannot change ' + bad.join(', ') + '. Ask the project owner.' : '';
  }
  if (coll === 'tasks' && !cur && next && next.parent) {
    var parent = st.tasks.filter(function (t) { return t.id === next.parent; })[0];
    return parent && parent.projectId === next.projectId && ownsTask_(parent, a) && soleOwner_(next, a) ? '' : 'You can add subtasks only to your own tasks, for yourself.';
  }
  if (coll === 'tasks' && !cur && next) return soleOwner_(next, a) ? '' : 'You can add tasks only for yourself. Set yourself as the owner.';
  if (coll === 'updates' && !cur) return a.role !== 'Task Owner' || hasWorkIn_(rec.projectId, st, a) ? '' : 'You can add updates only to projects you have tasks in.';
  return 'You do not have permission to change this.';
}
function hasCycle_(tasks, id, deps) {
  var map = {}; tasks.forEach(function (t) { map[t.id] = t.dependsOn || []; });
  map[id] = deps || [];
  var seen = {}, stack = (deps || []).slice();
  while (stack.length) {
    var x = stack.pop();
    if (x === id) return true;
    if (seen[x]) continue;
    seen[x] = true;
    (map[x] || []).forEach(function (y) { stack.push(y); });
  }
  return false;
}
function invalid_(coll, cur, next, st, a) {
  if (!next) return '';
  var dateOk = function (v) { return !v || /^\d{4}-\d{2}-\d{2}$/.test(String(v)); };
  if (coll === 'projects') {
    if (!String(next.name || '').trim()) return 'A project needs a name.';
    if (next.priority && PRIOS.indexOf(next.priority) < 0) return 'Priority must be P0, P1, P2 or P3.';
    if (!dateOk(next.start) || !dateOk(next.due)) return 'Dates must be YYYY-MM-DD.';
    if (next.start && next.due && next.due < next.start) return 'The target date cannot be before the start date.';
    if (cur) {
      var own = st.tasks.filter(function (t) { return t.projectId === next.id && t.status !== 'Cancelled'; });
      var wasMs = {}; (cur.milestones || []).forEach(function (m) { wasMs[m.id] = m.status; });
      var openMs = (next.milestones || []).filter(function (m) {
        return m.status === 'Completed' && wasMs[m.id] !== 'Completed' && own.some(function (t) { return t.ms === m.id && t.status !== 'Completed'; });
      })[0];
      if (openMs) return 'Milestone "' + openMs.name + '" still has open tasks.';
      if (next.status === 'Completed' && cur.status !== 'Completed' && own.some(function (t) { return t.status !== 'Completed'; })) return 'This project still has open tasks. Finish or cancel them before closing it.';
    }
  }
  if (coll === 'tasks') {
    if (!String(next.name || '').trim()) return 'A task needs a name.';
    if (next.priority && PRIOS.indexOf(next.priority) < 0) return 'Priority must be P0, P1, P2 or P3.';
    if (!st.projects.some(function (p) { return p.id === next.projectId; })) return 'Task ' + next.id + ' points to a project that does not exist.';
    if (next.parent && !st.tasks.some(function (t) { return t.id === next.parent; })) return 'The parent task does not exist.';
    if (next.parent === next.id) return 'A task cannot be its own parent.';
    if (next.parent && st.tasks.filter(function (t) { return t.id === next.parent; })[0].projectId !== next.projectId) return 'A subtask must be in the same project as its parent.';
    if (!dateOk(next.due) || !dateOk(next.start)) return 'Dates must be YYYY-MM-DD.';
    var pr = Number(next.progress || 0);
    if (isNaN(pr) || pr < 0 || pr > 100) return 'Progress must be between 0 and 100.';
    if (pr === 100 && next.status !== 'Completed') return 'Progress can reach 100% only when the task is completed.';
    var deps = next.dependsOn || [];
    if (deps.some(function (d) { return !st.tasks.some(function (t) { return t.id === d; }); })) return 'A dependency points to a task that does not exist.';
    if (hasCycle_(st.tasks, next.id, deps)) return 'That dependency would create a loop.';
    var from = cur ? cur.status : '', to = next.status;
    if (cur && from !== to) {
      if (TRANSITIONS[from] && TRANSITIONS[from].indexOf(to) < 0) return 'A task cannot move from ' + from + ' to ' + to + '.';
      if (to === 'Cancelled' && !String(next.cancelReason || '').trim()) return 'Give a reason for cancelling.';
      if (to === 'Blocked' && !(next.blocker && String(next.blocker.text || '').trim())) return 'Say what is blocking this task.';
      var proj = st.projects.filter(function (p) { return p.id === next.projectId; })[0];
      if (to === 'Completed' && next.requiresReview && from !== 'In Review' && from !== 'Awaiting Approval' && a.role !== 'Administrator') return 'This task must go through review first.';
      if (to === 'Completed' && next.requiresReview && a.role !== 'Administrator' && !ownsProject_(proj, a)) return 'A project owner must approve this task.';
      if (to === 'Changes Requested' && a.role !== 'Administrator' && !ownsProject_(proj, a)) return 'Only a project owner can request changes.';
    }
  }
  if (coll === 'users') {
    var dom = authCfg_().domain, mail = String(next.email || '');
    if (ROLES.indexOf(next.role) < 0) return 'Unknown role.';
    if (!/^[^@\s]+@[^@\s]+$/.test(mail)) return 'Enter a valid email address.';
    if (!cur && mail.split('@')[1] !== dom) return 'Use an official @' + dom + ' address.';
    if (!String(next.name || '').trim()) return 'An employee needs a name.';
    if (!dateOk(next.joiningDate)) return 'Dates must be YYYY-MM-DD.';
    if (next.managerEmail && next.managerEmail === mail) return 'An employee cannot be their own manager.';
    if (next.managerEmail && !userByEmail_(next.managerEmail)) return 'The manager must be a registered employee.';
  }
  return '';
}

// ---------- comparing and merging ----------
function canon_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.length ? '[' + v.map(canon_).join(',') + ']' : '';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== '' && v[k] !== null && v[k] !== undefined; }).map(function (k) { return k + ':' + canon_(v[k]); }).join(',') + '}';
  return String(v);
}
function noteKey_(n) { return n.id || (String(n.ts) + '|' + String(n.who || n.author || '')); }
/** Two people adding notes at once must both be kept. */
function mergeAppend_(current, base, incoming) {
  var baseKeys = {}; (base || []).forEach(function (n) { baseKeys[noteKey_(n)] = canon_(n); });
  var inc = {}; (incoming || []).forEach(function (n) { inc[noteKey_(n)] = n; });
  var out = (current || []).filter(function (n) {
    var k = noteKey_(n);
    return inc[k] !== undefined || baseKeys[k] === undefined; // in the person's list, or added by someone else since
  }).map(function (n) {
    var k = noteKey_(n);
    return inc[k] && canon_(inc[k]) !== baseKeys[k] ? inc[k] : n; // this person edited it
  });
  var have = {}; out.forEach(function (n) { have[noteKey_(n)] = true; });
  (incoming || []).forEach(function (n) { var k = noteKey_(n); if (!have[k] && baseKeys[k] === undefined) out.push(n); });
  return out;
}
/** People add notes in their own name, and change or remove only their own. Project owners may tidy. */
function noteProblem_(f, cur, next, a, canManage) {
  if (a.open) return '';
  var signed = function (n) { return [n.who, n.author].filter(Boolean).map(function (x) { return String(x).trim().toLowerCase(); }); };
  var me = String(a.name || '').trim().toLowerCase();
  var byMe = function (n) { var w = signed(n); return w.length > 0 && w.every(function (x) { return x === me; }); };
  var was = {}, seen = {}, bad = '';
  (cur[f] || []).forEach(function (n) { was[noteKey_(n)] = n; });
  (next[f] || []).forEach(function (n) {
    var k = noteKey_(n), o = was[k];
    seen[k] = true;
    if (!o) { if (!byMe(n)) bad = 'You can only add notes in your own name.'; return; }
    if (canon_(o) !== canon_(n) && !canManage && !(byMe(o) && !a.nameShared)) bad = 'You can only edit your own notes.';
    if (signed(o).join() !== signed(n).join()) bad = 'The author of a note cannot be changed.';
  });
  Object.keys(was).forEach(function (k) { if (!seen[k] && !canManage && !(byMe(was[k]) && !a.nameShared)) bad = 'You can only remove your own notes.'; });
  return bad;
}

// ---------- audit ----------
var FIELD_NAMES = { ownerEmail: 'Owner email', accountableEmail: 'Answerable email', managerEmails: 'Project managers', status: 'Status', owner: 'Owner', accountable: 'Answerable', due: 'Due date', priority: 'Priority', progress: 'Progress', name: 'Name', desc: 'Description', criteria: 'Acceptance criteria', deliverable: 'Expected outcome', start: 'Start date', objective: 'Objective', outcome: 'Expected outcome', blocker: 'Blocker', dependsOn: 'Dependencies', archivedAt: 'Archived', final: 'Final decision' };
var FIELD_ACTIONS = { status: 'status_changed', owner: 'owner_changed', accountable: 'owner_changed', due: 'deadline_changed', progress: 'progress_changed', priority: 'priority_changed', blocker: 'blocker_changed', dependsOn: 'dependency_changed', archivedAt: 'archive_changed' };
function short_(v) { var s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v == null ? '' : v); return s.length > 300 ? s.slice(0, 297) + '...' : s; }
function auditFor_(coll, cur, next, a, reqId, ts, reason) {
  var rec = next || cur;
  var id = rec.id || rec.name || rec.email || coll;
  var label = rec.name || rec.decision || rec.desc || rec.action || id;
  var projectId = coll === 'projects' ? rec.id : (rec.projectId || '');
  var taskId = coll === 'tasks' ? rec.id : '';
  var row = function (action, field, oldV, newV, text) { return [Utilities.getUuid(), ts, a.email || '', a.name || '', coll, String(id), projectId, taskId, action, field, short_(oldV), short_(newV), text + (reason ? ' Reason: ' + reason : ''), reqId]; };
  if (!cur) {
    var made = [row('created', '', '', '', 'Created ' + coll.replace(/s$/, '') + ' "' + short_(label) + '"')];
    if ((coll === 'tasks' || coll === 'projects') && next.owner && !/^\s*tbd/i.test(String(next.owner))) made.push(row(coll === 'tasks' ? 'task_assigned' : 'project_assigned', 'owner', '', next.owner, 'Assigned "' + short_(label) + '" to ' + short_(next.owner)));
    return made;
  }
  if (!next) return [row('deleted', '', '', '', 'Deleted ' + coll.replace(/s$/, '') + ' "' + short_(label) + '"')];
  var out = [], fields = changedFields_(cur, next);
  fields.forEach(function (f) {
    if (f === 'ownerEmail' && fields.indexOf('owner') >= 0) return; // the owner row already says this
    if (f === 'accountableEmail' && fields.indexOf('accountable') >= 0) return;
    if (APPEND_ONLY.indexOf(f) >= 0) {
      var was = {}; (cur[f] || []).forEach(function (n) { was[noteKey_(n)] = n; });
      var Kind = function (k) { return k.charAt(0).toUpperCase() + k.slice(1); };
      (next[f] || []).forEach(function (n) {
        var k = noteKey_(n), o = was[k];
        var kind = n.type ? String(n.type) : 'comment';
        delete was[k];
        if (!o) out.push(row(kind + '_added', f, '', n.text, Kind(kind) + ' added on "' + short_(label) + '": ' + short_(n.text)));
        else if (canon_(o) !== canon_(n)) out.push(row(kind + '_edited', f, o.text, n.text, Kind(kind) + ' edited on "' + short_(label) + '"'));
      });
      Object.keys(was).forEach(function (k) {
        var kind = was[k].type ? String(was[k].type) : 'comment';
        out.push(row(kind + '_removed', f, was[k].text, '', Kind(kind) + ' removed from "' + short_(label) + '"'));
      });
      return;
    }
    if (f === 'milestones') {
      var oldMs = {}; (cur.milestones || []).forEach(function (m) { oldMs[m.id] = m; });
      (next.milestones || []).forEach(function (m) {
        var o = oldMs[m.id]; delete oldMs[m.id];
        if (!o) out.push(row('milestone_added', f, '', m.name, 'Milestone "' + short_(m.name) + '" added'));
        else if (o.status !== m.status) out.push(row('milestone_changed', 'milestone status', o.status, m.status, 'Milestone "' + short_(m.name) + '" moved from ' + o.status + ' to ' + m.status));
        else if (o.due !== m.due) out.push(row('deadline_changed', 'milestone date', o.due, m.due, 'Milestone "' + short_(m.name) + '" date changed from ' + o.due + ' to ' + m.due));
        else if (canon_(o) !== canon_(m)) out.push(row('milestone_changed', 'milestone', '', m.name, 'Milestone "' + short_(m.name) + '" edited'));
      });
      Object.keys(oldMs).forEach(function (k) { out.push(row('milestone_removed', f, oldMs[k].name, '', 'Milestone "' + short_(oldMs[k].name) + '" removed')); });
      return;
    }
    var nm = FIELD_NAMES[f] || f;
    out.push(row(FIELD_ACTIONS[f] || 'updated', f, cur[f], next[f], nm + ' changed from "' + short_(cur[f]) + '" to "' + short_(next[f]) + '" on "' + short_(label) + '"'));
  });
  return out;
}
/** Writing past the bottom of a tab's grid throws, so grow the grid first. */
function ensureRows_(sh, lastRow) {
  var max = sh.getMaxRows();
  if (lastRow > max) sh.insertRowsAfter(max, lastRow - max + 200);
}
function appendRows_(tab, rows) {
  if (!rows.length) return;
  var sh = SpreadsheetApp.getActive().getSheetByName(tab);
  var at = Math.max(sh.getLastRow(), 1) + 1;
  ensureRows_(sh, at + rows.length - 1);
  var rng = sh.getRange(at, 1, rows.length, rows[0].length);
  rng.setNumberFormat('@');
  rng.setValues(rows.map(function (r) { return r.map(safeCell_); }));
}
function readAudit_(limit) {
  var sh = SpreadsheetApp.getActive().getSheetByName(AUDIT_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var n = sh.getLastRow() - 1, take = Math.min(n, limit);
  return sh.getRange(n - take + 2, 1, take, AUDIT_COLS.length).getValues().map(function (r) {
    var o = {}; AUDIT_COLS.forEach(function (c, i) { o[c] = cell_(r[i]); }); return o;
  }).reverse();
}
function readTable_(tab, cols) {
  var sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map(function (r) {
    var o = {}; cols.forEach(function (c, i) { o[c] = cell_(r[i]); }); return o;
  });
}

// ---------- applying saves one record at a time ----------
var COLLECTIONS = { projects: 'id', tasks: 'id', risks: 'id', dependencies: 'id', decisions: 'id', actions: 'id', updates: 'id', programs: 'id', roles: 'name' };
function schemaFor_(key) { return SCHEMA.filter(function (s) { return s.key === key; })[0]; }
function findIn_(list, field, id) { for (var i = 0; i < list.length; i++) if (String(list[i][field]) === String(id)) return i; return -1; }

function apply_(body, a, preloaded) {
  var ops = body.ops || [];
  if (!ops.length) return { ok: true, version: getVersion_(), stamped: [] };
  if (ops.length > 500) return { ok: false, error: 'Too many changes at once.' };
  if (ops.filter(function (o) { return o.del; }).length > 25) return { ok: false, error: 'Refused: this save would delete more than 25 records at once.' };
  var cache = CacheService.getScriptCache();
  var reqId = String(body.requestId || Utilities.getUuid()).slice(0, 120);
  var replayKey = 'req:' + (a.email || a.name || '') + ':' + reqId; // one person's request ID can never fetch another person's reply
  var seen = cache.get(replayKey);
  if (seen) return JSON.parse(seen); // the same save arrived twice: do not apply it twice
  var pulled = preloaded || pull_();
  var st = pulled.state;
  var users = users_();
  var rejected = [], plan = [];
  var ts = new Date().toISOString();

  // New projects first, so their tasks can point to them; then tasks, so a
  // project change in the same save sees the tasks as they will be.
  var rank = function (op) { return op.c === 'projects' ? (op.create ? 0 : 2) : 1; };
  var order = ops.map(function (op, i) { return i; }).sort(function (x, y) { return rank(ops[x]) - rank(ops[y]) || x - y; });
  order.forEach(function (i) {
    var op = ops[i];
    var reject = function (reason, code, field, current) { rejected.push({ i: i, c: op.c, id: op.id, reason: reason, code: code || 'invalid', field: field || '', current: current === undefined ? null : current }); };
    if (op.c === 'governance' || op.c === 'options') {
      var d = deny_(a, op.c, st[op.c], op.doc, st);
      if (d) return reject(d, 'denied');
      if (!same_(st[op.c], op.base) && op.c === 'governance') return reject('Someone else changed these settings. Reload and try again.', 'conflict');
      st[op.c] = op.doc;
      plan.push({ doc: op.c, value: op.doc });
      return;
    }
    if (op.c === 'users') {
      var uCur = users.filter(function (u) { return u.email === String(op.id).toLowerCase(); })[0] || null;
      var uPatch = {}; USER_EDIT.forEach(function (k) { if (op.rec && op.rec[k] !== undefined) uPatch[k] = op.rec[k]; });
      var uNext = op.del ? null : Object.assign({}, uCur || {}, uPatch, { email: String(op.id).trim().toLowerCase() });
      if (uNext) {
        uNext.managerEmail = String(uNext.managerEmail || '').trim().toLowerCase();
        ['name', 'department', 'designation'].forEach(function (k) { uNext[k] = String(uNext[k] || '').trim().slice(0, 120); });
        var al = uNext.aliases; al = Array.isArray(al) ? al : String(al || '').split(/\s*,\s*/);
        uNext.aliases = al.map(function (x) { return String(x).trim(); }).filter(Boolean);
        uNext.rawName = uNext.name + (uNext.aliases.length ? ' (' + uNext.aliases.join(', ') + ')' : '');
      }
      var ud = deny_(a, 'users', uCur, uNext, st) || invalid_('users', uCur, uNext, st, a);
      if (ud) return reject(ud, 'denied');
      var admins = users.filter(function (u) { return u.active && u.role === 'Administrator' && u.email !== String(op.id).toLowerCase(); }).length;
      if (authCfg_().required && !admins && (!uNext || !uNext.active || uNext.role !== 'Administrator')) return reject('There must always be at least one active administrator.', 'invalid');
      if (uNext) { uNext.active = uNext.active !== false && String(uNext.active) !== 'false'; uNext.addedBy = uNext.addedBy || a.name; uNext.addedAt = uNext.addedAt || ts; uNext.updatedAt = ts; uNext.employeeId = uNext.employeeId || nextEmployeeId_(users); }
      users = users.filter(function (u) { return u.email !== String(op.id).toLowerCase(); }).concat(uNext ? [uNext] : []);
      plan.push({ users: true, cur: uCur, next: uNext });
      return;
    }
    var idField = COLLECTIONS[op.c];
    if (!idField) return reject('Unknown record type.', 'invalid');
    var list = st[op.c] = st[op.c] || [];
    var idx = findIn_(list, idField, op.id);
    var cur = idx >= 0 ? list[idx] : null;
    if (a.role !== 'Administrator' && cur) {
      var pid = op.c === 'projects' ? cur.id : cur.projectId;
      var pr = st.projects.filter(function (p) { return p.id === pid; })[0];
      if (pr && !canSeeProject_(pr, st.tasks, a)) return reject('You do not have access to this project.', 'denied');
    }
    var next;
    if (op.del) {
      if (!cur) return; // already gone: nothing to do
      var dd = deny_(a, op.c, cur, null, st);
      if (dd) return reject(dd, 'denied');
      if (JSON.stringify(cur).length > CELL_MAX * 4) return reject('This record is too large to keep in Deleted items, so it was not deleted.', 'invalid');
      list.splice(idx, 1);
      plan.push({ c: op.c, id: op.id, cur: cur, next: null, idField: idField, reason: op.reason || '' });
      return;
    }
    if (op.create || !cur) {
      if (cur) return reject('This ID already exists: ' + op.id, 'duplicate');
      if (idField === 'id' && !op.restoreOf && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(op.id))) return reject('That is not a valid ID.', 'invalid');
      if (!op.rec) return reject('This record no longer exists.', 'missing');
      next = JSON.parse(JSON.stringify(op.rec));
      next[idField] = op.id;
      if (a.role !== 'Administrator') delete op.restoreOf; // restoring keeps the old stamps, so only a Super Admin may
      if (!op.restoreOf) STAMPS.forEach(function (k) { delete next[k]; });
    } else {
      next = JSON.parse(JSON.stringify(cur));
      var conflict = null;
      Object.keys(op.set || {}).forEach(function (f) {
        if (f === idField || STAMPS.indexOf(f) >= 0) return; // IDs and server stamps never change
        var base = (op.base || {})[f];
        if (APPEND_ONLY.indexOf(f) >= 0) { next[f] = mergeAppend_(cur[f], base, op.set[f]); return; }
        if (!conflict && !same_(cur[f], base) && !same_(cur[f], op.set[f])) conflict = f;
        if (op.set[f] === null || op.set[f] === undefined) delete next[f]; else next[f] = op.set[f];
      });
      // Permission first: a refused person must not learn the current value from a conflict reply.
      var mayChange = deny_(a, op.c, cur, next, st);
      if (mayChange) return reject(mayChange, 'denied');
      if (conflict) return reject((FIELD_NAMES[conflict] || conflict) + ' was changed by ' + (cur.updatedBy || 'someone else') + '. Check the latest value.', 'conflict', conflict, cur[conflict]);
    }
    if (a.role !== 'Administrator' && next.projectId) {
      var dest = st.projects.filter(function (p) { return p.id === next.projectId; })[0];
      if (dest && !canSeeProject_(dest, st.tasks, a)) return reject('You do not have access to this project.', 'denied');
    }
    if (op.c === 'tasks' && !cur && !op.restoreOf && a.role !== 'Administrator' && !ownsProject_(st.projects.filter(function (p) { return p.id === next.projectId; })[0], a)) next.accountable = 'TBD';
    var unknown = identity_(op.c, cur, next, users, a, ts);
    if (unknown) return reject(unknown, 'invalid', 'ownerEmail');
    var denied = deny_(a, op.c, cur, next, st);
    if (denied) return reject(denied, 'denied');
    var problem = '';
    var earlier = cur || {};
    if (!op.restoreOf) APPEND_ONLY.forEach(function (f) {
      var owner = op.c === 'projects' ? earlier : st.projects.filter(function (p) { return p.id === next.projectId; })[0];
      problem = problem || (canon_(earlier[f]) !== canon_(next[f]) ? noteProblem_(f, earlier, next, a, a.role === 'Administrator' || (a.role === 'Project Owner' && ownsProject_(owner, a) && !a.nameShared)) : '');
    });
    if (problem) return reject(problem, 'denied');
    if (op.c === 'tasks' && cur && a.role !== 'Administrator' && !(a.role === 'Project Owner' && ownsProject_(st.projects.filter(function (p) { return p.id === cur.projectId; })[0], a))) {
      // A co-owner can add their own files and links, and cannot alter or remove anyone else's.
      var kept = {}; (next.attachments || []).forEach(function (x) { kept[canon_(x)] = true; });
      if ((cur.attachments || []).some(function (x) { return !kept[canon_(x)] && String(x.by || '').toLowerCase() !== String(a.name || '').toLowerCase(); })) return reject('You can only change your own files and links.', 'denied');
    }
    if (schemaFor_(op.c) && oversize_(op.c, next)) return reject('This record has grown too long for the Sheet. Remove some notes or text and try again.', 'invalid');
    var bad = invalid_(op.c, cur, next, st, a);
    if (bad) return reject(bad, 'invalid');
    next.updatedAt = ts; next.updatedBy = a.name;
    if (op.c === 'tasks' && next.status === 'Completed' && (!cur || cur.status !== 'Completed')) next.completedTs = ts;
    if (op.c === 'tasks' && next.status !== 'Completed') delete next.completedTs;
    if (!cur) { next.createdAt = next.createdAt || ts; next.createdBy = next.createdBy || a.name; }
    if (op.c === 'tasks' && next.due && !next.originalDue) next.originalDue = (cur && cur.due) || next.due;
    if (op.c === 'projects' && next.due && !next.originalDue) next.originalDue = (cur && cur.due) || next.due;
    if (cur) list[idx] = next; else list.push(next);
    plan.push({ c: op.c, id: op.id, cur: cur, next: next, idField: idField, reason: op.reason || '', restoreOf: op.restoreOf || '' });
  });

  if (rejected.length) return { ok: false, rejected: rejected, version: pulled.version };

  // A milestone follows its tasks, whoever finished them.
  var moved = false, touched = {};
  plan.forEach(function (p) { if (p.c === 'tasks' && p.next) touched[p.next.projectId] = true; });
  Object.keys(touched).forEach(function (pid) {
    var pi = findIn_(st.projects, 'id', pid);
    if (pi < 0) return;
    var cur = st.projects[pi], changed = false;
    var ms = (cur.milestones || []).map(function (m) {
      var list = st.tasks.filter(function (t) { return t.projectId === pid && t.ms === m.id && !t.parent && t.status !== 'Cancelled'; });
      if (!list.length) return m;
      var done = list.every(function (t) { return t.status === 'Completed'; });
      if (done && m.status !== 'Completed') { changed = true; return Object.assign({}, m, { status: 'Completed', autoCompleted: true }); }
      if (!done && m.status === 'Completed' && m.autoCompleted) { changed = true; return Object.assign({}, m, { status: 'In Progress', autoCompleted: false }); }
      return m;
    });
    if (!changed) return;
    var next = JSON.parse(JSON.stringify(cur));
    next.milestones = ms; next.updatedAt = ts; next.updatedBy = a.name;
    st.projects[pi] = next; moved = true;
    plan.push({ c: 'projects', id: pid, cur: cur, next: next, idField: 'id', reason: '' });
  });

  var ss = SpreadsheetApp.getActive();
  var audit = [], trash = [], stamped = [], done = [];
  var headerBad = '';
  var tabs = {}; plan.forEach(function (p) { if (p.c) { tabs[p.c] = true; if (p.c === 'projects') NESTED.forEach(function (k) { tabs[k] = true; }); } });
  Object.keys(tabs).forEach(function (k) { var sc = schemaFor_(k); if (sc && !headerBad) headerBad = checkHeader_(ss, sc); });
  if (headerBad) return { ok: false, error: headerBad };
  var failure = null;
  try { plan.forEach(function (p) {
    if (p.doc) { var o = {}; o[p.doc] = JSON.stringify(p.value); metaSet_(o); audit.push([Utilities.getUuid(), ts, a.email || '', a.name || '', p.doc, p.doc, '', '', 'settings_changed', '', '', '', 'Changed ' + p.doc, reqId]); return; }
    if (p.users) { writeUser_(p.cur, p.next); audit.push([Utilities.getUuid(), ts, a.email || '', a.name || '', 'users', (p.next || p.cur).email, '', '', p.next ? 'user_changed' : 'user_removed', 'role', p.cur ? p.cur.role : '', p.next ? p.next.role : '', (p.next ? 'User ' + p.next.email + ' set to ' + p.next.role + (p.next.active ? '' : ' (inactive)') + (p.cur ? ', changed: ' + (USER_EDIT.filter(function (k) { return canon_(p.cur[k]) !== canon_(p.next[k]); }).join(', ') || 'nothing') : '') : 'Removed user ' + p.cur.email), reqId]); return; }
    var s = schemaFor_(p.c);
    if (p.next) upsertRow_(ss, s, p.idField, p.next); else deleteRow_(ss, s, p.idField, p.id);
    if (p.c === 'projects') {
      NESTED.forEach(function (k) {
        var was = p.cur ? p.cur[k] : []; var now = p.next ? p.next[k] : [];
        if (canon_(was) !== canon_(now)) replaceNested_(ss, schemaFor_(k), p.id, now || []);
      });
    }
    if (!p.next) {
      var json = JSON.stringify(p.cur);
      trash.push([Utilities.getUuid(), ts, a.name || '', p.c, String(p.id), json.slice(0, CELL_MAX), '', json.slice(CELL_MAX, CELL_MAX * 2), json.slice(CELL_MAX * 2, CELL_MAX * 3), json.slice(CELL_MAX * 3, CELL_MAX * 4)]);
    }
    if (p.restoreOf) markRestored_(p.restoreOf, ts);
    var rows = auditFor_(p.c, p.cur, p.next, a, reqId, ts, p.reason);
    if (p.restoreOf && rows[0]) { rows[0][8] = 'restored'; rows[0][12] = String(rows[0][12]).replace(/^Created/, 'Restored'); }
    audit = audit.concat(rows);
    if (p.next) stamped.push({ c: p.c, id: p.id, updatedAt: p.next.updatedAt, updatedBy: p.next.updatedBy, createdAt: p.next.createdAt, createdBy: p.next.createdBy, originalDue: p.next.originalDue, ownerEmail: p.next.ownerEmail, accountableEmail: p.next.accountableEmail, assignedBy: p.next.assignedBy, assignedByEmail: p.next.assignedByEmail, assignedAt: p.next.assignedAt, completedTs: p.next.completedTs });
    done.push(p);
  }); } catch (err) { failure = err; }
  // Whatever did get written is recorded and announced, so a retry finishes the rest.
  // A notification problem is logged and retried. It never stops a save.
  var told = { audit: [], notified: [] };
  try { told = notify_(done, a, users, st, ts, reqId); }
  catch (err) { audit.push([Utilities.getUuid(), ts, a.email || '', a.name || '', 'notifications', reqId, '', '', 'notification_error', '', '', '', 'Notifications could not be queued: ' + short_(err && err.message || err), reqId]); }
  audit = audit.concat(told.audit);
  appendRows_(TRASH_SHEET, trash);
  appendRows_(AUDIT_SHEET, audit);
  var v = getVersion_() + 1;
  metaSet_({ version: String(v), updatedAt: ts, updatedBy: a.name || 'website' });
  if (failure) return { ok: false, version: v, error: 'Only part of this save reached the Sheet (' + String(failure.message || failure) + ').' };
  var res = { ok: true, version: v, stamped: stamped, audit: audit.length, refresh: moved || plan.some(function (p) { return p.users; }), notified: told.notified };
  res.entries = audit.slice(0, 50).map(function (r) { var o = {}; AUDIT_COLS.forEach(function (c, i) { o[c] = r[i]; }); return o; }).filter(function (o) { return a.role === 'Administrator' || o.entityType !== 'users'; });
  try { cache.put(replayKey, JSON.stringify(res), 600); } catch (x) { /* very large reply: skip the replay cache */ }
  return res;
}
function same_(a, b) { return canon_(a) === canon_(b); }
function tooBig_(vals) { return vals.some(function (v) { return String(v).length > CELL_MAX; }); }
/** True when a record would not fit in the Sheet. Checked before anything is written. */
function oversize_(key, rec) {
  if (tooBig_(rowValues_(schemaFor_(key), rec))) return true;
  return key === 'projects' && NESTED.some(function (k) {
    return (rec[k] || []).some(function (o) { return tooBig_(rowValues_(schemaFor_(k), o)); });
  });
}
/** Columns are written by position, so a column moved by hand must stop the save. */
function checkHeader_(ss, s) {
  var sh = ss.getSheetByName(s.tab);
  var cols = allCols_(s);
  var have = sh ? sh.getRange(1, 1, 1, Math.min(cols.length, Math.max(sh.getLastColumn(), 1))).getValues()[0] : [];
  return cols.every(function (c, i) { return String(have[i]) === c; }) ? '' : 'The columns of the ' + s.tab + ' tab were changed. An administrator should run Control Tower > Set up / repair tabs.';
}

function rowValues_(s, o) {
  var known = {}; s.cols.concat(s.tail || []).forEach(function (c) { known[c] = true; });
  var extra = {};
  Object.keys(o).forEach(function (k) { if (!known[k] && NESTED.indexOf(k) < 0) extra[k] = o[k]; });
  return s.cols.map(function (c) {
    var v = o[c];
    if (s.lists && s.lists[c] !== undefined) return Array.isArray(v) ? v.join(s.lists[c]) : (v == null ? '' : String(v));
    if (s.bools && s.bools.indexOf(c) >= 0) return v === false || v === 'false' ? 'FALSE' : (v === true || v === 'true' ? 'TRUE' : (v == null || v === '' ? '' : String(v)));
    if (s.nums && s.nums.indexOf(c) >= 0) return v == null || v === '' ? 0 : Number(v);
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }).concat([Object.keys(extra).length ? JSON.stringify(extra) : '']).concat((s.tail || []).map(function (c) { return o[c] == null ? '' : String(o[c]); })).map(safeCell_);
}
function rowOfId_(sh, col, id) {
  var n = sh.getLastRow(); if (n < 2) return -1;
  var ids = sh.getRange(2, col, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function upsertRow_(ss, s, idField, rec) {
  var sh = ss.getSheetByName(s.tab);
  var col = s.cols.indexOf(idField) + 1;
  var row = rowOfId_(sh, col, rec[idField]);
  var vals = rowValues_(s, rec);
  if (row < 0) row = Math.max(sh.getLastRow(), 1) + 1;
  ensureRows_(sh, row);
  var rng = sh.getRange(row, 1, 1, vals.length);
  rng.setNumberFormat('@');
  if (s.nums) s.nums.forEach(function (c) { sh.getRange(row, s.cols.indexOf(c) + 1, 1, 1).setNumberFormat('0'); });
  rng.setValues([vals]);
}
function deleteRow_(ss, s, idField, id) {
  var sh = ss.getSheetByName(s.tab);
  var row = rowOfId_(sh, s.cols.indexOf(idField) + 1, id);
  if (row > 0) deleteSheetRow_(sh, row);
}
/** Sheets refuses to delete its last row below the frozen header. */
function deleteSheetRow_(sh, row) {
  if (sh.getMaxRows() <= sh.getFrozenRows() + 1) sh.insertRowsAfter(sh.getMaxRows(), 1);
  sh.deleteRow(row);
}
function replaceNested_(ss, s, projectId, rows) {
  // Build the whole tab, then write it in one go: nothing is deleted before its replacement exists.
  var sh = ss.getSheetByName(s.tab);
  var width = Math.max(sh.getLastColumn(), s.cols.length + 1), known = s.cols.length + 1;
  var last = sh.getLastRow();
  var col = s.cols.indexOf('projectId');
  var keyCols = s.id ? [s.id] : s.key === 'comments' ? ['who', 'ts'] : ['item'];
  var grid = [];
  if (last >= 2) {
    var rng = sh.getRange(2, 1, last - 1, width), plain = rng.getValues(), withFormulas = gridOf_(rng);
    // Our own columns are rewritten as text. Hand-added columns keep their formulas.
    grid = withFormulas.map(function (r, i) { return r.map(function (v, j) { return j >= known ? v : safeCell_(plain[i][j] instanceof Date ? cell_(plain[i][j]) : plain[i][j]); }); });
  }
  var rowKey = function (r) { return keyCols.map(function (c) { return String(r[s.cols.indexOf(c)]); }).join('|'); };
  var kept = grid.filter(function (r) { return String(r[col]) !== String(projectId); });
  var theirs = {}; grid.forEach(function (r) { if (String(r[col]) === String(projectId) && !theirs[rowKey(r)]) theirs[rowKey(r)] = r; });
  var fresh = rows.map(function (o) {
    var v = rowValues_(s, Object.assign({}, o, { projectId: projectId }));
    // Columns added by hand stay with their row.
    var old = theirs[keyCols.map(function (c) { return String(o[c] == null ? '' : o[c]); }).join('|')];
    while (v.length < width) v.push(old ? old[v.length] : '');
    return v;
  });
  var all = kept.concat(fresh);
  if (all.length) {
    ensureRows_(sh, all.length + 1);
    sh.getRange(2, 1, all.length, known).setNumberFormat('@');
    sh.getRange(2, 1, all.length, width).setValues(all);
  }
  if (last - 1 > all.length) sh.getRange(all.length + 2, 1, last - 1 - all.length, width).clearContent();
}
function writeUser_(cur, next) {
  ensureUserColumns_();
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  var at = userColumns_(sh), email = (next || cur).email;
  // The tab may hold an address typed in capitals. Sign-in ignores case, so this must too.
  var row = -1, n = sh.getLastRow();
  if (n >= 2) sh.getRange(2, at.email + 1, n - 1, 1).getValues().forEach(function (r, i) { if (row < 0 && String(r[0]).trim().toLowerCase() === email) row = i + 2; });
  if (!next) { if (row > 0) deleteSheetRow_(sh, row); return; }
  if (row < 0) row = Math.max(n, 1) + 1;
  ensureRows_(sh, row);
  var width = sh.getLastColumn();
  var vals = sh.getRange(row, 1, 1, width).getValues()[0]; // hand-added columns keep their values
  USER_COLS.forEach(function (c) {
    if (at[c] === undefined) return;
    var v = c === 'active' ? (next.active ? 'TRUE' : 'FALSE') : c === 'name' ? (next.rawName || next.name) : next[c];
    vals[at[c]] = safeCell_(String(v == null ? '' : v));
  });
  var rng = sh.getRange(row, 1, 1, width);
  rng.setNumberFormat('@');
  rng.setValues([vals]);
}
function markRestored_(trashId, ts) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TRASH_SHEET);
  var row = rowOfId_(sh, 1, trashId);
  if (row > 0) sh.getRange(row, TRASH_COLS.indexOf('restoredAt') + 1, 1, 1).setValues([[ts]]);
}

// ---------- who a record belongs to ----------
function ownerNames_(field) {
  if (!field || /^\s*tbd/i.test(String(field))) return [];
  return String(field).split(/\s*[,\/&]\s*|\s+or\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
}
function peopleNamed_(name, users) {
  var n = String(name).trim().toLowerCase();
  return users.filter(function (u) {
    return u.active && (u.name.toLowerCase() === n || (u.rawName || '').toLowerCase() === n || u.email === n || (u.aliases || []).some(function (x) { return x.toLowerCase() === n; }));
  });
}
/** Exact matches only, and never a guess: a name two people share belongs to neither. */
function personNamed_(name, users) { var hits = peopleNamed_(name, users); return hits.length === 1 ? hits[0] : null; }
function fieldIdentity_(cur, next, nameF, mailF, users) {
  var was = String(cur ? cur[mailF] || '' : '').toLowerCase(), now = String(next[mailF] || '').trim().toLowerCase();
  if (now && now !== was) {
    var mails = [], names = [], bad = '', list = now.split(/[\s,;]+/).filter(function (m, i, all) { return m && all.indexOf(m) === i; });
    if (list.length > MAX_OWNERS) return 'A task can have at most ' + MAX_OWNERS + ' people.';
    list.forEach(function (m) {
      var u = users.filter(function (x) { return x.email === m; })[0];
      if (!u) bad = bad || m + ' is not a registered employee. Check the address, or add them under Administration.';
      else if (!u.active) bad = bad || u.name + ' (' + m + ') is inactive, so work cannot be assigned to them.';
      else { mails.push(u.email); names.push(u.name); }
    });
    if (bad) return bad;
    next[mailF] = mails.join(', '); next[nameF] = names.join(', ');
    return '';
  }
  if (cur && String(cur[nameF] || '') === String(next[nameF] || '')) return '';
  var parts = ownerNames_(next[nameF]), found = [];
  parts.forEach(function (n) { var u = personNamed_(n, users); if (u) found.push(u.email); });
  next[mailF] = parts.length && found.length === parts.length ? found.join(', ') : '';
  return '';
}
/** The email is what identifies a person. The server works it out, checks it and stamps who assigned the work. */
function identity_(coll, cur, next, users, a, ts) {
  if (coll !== 'tasks' && coll !== 'projects') return '';
  if (coll === 'tasks' && !cur && a.email && !next.ownerEmail && String(next.owner || '').trim().toLowerCase() === String(a.name || '').trim().toLowerCase()) next.ownerEmail = a.email;
  var bad = fieldIdentity_(cur, next, 'owner', 'ownerEmail', users);
  if (coll === 'projects') {
    bad = bad || fieldIdentity_(cur, next, 'accountable', 'accountableEmail', users);
    if (next.managerEmails !== undefined) {
      var list = Array.isArray(next.managerEmails) ? next.managerEmails : String(next.managerEmails || '').split(/\s*[,;]\s*/);
      list = list.map(function (m) { return String(m).trim().toLowerCase(); }).filter(Boolean);
      list.forEach(function (m) { if (!users.some(function (u) { return u.email === m && u.active; })) bad = bad || m + ' is not an active registered employee.'; });
      next.managerEmails = list;
    }
  }
  if (bad) return bad;
  if (coll === 'tasks') {
    var changed = !cur ? ownerNames_(next.owner).length > 0 : String(cur.owner || '') !== String(next.owner || '') || String(cur.ownerEmail || '') !== String(next.ownerEmail || '');
    if (changed) { next.assignedBy = a.name || ''; next.assignedByEmail = a.email || ''; next.assignedAt = ts; }
  }
  return '';
}
// ---------- file uploads ----------
var UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
// Ordinary work files only. Anything that can run in a browser or on a computer is refused, as are the older Office formats that hide macros. The type comes from here, never from the browser.
var UPLOAD_TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', csv: 'text/csv', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
function uploadFolder_() {
  var p = props_(), id = p.getProperty('UPLOAD_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) { /* it was deleted: make another */ } }
  var folder = DriveApp.createFolder('Control Tower Uploads');
  p.setProperty('UPLOAD_FOLDER_ID', folder.getId());
  return folder;
}
/** Saves a file to Drive, for people in the organisation with the link. The site then adds the link to the task or project. */
function upload_(body, a) {
  var st = pull_().state, isTask = body.kind === 'task';
  var rec = (isTask ? st.tasks : st.projects).filter(function (r) { return r.id === body.id; })[0];
  if (!rec) return { ok: false, code: 'missing', error: 'That record does not exist.' };
  var proj = isTask ? st.projects.filter(function (p) { return p.id === rec.projectId; })[0] : rec;
  var manages = a.role === 'Administrator' || (a.role === 'Project Owner' && ownsProject_(proj, a));
  if (!manages && !(isTask && a.role !== 'Viewer' && ownsTask_(rec, a))) return { ok: false, code: 'denied', error: 'You can add files only to your own work.' };
  var name = String(body.name || '').replace(/[\\\/:*?"<>|\u0000-\u001f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '_').trim().slice(-120), ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1];
  var type = ext && UPLOAD_TYPES.hasOwnProperty(ext.toLowerCase()) ? UPLOAD_TYPES[ext.toLowerCase()] : '';
  if (!type) return { ok: false, code: 'invalid', error: 'This type of file cannot be uploaded. Use PDF, Office, CSV, text or image files.' };
  if (String(body.data || '').length > UPLOAD_MAX_BYTES * 1.4) return { ok: false, code: 'invalid', error: 'Files can be up to 10 MB.' };
  var bytes;
  try { bytes = Utilities.base64Decode(String(body.data || '')); } catch (x) { return { ok: false, code: 'invalid', error: 'This file could not be read.' }; }
  if (!bytes.length || bytes.length > UPLOAD_MAX_BYTES) return { ok: false, code: 'invalid', error: 'Files can be up to 10 MB, and cannot be empty.' };
  var file = uploadFolder_().createFile(Utilities.newBlob(bytes, type, rec.id + ' - ' + name)), note = '';
  try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (x) { note = 'Saved, but only the Sheet owner can open it, because your organisation does not allow link sharing.'; }
  var ts = new Date().toISOString(), att = { name: name, url: file.getUrl(), by: a.name || '', ts: ts };
  // Added on the server, from the latest copy, so two uploads at once are both kept.
  var was = rec.attachments || [], saved = apply_({ ops: [{ c: isTask ? 'tasks' : 'projects', id: rec.id, set: { attachments: was.concat([att]) }, base: { attachments: was } }], requestId: 'up-' + Utilities.getUuid() }, a);
  if (!saved.ok) return { ok: false, code: 'failed', error: saved.rejected ? saved.rejected[0].reason : saved.error };
  appendRows_(AUDIT_SHEET, [[Utilities.getUuid(), ts, a.email || '', a.name || '', isTask ? 'tasks' : 'projects', String(rec.id), proj ? proj.id : '', isTask ? rec.id : '', 'file_uploaded', 'attachments', '', name, 'Uploaded ' + name, '']]);
  return { ok: true, note: note, attachment: att };
}

function nextTaskId_(tasks) {
  var top = 0, look = function (id) { var m = String(id).match(/^T-(\d+)$/); if (m) top = Math.max(top, Number(m[1])); };
  tasks.forEach(function (t) { look(t.id); });
  readTable_(TRASH_SHEET, TRASH_COLS).forEach(function (t) { if (t.collection === 'tasks') look(t.recordId); }); // a deleted task's ID is never reused
  return 'T-' + (top + 1 < 100 ? ('00' + (top + 1)).slice(-3) : String(top + 1));
}

// ---------- assigning a task by email ----------
/** One confirmed assignment, end to end. The same requestId can never make two tasks. */
function assign_(body, a) {
  if (a.role !== 'Administrator' && a.role !== 'Project Owner') return { ok: false, code: 'denied', error: 'Only Super Admins and Managers can assign tasks.' };
  var t = body.task || {}, reqId = String(body.requestId || '').trim().slice(0, 120);
  var name = String(t.name || '').trim(), email = String(t.ownerEmail || '').trim().toLowerCase(), due = String(t.due || '').trim();
  if (!reqId) return { ok: false, code: 'invalid', error: 'This request has no ID. Refresh the page and try again.' };
  if (!name) return { ok: false, code: 'invalid', field: 'name', error: 'A task needs a title.' };
  if (!email) return { ok: false, code: 'invalid', field: 'ownerEmail', error: 'Enter the employee\'s official email.' };
  if (PRIOS.indexOf(t.priority) < 0) return { ok: false, code: 'invalid', field: 'priority', error: 'Choose a priority.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, code: 'invalid', field: 'due', error: 'Choose a deadline.' };
  ensureSystemTabs_();
  var pulled = pull_(), st = pulled.state, users = users_();
  var again = st.tasks.filter(function (x) { return x.assignKey === reqId && (a.role === 'Administrator' || x.assignedByEmail === a.email); })[0];
  if (again) return { ok: true, duplicate: true, version: pulled.version, task: again, notified: notifiedFor_(reqId, a) };
  var mails = email.split(/[\s,;]+/).filter(function (m, i, all) { return m && all.indexOf(m) === i; }), people = [];
  if (!mails.length) return { ok: false, code: 'invalid', field: 'ownerEmail', error: 'Enter the employee\'s official email.' };
  if (mails.length > MAX_OWNERS) return { ok: false, code: 'invalid', field: 'ownerEmail', error: 'A task can have at most ' + MAX_OWNERS + ' people.' };
  for (var i = 0; i < mails.length; i++) {
    var who = users.filter(function (u) { return u.email === mails[i]; })[0];
    if (!who) return { ok: false, code: 'unknown_employee', field: 'ownerEmail', error: mails[i] + ' is not a registered employee.' };
    if (!who.active) return { ok: false, code: 'inactive_employee', field: 'ownerEmail', error: who.name + ' (' + mails[i] + ') is inactive.' };
    people.push(who);
  }
  var proj = st.projects.filter(function (p) { return p.id === t.projectId; })[0];
  if (!proj) return { ok: false, code: 'invalid', field: 'projectId', error: 'That project does not exist.' };
  if (proj.archivedAt) return { ok: false, code: 'invalid', field: 'projectId', error: 'That project is archived.' };
  if (a.role === 'Project Owner' && !ownsProject_(proj, a)) return { ok: false, code: 'denied', error: 'You can assign tasks only on projects you manage.' };
  var today = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  if (due < today) return { ok: false, code: 'invalid', field: 'due', error: 'The deadline is in the past.' };
  var id = nextTaskId_(st.tasks);
  var rec = { id: id, projectId: proj.id, name: name.slice(0, 300), desc: String(t.desc || '').slice(0, 5000), owner: people.map(function (u) { return u.name; }).join(', '), ownerEmail: people.map(function (u) { return u.email; }).join(', '), accountable: a.name || '', start: today, due: due, priority: t.priority, status: 'Not Started', progress: 0, kind: 'Task', datesProposed: false, assignKey: reqId };
  var res = apply_({ ops: [{ c: 'tasks', id: id, create: true, rec: rec }], requestId: reqId }, a, pulled);
  if (!res.ok) return { ok: false, code: res.rejected ? res.rejected[0].code : 'failed', error: res.rejected ? res.rejected[0].reason : res.error };
  res.task = st.tasks.filter(function (x) { return x.id === id; })[0];
  res.employees = people.map(function (u) { return { name: u.name, email: u.email, employeeId: u.employeeId, designation: u.designation, department: u.department }; });
  return res;
}

// ---------- notifications ----------
// Every email starts as a "queued" row in NotificationLog, so nothing is lost if sending fails.
// "accepted" means Google's mail service took it. Nobody can see from here whether it reached the inbox.
var NOTIF_COLS = ['notificationId', 'ts', 'channel', 'eventType', 'recipientEmail', 'recipientName', 'taskId', 'projectId', 'subject', 'deliveryStatus', 'attempts', 'lastAttemptAt', 'nextAttemptAt', 'errorDetails', 'dedupeKey', 'batchId', 'actorEmail', 'actorName', 'requestId', 'payload', 'emailMode'];
var EMAIL_MAX_ATTEMPTS = 5, RETRY_MINUTES = [5, 15, 60, 360], SEND_NOW = 5, DEDUPE_WINDOW = 6000, EMAIL_MAX_ITEMS = 30;
var EVENT_TITLE = { task_assigned: 'New Task Assigned', task_reassigned: 'Task Reassigned to You', project_assigned: 'New Project Assigned', deadline_reminder: 'Deadline Reminder', task_overdue: 'Task Overdue', task_completed: 'Task Completed', manager_comment: 'New Comment on Your Task', review_requested: 'Task Review Requested' };
var EVENT_INTRO = { task_assigned: 'A new task has been assigned to you.', task_reassigned: 'A task has been reassigned to you.', project_assigned: 'A project has been assigned to you.', deadline_reminder: 'This task is coming up to its deadline.', task_overdue: 'This task is past its deadline.', task_completed: 'This task has been marked as completed.', manager_comment: 'There is a new comment on your task.', review_requested: 'This task is waiting for a review.' };
var EVENT_GROUP = { task_assigned: 'assign', task_reassigned: 'assign', project_assigned: 'assign', deadline_reminder: 'daily', task_overdue: 'daily', task_completed: 'completed', manager_comment: 'comment', review_requested: 'review' };

/** off: nothing is sent. test: everything goes to one address. live: employees receive their own. */
function testAddress_() {
  var to = props_().getProperty('EMAIL_TEST_TO') || '';
  try { to = to || Session.getEffectiveUser().getEmail(); } catch (x) { /* shown as a failure when sending */ }
  return to;
}
function emailMode_() {
  var p = props_();
  if (p.getProperty('ASSIGN_EMAIL') === 'off') return { mode: 'off' };
  if (p.getProperty('EMAIL_MODE') === 'live') return { mode: 'live' };
  return { mode: 'test', to: testAddress_() };
}
function itemOf_(kind, rec, proj) {
  return { kind: kind, id: rec.id, name: rec.name, project: proj ? proj.name : '', projectId: proj ? proj.id : '', priority: rec.priority || '', due: rec.due || '', desc: String((kind === 'task' ? rec.desc : rec.objective) || '').slice(0, 600), status: rec.status || '', by: '', note: '' };
}
function owners_(rec, users) {
  var mails = String(rec.ownerEmail || '').toLowerCase().split(/\s*,\s*/).filter(Boolean);
  if (mails.length) return mails.map(function (m) {
    var u = users.filter(function (x) { return x.email === m; })[0];
    return { key: m, user: u && u.active ? u : null, name: u ? u.name : m };
  });
  return ownerNames_(rec.owner).map(function (n) {
    var u = personNamed_(n, users);
    return { key: u ? u.email : n.toLowerCase(), user: u, name: n };
  });
}
/** Whoever gave out the work and whoever answers for the project. */
function overseers_(rec, proj, users) {
  var out = owners_({ owner: proj && proj.owner, ownerEmail: proj && proj.ownerEmail }, users)
    .concat(owners_({ owner: proj && proj.accountable, ownerEmail: proj && proj.accountableEmail }, users))
    .concat(((proj && proj.managerEmails) || []).map(function (m) { return { key: m, user: users.filter(function (u) { return u.email === m && u.active; })[0] || null }; }));
  if (rec.assignedByEmail) out.push({ key: rec.assignedByEmail, user: users.filter(function (u) { return u.email === rec.assignedByEmail && u.active; })[0] || null });
  return out;
}
function eventsFor_(done, a, users, st) {
  var boss = a.email ? users.filter(function (u) { return u.email === a.email; })[0] : personNamed_(a.name, users);
  var manages = !!boss && boss.active && (boss.role === 'Administrator' || boss.role === 'Project Owner');
  var me = boss ? boss.email : (a.email || '');
  var events = [], skipped = [];
  var add = function (type, user, item, key) {
    if (!user || !user.active || user.email === me) return;
    if (events.some(function (e) { return e.type === type && e.item.id === item.id && e.user.email === user.email; })) return;
    events.push({ type: type, user: user, item: item, key: key });
  };
  done.forEach(function (p) {
    if (!p.next || p.restoreOf || (p.c !== 'tasks' && p.c !== 'projects')) return;
    var isTask = p.c === 'tasks', cur = p.cur, rec = p.next;
    var proj = isTask ? st.projects.filter(function (x) { return x.id === rec.projectId; })[0] : rec;
    var item = itemOf_(isTask ? 'task' : 'project', rec, proj);
    item.by = (boss && boss.name) || a.name || ''; item.byEmail = (boss && boss.email) || a.email || '';
    var before = cur ? owners_(cur, users) : [];
    if (manages) owners_(rec, users).forEach(function (o) {
      if (before.some(function (b) { return b.key === o.key; })) return;
      if (!o.user) { skipped.push({ item: item, name: o.name }); return; }
      add(!isTask ? 'project_assigned' : before.length ? 'task_reassigned' : 'task_assigned', o.user, item, '');
    });
    if (!isTask && manages) (rec.managerEmails || []).forEach(function (m) {
      if (((cur && cur.managerEmails) || []).indexOf(m) >= 0) return;
      add('project_assigned', users.filter(function (u) { return u.email === m; })[0], item, '');
    });
    if (!isTask || !cur) return;
    var reached = cur.status !== rec.status ? rec.status : '';
    if (reached === 'Completed') overseers_(rec, proj, users).forEach(function (o) { add('task_completed', o.user, item, ''); });
    if (reached === 'In Review' || reached === 'Awaiting Approval') overseers_(rec, proj, users).concat(owners_(rec, users)).forEach(function (o) { add('review_requested', o.user, item, ''); });
    if (manages) {
      var had = {}; (cur.notes || []).forEach(function (n) { had[noteKey_(n)] = true; });
      (rec.notes || []).forEach(function (n) {
        if (had[noteKey_(n)] || ['comment', 'question', 'decision'].indexOf(n.type || 'comment') < 0) return;
        var withNote = Object.assign({}, item, { note: String(n.text || '').slice(0, 600) });
        owners_(rec, users).forEach(function (o) { add('manager_comment', o.user, withNote, noteKey_(n)); });
      });
    }
  });
  return { events: events, skipped: skipped };
}
function notifRow_(o) { return NOTIF_COLS.map(function (c) { return o[c] === undefined ? '' : o[c]; }); }
function readNotifs_(limit) {
  var sh = SpreadsheetApp.getActive().getSheetByName(NOTIF_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var n = sh.getLastRow() - 1, take = Math.min(n, limit || DEDUPE_WINDOW), first = n - take + 2;
  return sh.getRange(first, 1, take, NOTIF_COLS.length).getValues().map(function (r, i) {
    var o = { _row: first + i }; NOTIF_COLS.forEach(function (c, j) { o[c] = String(r[j] == null ? '' : r[j]); }); return o;
  });
}
function queue_(events, ts, reqId, actor, batchOf) {
  ensureSystemTabs_();
  var seen = {}; readNotifs_().forEach(function (r) { seen[r.dedupeKey] = true; });
  var mode = emailMode_().mode, off = mode === 'off', rows = [];
  events.forEach(function (ev) {
    // A test email must not use up the real one that going live is meant to send.
    var key = (mode === 'test' ? 'test|' : '') + [ev.type, ev.item.id, ev.user.email, ev.key || reqId].join('|');
    if (seen[key]) return; // this person already has this exact notice
    seen[key] = true;
    var base = { ts: ts, eventType: ev.type, recipientEmail: ev.user.email, recipientName: ev.user.name, taskId: ev.item.kind === 'task' ? ev.item.id : '', projectId: ev.item.projectId, subject: EVENT_TITLE[ev.type] + ': ' + short_(ev.item.name), attempts: 0, actorEmail: ev.item.byEmail || actor.email || '', actorName: ev.item.by || actor.name || '', requestId: reqId };
    rows.push(Object.assign({}, base, { notificationId: 'N-' + Utilities.getUuid(), channel: 'in-app', deliveryStatus: 'created', dedupeKey: 'inapp|' + key }));
    rows.push(Object.assign({}, base, { notificationId: 'N-' + Utilities.getUuid(), channel: 'email', deliveryStatus: off ? 'skipped' : 'queued', errorDetails: off ? 'Emails are turned off' : '', dedupeKey: key, batchId: batchOf(ev) + '|' + mode, payload: JSON.stringify(ev.item), emailMode: mode }));
  });
  if (rows.length) appendRows_(NOTIF_SHEET, rows.map(notifRow_));
  return rows;
}
/** Runs after a save: queue what it caused, try to send it straight away, and report what really happened. */
function notify_(done, a, users, st, ts, reqId) {
  var found = eventsFor_(done, a, users, st), audit = [];
  found.skipped.forEach(function (s) { audit.push(emailAudit_(s.item.kind === 'task' ? s.item.id : '', s.item.projectId, s.item.kind, s.item.id, a.email, a.name, 'email_skipped', s.name, 'No email sent: "' + short_(s.name) + '" is not in the Users tab', ts, reqId)); });
  if (!found.events.length) return { audit: audit, notified: [] };
  var queued = queue_(found.events, ts, reqId, a, function (ev) { return [ev.user.email, EVENT_GROUP[ev.type], reqId].join('|'); });
  var batches = {}; queued.forEach(function (r) { if (r.batchId && r.deliveryStatus === 'queued') batches[r.batchId] = true; });
  audit = audit.concat(deliver_({ batches: batches, limit: SEND_NOW }));
  return { audit: audit, notified: notifiedFor_(reqId, a) };
}
/** Only what this person's own action caused. */
function notifiedFor_(reqId, a) {
  return readNotifs_(600).filter(function (r) { return r.requestId === reqId && (a.open || r.actorEmail === a.email); }).map(function (r) {
    return { channel: r.channel, eventType: r.eventType, recipientEmail: r.recipientEmail, recipientName: r.recipientName, deliveryStatus: r.deliveryStatus, errorDetails: r.errorDetails };
  });
}
function emailAudit_(taskId, projectId, kind, id, actorEmail, actorName, action, value, text, ts, reqId) {
  return [Utilities.getUuid(), ts, actorEmail || '', actorName || '', kind + 's', id, projectId || '', taskId || '', action, 'owner', '', value, text, reqId];
}
/** Sends what is due. Failures wait and try again, then stop at EMAIL_MAX_ATTEMPTS so a bad address cannot retry forever. */
function deliver_(opts) {
  opts = opts || {};
  if (emailMode_().mode === 'off') return []; // queued emails wait, so nothing is lost by turning emails off for a while
  var now = Date.now(), groups = {}, order = [];
  readNotifs_(opts.batches ? 2000 : 1e9).forEach(function (r) {
    if (r.channel !== 'email') return;
    if (r.deliveryStatus !== 'queued' && !(r.deliveryStatus === 'failed' && (!r.nextAttemptAt || Date.parse(r.nextAttemptAt) <= now))) return;
    if (opts.batches && !opts.batches[r.batchId]) return;
    if (r.emailMode === 'live' && emailMode_().mode !== 'live') return; // queued for an employee: it waits until emails are live again
    if (!groups[r.batchId]) { groups[r.batchId] = []; order.push(r.batchId); }
    groups[r.batchId].push(r);
  });
  var audit = [];
  order.slice(0, opts.limit || 40).forEach(function (id) { audit = audit.concat(sendBatch_(groups[id])); });
  return audit;
}
function retryTime_(attempt) { return new Date(Date.now() + RETRY_MINUTES[Math.min(attempt - 1, RETRY_MINUTES.length - 1)] * 60000).toISOString(); }
function sendBatch_(rows) {
  var first = rows[0], ts = new Date().toISOString(), note = '', error = '', quota = false;
  try {
    if (MailApp.getRemainingDailyQuota() < 1) { quota = true; throw new Error('daily email limit reached'); }
    var mail = renderEmail_(rows), to = first.recipientEmail;
    // A row keeps the mode it was queued in, so a test notice never reaches an employee after going live.
    if (first.emailMode !== 'live') {
      var box = testAddress_();
      if (!box) throw new Error('test mode has no address to send to');
      mail.subject = '[TEST for ' + to + '] ' + mail.subject;
      to = box; note = 'Test mode: sent to ' + to + ' instead of the employee';
    }
    var msg = { to: to, subject: mail.subject, body: mail.body, htmlBody: mail.html, name: 'Suraasa Control Tower' };
    if (first.actorEmail) msg.replyTo = first.actorEmail;
    MailApp.sendEmail(msg);
  } catch (err) { error = short_(err && err.message || err); }
  var sh = SpreadsheetApp.getActive().getSheetByName(NOTIF_SHEET), at = NOTIF_COLS.indexOf('deliveryStatus') + 1, audit = [];
  rows.forEach(function (r) {
    // Running out of the daily allowance is not the email's fault, so it costs no attempt.
    var tries = Number(r.attempts || 0) + (quota ? 0 : 1);
    var status = !error ? 'accepted' : tries >= EMAIL_MAX_ATTEMPTS ? 'abandoned' : 'failed';
    var wait = status !== 'failed' ? '' : quota ? new Date(Date.now() + 3600000).toISOString() : retryTime_(tries);
    r.deliveryStatus = status; r.attempts = tries; r.lastAttemptAt = ts; r.nextAttemptAt = wait; r.errorDetails = error || note;
    sh.getRange(r._row, at, 1, 5).setValues([[status, String(tries), ts, wait, r.errorDetails]]);
    var kind = r.taskId ? 'task' : 'project', id = r.taskId || r.projectId, title = EVENT_TITLE[r.eventType] || r.eventType;
    audit.push(emailAudit_(r.taskId, r.projectId, kind, id, r.actorEmail, r.actorName, status === 'accepted' ? 'email_sent' : 'email_failed', r.recipientName, status === 'accepted' ? '"' + title + '" email accepted by the mail service for ' + r.recipientEmail + (note ? ' (' + note + ')' : '') + '. Delivery to the inbox is not confirmed.' : '"' + title + '" email to ' + r.recipientEmail + ' failed: ' + error, ts, r.requestId));
  });
  return audit;
}
function niceDate_(v) {
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v ? String(v) : 'Not set';
  return Number(m[3]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1] + ' ' + m[1];
}
function prioLabel_(p) { return PRIO_WORDS[p] ? PRIO_WORDS[p] + ' (' + p + ')' : (p || 'Not set'); }
/** Plain and HTML versions from the same facts. All values are escaped: task text comes from people. */
function renderEmail_(rows) {
  var all = rows.map(function (r) { var it = JSON.parse(r.payload || '{}'); it.type = r.eventType; return it; });
  var list = all.slice(0, EMAIL_MAX_ITEMS), extra = all.length - list.length; // Google limits the size of one email
  if (all.length > 5) list.forEach(function (i) { i.desc = ''; });
  var one = all.length === 1, first = list[0], who = rows[0].recipientName || 'there', group = EVENT_GROUP[first.type];
  var title = one ? EVENT_TITLE[first.type] : group === 'assign' ? all.length + ' New Items Assigned' : group === 'daily' ? all.length + ' Tasks Need Your Attention' : all.length + ' ' + EVENT_TITLE[first.type];
  var intro = one ? EVENT_INTRO[first.type] : group === 'assign' ? 'These items have been assigned to you.' : group === 'daily' ? 'These tasks are due soon or overdue.' : 'These items need your attention.';
  var byWord = first.type === 'task_completed' ? 'Completed By' : first.type === 'manager_comment' ? 'Comment By' : first.type === 'review_requested' ? 'Requested By' : first.type === 'deadline_reminder' || first.type === 'task_overdue' ? '' : 'Assigned By';
  var facts = function (i) {
    var f = [[i.kind === 'project' ? 'Project' : 'Task', i.name]];
    f.push([i.kind === 'project' ? 'Project ID' : 'Task ID', i.id]);
    if (i.kind !== 'project') f.push(['Project', i.project || 'Not set']);
    f.push(['Priority', prioLabel_(i.priority)]);
    if (byWord) f.push([byWord, i.by || 'Control Tower']);
    f.push(['Deadline', niceDate_(i.due)]);
    if (group === 'daily') f.push(['Reminder', EVENT_TITLE[i.type]]);
    return f;
  };
  var button = function (i) { return i.kind === 'project' ? 'View Project' : 'View Task'; };
  var text = 'Hello ' + who + ',\n\n' + intro + '\n\n' + list.map(function (i) {
    return facts(i).map(function (f) { return f[0] + ': ' + f[1]; }).join('\n') + (i.note ? '\n\nComment:\n' + i.note : '') + (i.desc ? '\n\nDescription:\n' + i.desc : '') + '\n\n' + button(i) + ': ' + itemLink_(i.kind, i.id);
  }).join('\n\n---\n\n') + (extra ? '\n\n...and ' + extra + ' more on your dashboard.' : '') + '\n\nPlease log in to your dashboard to review and update your task.\n\nRegards,\nSuraasa Sales Control Tower';
  var card = function (i) {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;margin:0 0 16px"><tr><td style="padding:16px 20px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + facts(i).map(function (f, n) { return '<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;width:110px;vertical-align:top">' + escHtml_(f[0]) + '</td><td style="padding:4px 0;color:#0f172a;font-size:14px' + (n === 0 ? ';font-weight:600' : '') + '">' + escHtml_(f[1]) + '</td></tr>'; }).join('') + '</table>' +
      (i.note ? '<p style="margin:14px 0 0;color:#64748b;font-size:13px">Comment</p><p style="margin:4px 0 0;color:#0f172a;font-size:14px;white-space:pre-wrap">' + escHtml_(i.note) + '</p>' : '') +
      (i.desc ? '<p style="margin:14px 0 0;color:#64748b;font-size:13px">Description</p><p style="margin:4px 0 0;color:#0f172a;font-size:14px;white-space:pre-wrap">' + escHtml_(i.desc) + '</p>' : '') +
      '<p style="margin:16px 0 2px"><a href="' + escHtml_(itemLink_(i.kind, i.id)) + '" style="display:inline-block;background:#225BA5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px">' + button(i) + '</a></p></td></tr></table>';
  };
  var html = '<div style="background:#f1f5f9;padding:24px 12px;font-family:Inter,Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px"><tr><td style="background:#0f172a;border-radius:10px 10px 0 0;padding:16px 24px;color:#ffffff;font-size:15px;font-weight:600">Suraasa Sales Control Tower</td></tr><tr><td style="padding:24px"><h1 style="margin:0 0 12px;color:#0f172a;font-size:20px">' + escHtml_(title) + '</h1><p style="margin:0 0 6px;color:#0f172a;font-size:14px">Hello ' + escHtml_(who) + ',</p><p style="margin:0 0 18px;color:#334155;font-size:14px">' + escHtml_(intro) + '</p>' + list.map(card).join('') + (extra ? '<p style="margin:0 0 12px;color:#334155;font-size:14px">And ' + extra + ' more on your dashboard.</p>' : '') + '<p style="margin:8px 0 0;color:#334155;font-size:14px">Please log in to your dashboard to review and update your task.</p><p style="margin:16px 0 0;color:#334155;font-size:14px">Regards,<br>Suraasa Sales Control Tower</p></td></tr></table></div>';
  return { subject: title + ' - ' + APP, body: text, html: html };
}
function escHtml_(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

/** Daily: 3 days, 1 day and the day itself; overdue on the first day and then weekly. One email per person per day. */
function reminders_(st, today, ts) {
  if (emailMode_().mode === 'off') return [];
  var users = users_(), events = [];
  var days = function (d) { var m = d.split('-'); return Math.round(Date.UTC(Number(m[0]), Number(m[1]) - 1, Number(m[2])) / 86400000); };
  var live = {}; st.projects.forEach(function (p) { if (!p.archivedAt) live[p.id] = p; });
  st.tasks.forEach(function (t) {
    if (!live[t.projectId] || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.due)) || ['Completed', 'Cancelled'].indexOf(t.status) >= 0) return;
    var left = days(t.due) - days(today), type = '', key = '';
    if (left < 0) { type = 'task_overdue'; key = t.due + ':' + Math.floor((-left - 1) / 7); }
    else if (left === 0 || left === 1 || left === 3) { type = 'deadline_reminder'; key = t.due + ':' + left; }
    if (!type) return;
    owners_(t, users).forEach(function (o) { if (o.user) events.push({ type: type, user: o.user, item: itemOf_('task', t, live[t.projectId]), key: key }); });
  });
  if (!events.length) return [];
  var reqId = 'daily-' + today;
  queue_(events, ts, reqId, { email: '', name: 'Control Tower' }, function (ev) { return ev.user.email + '|daily|' + today; });
  return deliver_({ limit: 40 });
}
/** Every 5 minutes: sends anything still queued and retries failures. */
function processNotifications() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: true, busy: true };
  try {
    ensureSystemTabs_();
    var audit = deliver_({ limit: 40 });
    appendRows_(AUDIT_SHEET, audit);
    return { ok: true, handled: audit.length };
  } finally { lock.releaseLock(); }
}
var seesLog_ = function (a) { return a.role === 'Administrator' || a.role === 'Project Owner'; };
/** Super Admins see everything. Managers see notices for the projects they manage. The stored message body is never sent out. */
function notificationLog_(a) {
  if (!seesLog_(a)) return { ok: false, code: 'denied', error: 'Only Super Admins and Managers can see the notification log.' };
  var projects = pull_().state.projects, mine = {};
  projects.forEach(function (p) { if (a.role === 'Administrator' || ownsProject_(p, a)) mine[p.id] = true; });
  var rows = readNotifs_(800).filter(function (r) { return a.role === 'Administrator' || mine[r.projectId]; }).reverse().slice(0, 400).map(function (r) {
    return { notificationId: r.notificationId, ts: r.ts, channel: r.channel, eventType: r.eventType, recipientEmail: r.recipientEmail, recipientName: r.recipientName, taskId: r.taskId, projectId: r.projectId, subject: r.subject, deliveryStatus: r.deliveryStatus, attempts: r.attempts, nextAttemptAt: r.nextAttemptAt, errorDetails: r.errorDetails };
  });
  return { ok: true, rows: rows };
}
function notificationRetry_(body, a) {
  if (a.role !== 'Administrator') return { ok: false, code: 'denied', error: 'Only a Super Admin can retry emails.' };
  var sh = SpreadsheetApp.getActive().getSheetByName(NOTIF_SHEET), at = NOTIF_COLS.indexOf('deliveryStatus') + 1, batches = {}, n = 0;
  readNotifs_(1e9).forEach(function (r) {
    if (r.channel !== 'email' || (r.deliveryStatus !== 'failed' && r.deliveryStatus !== 'abandoned')) return;
    if (body.id && r.notificationId !== body.id) return;
    sh.getRange(r._row, at, 1, 5).setValues([['queued', '0', r.lastAttemptAt, '', r.errorDetails]]);
    batches[r.batchId] = true; n++;
  });
  appendRows_(AUDIT_SHEET, deliver_({ batches: batches, limit: 40 }));
  return { ok: true, requeued: n };
}
function notificationResend_(body, a) {
  if (a.role !== 'Administrator') return { ok: false, code: 'denied', error: 'Only a Super Admin can resend emails.' };
  var r = readNotifs_(1e9).filter(function (x) { return x.notificationId === body.id && x.channel === 'email'; })[0];
  if (!r) return { ok: false, code: 'missing', error: 'That notification was not found.' };
  var id = 'N-' + Utilities.getUuid(), ts = new Date().toISOString(), req = 'resend-' + id;
  var copy = Object.assign({}, r, { notificationId: id, ts: ts, deliveryStatus: 'queued', attempts: 0, lastAttemptAt: '', nextAttemptAt: '', errorDetails: 'Resent by ' + (a.name || a.email), dedupeKey: req, batchId: req, requestId: req, emailMode: emailMode_().mode === 'live' ? 'live' : 'test' });
  appendRows_(NOTIF_SHEET, [notifRow_(copy)]);
  var batches = {}; batches[req] = true;
  appendRows_(AUDIT_SHEET, deliver_({ batches: batches, limit: 1 }));
  return { ok: true, notified: readNotifs_(50).filter(function (x) { return x.requestId === req; }).map(function (x) { return { deliveryStatus: x.deliveryStatus, errorDetails: x.errorDetails }; }) };
}
/** Health of every moving part, for the Integrations screen. Holds no secrets. */
function integrationStatus_(a) {
  if (a.role !== 'Administrator') return { ok: false, code: 'denied', error: 'Only a Super Admin can see this.' };
  ensureSystemTabs_();
  var cfg = authCfg_(), m = metaMap_(), mode = emailMode_(), users = users_(), count = {}, lastAccepted = '';
  readNotifs_(1e9).forEach(function (r) { if (r.channel !== 'email') return; count[r.deliveryStatus] = (count[r.deliveryStatus] || 0) + 1; if (r.deliveryStatus === 'accepted' && r.lastAttemptAt > lastAccepted) lastAccepted = r.lastAttemptAt; });
  var triggers = [];
  try { triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (x) { /* reported as not running */ }
  var quota = 0;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (x) { /* shown as 0 */ }
  var sender = '';
  try { sender = Session.getEffectiveUser().getEmail(); } catch (x) { /* some account types hide this */ }
  var tabs = SCHEMA.map(function (s) { return checkHeader_(SpreadsheetApp.getActive(), s); }).filter(Boolean);
  return { ok: true, api: API, sheet: { name: SpreadsheetApp.getActive().getName(), version: parseInt(m.version, 10) || 0, updatedAt: m.updatedAt || '', updatedBy: m.updatedBy || '', problems: tabs },
    auth: { required: cfg.required, clientIdSet: !!cfg.clientId, domain: cfg.domain },
    email: { mode: mode.mode, testTo: mode.to || '', sender: sender, quota: quota, queued: count.queued || 0, accepted: count.accepted || 0, failed: count.failed || 0, abandoned: count.abandoned || 0, lastAcceptedAt: lastAccepted },
    automation: { backup: triggers.indexOf('backupNow') >= 0, daily: triggers.indexOf('dailyChecks') >= 0, retry: triggers.indexOf('processNotifications') >= 0 },
    directory: { total: users.length, active: users.filter(function (u) { return u.active; }).length, admins: users.filter(function (u) { return u.active && u.role === 'Administrator'; }).length } };
}
function testEmail_(a) {
  if (a.role !== 'Administrator') return { ok: false, code: 'denied', error: 'Only a Super Admin can send a test email.' };
  if (!a.email) return { ok: false, error: 'Sign in with Google to send a test email.' };
  var ts = new Date().toISOString(), row = { notificationId: 'N-' + Utilities.getUuid(), ts: ts, channel: 'email', eventType: 'test_email', recipientEmail: a.email, recipientName: a.name, subject: 'Control Tower test email', attempts: 1, lastAttemptAt: ts, dedupeKey: 'test|' + ts, batchId: 'test|' + ts, actorEmail: a.email, actorName: a.name, requestId: 'test|' + ts };
  try {
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('daily email limit reached');
    MailApp.sendEmail({ to: a.email, subject: 'Control Tower test email', body: 'Emails can be sent from this script.', name: 'Suraasa Control Tower' }); // only ever to the person pressing the button
    row.deliveryStatus = 'accepted';
  } catch (err) { row.deliveryStatus = 'failed'; row.errorDetails = short_(err && err.message || err); }
  appendRows_(NOTIF_SHEET, [notifRow_(row)]);
  return { ok: row.deliveryStatus === 'accepted', deliveryStatus: row.deliveryStatus, recipientEmail: a.email, error: row.errorDetails || '' };
}
/** Fills in ownerEmail on older tasks and projects from exact, unique name matches. Sends nothing. Safe to run twice. */
function backfillOwnerEmails() {
  var ss = SpreadsheetApp.getActive(), users = users_(), ts = new Date().toISOString(), req = 'match-' + Utilities.getUuid(), audit = [];
  SCHEMA.filter(function (s) { return s.key === 'tasks' || s.key === 'projects'; }).forEach(function (s) {
    var sh = ss.getSheetByName(s.tab), cols = allCols_(s);
    if (!sh || sh.getLastRow() < 2) return;
    var oc = cols.indexOf('owner'), ec = cols.indexOf('ownerEmail'), ic = cols.indexOf('id');
    sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().forEach(function (r, i) {
      if (String(r[ec]).trim()) return;
      var names = ownerNames_(r[oc]), hits = names.map(function (n) { return personNamed_(n, users); });
      if (!names.length || hits.some(function (u) { return !u; })) return;
      var value = hits.map(function (u) { return u.email; }).join(', ');
      sh.getRange(i + 2, ec + 1).setNumberFormat('@').setValue(value);
      audit.push([Utilities.getUuid(), ts, '', 'System', s.key, String(r[ic]), s.key === 'tasks' ? String(r[cols.indexOf('projectId')]) : String(r[ic]), s.key === 'tasks' ? String(r[ic]) : '', 'owner_email_matched', 'ownerEmail', '', value, 'Matched "' + short_(r[oc]) + '" to ' + value, req]);
    });
  });
  if (audit.length) { appendRows_(AUDIT_SHEET, audit); bumpVersion_('Owner emails matched'); }
  return audit.length;
}
function backfillOwnerEmailsMenu() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var n = 0;
  try { n = backfillOwnerEmails(); } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert(n + ' tasks and projects were matched to a registered email. No emails were sent.');
}
function sendTestEmail() {
  var me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: me, subject: 'Control Tower test email', body: 'Emails can be sent from this account.', name: 'Suraasa Control Tower' });
  SpreadsheetApp.getUi().alert('A test email was sent to ' + me + '. Emails left today: ' + MailApp.getRemainingDailyQuota());
}
function emailTestMode() { props_().setProperties({ ASSIGN_EMAIL: 'on', EMAIL_MODE: 'test' }); SpreadsheetApp.getUi().alert('Test mode: every email now goes to ' + Session.getEffectiveUser().getEmail() + ', with the intended person named in the subject.'); }
function emailGoLive() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Go live?', 'Employees will start receiving emails. The first morning, each person with overdue work gets one summary email.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  props_().setProperties({ ASSIGN_EMAIL: 'on', EMAIL_MODE: 'live' });
  ui.alert('Emails are live.');
}
function turnOffAssignmentEmails() { props_().setProperty('ASSIGN_EMAIL', 'off'); SpreadsheetApp.getUi().alert('Emails are off. Notices are still logged in NotificationLog.'); }

// ---------- one-off: AK and Ankit Khanna are the same person ----------
var ANKIT = 'Ankit Khanna';
/** Sentences that set the two against each other lose the comparison; every other AK becomes the full name. */
function ankitText_(v) {
  if (!/\bAK\b/.test(v)) return v;
  var A = 'Ankit(?: Khanna)?';
  return v
    .replace(new RegExp('\\s+between AK and ' + A, 'g'), '')
    .replace(new RegExp('\\s*\\(AK vs\\.? ' + A + '\\)', 'g'), '')
    .replace(new RegExp('Confirm AK vs\\.? ' + A, 'g'), 'Confirm with ' + ANKIT)
    .replace(/\bOnly AK and Ankit Khanna are\b/g, 'Only ' + ANKIT + ' is')
    .replace(new RegExp('(?:TBD\\s*[\u2014-]\\s*)?AK\\s*(?:or|/)\\s*' + A + '\\s*\\(confirm\\)', 'g'), ANKIT)
    .replace(new RegExp('\\bAK\\s*(?:,|/|&|and\\b|or\\b|vs\\b\\.?)\\s*' + A + '\\b', 'g'), ANKIT)
    .replace(new RegExp('\\b' + A + '\\s*(?:,|/|&|and\\b|or\\b)\\s*AK\\b', 'g'), ANKIT)
    .replace(/\bAK\b/g, ANKIT);
}
function ankitList_(v, sep) {
  var seen = {};
  return v.split(sep).filter(function (x) { var k = x.trim().toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).join(sep);
}
function ankitDeep_(o) {
  if (typeof o === 'string') return ankitText_(o);
  if (Array.isArray(o)) {
    var seen = {};
    return o.map(ankitDeep_).filter(function (x) { if (typeof x !== 'string') return true; if (seen[x]) return false; seen[x] = 1; return true; });
  }
  if (o && typeof o === 'object') { var r = {}; Object.keys(o).forEach(function (k) { r[k] = ankitDeep_(o[k]); }); return r; }
  return o;
}
function ankitCell_(s, col, v) {
  if (typeof v !== 'string' || !/\bAK\b/.test(v)) return v;
  if (col === EXTRA) { try { return JSON.stringify(ankitDeep_(JSON.parse(v))); } catch (x) { return ankitText_(v); } }
  var sep = s.lists && s.lists[col] || (/owner|accountable|responsible/i.test(col) ? ', ' : '');
  return sep ? ankitList_(ankitText_(v), sep) : ankitText_(v);
}
/** Changes only cells that mention AK, writes each old value to AuditLog, and sends no emails. Safe to run twice. */
function replaceAkWithAnkitKhanna() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var count = 0;
  try {
    var ss = SpreadsheetApp.getActive(), ts = new Date().toISOString(), req = 'ak-' + Utilities.getUuid(), audit = [];
    var log = function (key, id, projectId, field, was, now) {
      audit.push([Utilities.getUuid(), ts, '', 'Sheet owner', key, id, projectId, '', 'name_merged', field, was, now, 'AK replaced with ' + ANKIT, req]);
      count++;
    };
    // Roles: one person, one row. Anything only AK's row said moves to Ankit Khanna's.
    var roles = SCHEMA.filter(function (s) { return s.key === 'roles'; })[0], rs = ss.getSheetByName(roles.tab);
    if (rs && rs.getLastRow() >= 2) {
      var rv = rs.getRange(2, 1, rs.getLastRow() - 1, roles.cols.length).getValues();
      var ai = -1, bi = -1, nc = roles.cols.indexOf('note');
      rv.forEach(function (r, i) { if (String(r[0]).trim() === 'AK') ai = i; if (String(r[0]).trim() === ANKIT) bi = i; });
      if (ai >= 0 && bi >= 0) {
        var an = String(rv[ai][nc] || ''), bn = String(rv[bi][nc] || ''), stem = bn.replace(/[.\s]+$/, '');
        var note = !an ? bn : an.indexOf(stem) === 0 ? an : bn.indexOf(an.replace(/[.\s]+$/, '')) >= 0 ? bn : stem + '; ' + an;
        if (note !== bn) { rs.getRange(bi + 2, nc + 1).setValue(note); log('roles', ANKIT, '', 'note', bn, note); }
        log('roles', 'AK', '', 'name', 'AK', '');
        deleteSheetRow_(rs, ai + 2);
      }
    }
    SCHEMA.forEach(function (s) {
      var sh = ss.getSheetByName(s.tab);
      if (!sh || sh.getLastRow() < 2) return;
      var cols = s.cols.concat([EXTRA]), idCol = s.id ? s.cols.indexOf(s.id) : 0, pCol = s.cols.indexOf('projectId');
      sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().forEach(function (r, i) {
        cols.forEach(function (c, j) {
          if (j === idCol && s.id) return;
          var next = ankitCell_(s, c, r[j]);
          if (next === r[j]) return;
          sh.getRange(i + 2, j + 1).setValue(next);
          log(s.key, String(r[idCol]), pCol >= 0 ? String(r[pCol]) : '', c, short_(r[j]), short_(next));
        });
      });
    });
    var m = metaMap_(), blob = {};
    ['governance', 'meta'].forEach(function (k) {
      if (!m[k] || !/\bAK\b/.test(m[k])) return;
      try { blob[k] = JSON.stringify(ankitDeep_(JSON.parse(m[k]))); log(k, k, '', k, '', 'updated'); } catch (x) {}
    });
    if (Object.keys(blob).length) metaSet_(blob);
    if (count) { appendRows_(AUDIT_SHEET, audit); bumpVersion_('AK replaced with ' + ANKIT); }
  } finally { lock.releaseLock(); }
  try { SpreadsheetApp.getUi().alert(count ? count + ' places changed from AK to ' + ANKIT + '. Each old value is in the AuditLog tab.' : 'Nothing to change: AK is not in the data.'); } catch (x) {}
  return count;
}

// ---------- history of progress ----------
function snapshot_(body, a) {
  var mine = null;
  if (a.role !== 'Administrator') { mine = {}; pull_().state.projects.forEach(function (p) { if (ownsProject_(p, a)) mine[p.id] = true; }); }
  var rows = (body.rows || []).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) && r.projectId && (!mine || mine[r.projectId]); });
  if (!rows.length) return { ok: true, added: 0 };
  var have = {}; readTable_(SNAP_SHEET, SNAP_COLS).forEach(function (r) { have[r.date + '|' + r.projectId] = true; });
  var fresh = rows.filter(function (r) { return !have[r.date + '|' + r.projectId]; }).map(function (r) { return SNAP_COLS.map(function (c) { return String(r[c] == null ? '' : r[c]); }); });
  appendRows_(SNAP_SHEET, fresh);
  return { ok: true, added: fresh.length };
}

// ---------- administrator tools in the Sheet menu ----------
function enableSignIn() {
  var ui = SpreadsheetApp.getUi();
  var c = ui.prompt('Google OAuth client ID', 'Paste the Web client ID from Google Cloud (it ends in .apps.googleusercontent.com).', ui.ButtonSet.OK_CANCEL);
  if (c.getSelectedButton() !== ui.Button.OK) return;
  var id = c.getResponseText().trim();
  if (!/\.apps\.googleusercontent\.com$/.test(id)) { ui.alert('That does not look like a Web client ID.'); return; }
  ensureSystemTabs_();
  var admins = users_().filter(function (u) { return u.active && u.role === 'Administrator'; });
  if (!admins.length) { ui.alert('Add at least one active Super Admin to the Users tab first, then run this again.'); return; }
  props_().setProperties({ AUTH_CLIENT_ID: id, AUTH_REQUIRED: 'true', AUTH_OFF_UNTIL: '0' });
  ui.alert('Google sign-in is ready. Only people listed in the Users tab can open the site.');
}
/** For a lockout that fixing the Users tab cannot solve. Anyone with the link can read and change data until it ends. */
function disableSignIn() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Open access for one hour?', 'Until it ends, anyone with the web app link can read and change all the data. Normally you should fix the Users tab instead.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  props_().setProperties({ AUTH_REQUIRED: 'false', AUTH_OFF_UNTIL: String(Date.now() + 3600000) });
  ui.alert('Access is open for one hour. Sign-in returns by itself after that.');
}
function backupNow() {
  var ss = SpreadsheetApp.getActive();
  var file = DriveApp.getFileById(ss.getId());
  var name = 'Backup ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH-mm') + ' ' + ss.getName();
  var it = file.getParents();
  var copy = it.hasNext() ? file.makeCopy(name, it.next()) : file.makeCopy(name);
  return copy.getId();
}
function turnOnDailyBackup() {
  ScriptApp.getProjectTriggers().filter(function (t) { return ['backupNow', 'dailyChecks', 'processNotifications'].indexOf(t.getHandlerFunction()) >= 0; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('dailyChecks').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('processNotifications').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert('Done. A copy of this Sheet is saved every night, late work and reminders are checked each morning, and unsent emails are retried every 5 minutes.');
}

/**
 * Records each task and milestone once when it becomes late, in the Sheet's
 * time zone. Running twice in a day, or re-running after a failure, adds nothing new.
 */
function dailyChecks() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSystemTabs_();
    var ss = SpreadsheetApp.getActive();
    var today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    var ts = new Date().toISOString();
    var st = pull_().state;
    var seen = {};
    readTable_(AUDIT_SHEET, AUDIT_COLS).forEach(function (r) { if (r.action === 'task_overdue' || r.action === 'milestone_overdue') seen[r.entityId + '|' + r.newValue] = true; });
    var rows = [];
    var add = function (type, id, projectId, taskId, action, due, label) {
      if (seen[id + '|' + due]) return;
      rows.push(AUDIT_COLS.map(function (c) {
        return ({ activityId: Utilities.getUuid(), ts: ts, actorEmail: '', actorName: 'System', entityType: type, entityId: id, projectId: projectId, taskId: taskId, action: action, field: 'due', oldValue: '', newValue: due, text: label + ' is past its date of ' + due, requestId: 'daily-' + today })[c];
      }));
    };
    var live = {}; st.projects.forEach(function (p) { if (!p.archivedAt) live[p.id] = p; });
    st.tasks.forEach(function (t) {
      if (live[t.projectId] && t.due && t.due < today && ['Completed', 'Cancelled'].indexOf(t.status) < 0) add('tasks', t.id, t.projectId, t.id, 'task_overdue', t.due, '"' + t.name + '"');
    });
    st.projects.forEach(function (p) {
      if (!live[p.id]) return;
      (p.milestones || []).forEach(function (m) { if (m.due && m.due < today && m.status !== 'Completed') add('milestones', m.id, p.id, '', 'milestone_overdue', m.due, 'Milestone "' + m.name + '"'); });
    });
    var sent = reminders_(st, today, ts);
    rows = rows.concat(sent);
    if (rows.length) { appendRows_(AUDIT_SHEET, rows); bumpVersion_('System'); }
    return { ok: true, added: rows.length };
  } finally { lock.releaseLock(); }
}
