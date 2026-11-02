/**
 * ============================================================
 *  Suraasa Sales Control Tower: Google Sheet backend (API 3)
 * ============================================================
 *  Paste this whole file over Code.gs in the Sheet's Apps Script
 *  editor, run setupSheet once, then Deploy > Manage deployments >
 *  Edit > New version. The /exec URL stays the same.
 *
 *  It is built on the version already running, so every existing
 *  tab and column stays as it is. It adds four tabs: Users,
 *  AuditLog, Trash and Snapshots. Sign-in stays off until an
 *  administrator turns it on from the Control Tower menu.
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
var API = 3;

var STATUS_P = ['Not Started', 'In Progress', 'On Hold', 'Blocked', 'Completed'];
var STATUS_T = ['Backlog', 'Not Started', 'In Progress', 'Blocked', 'On Hold', 'In Review', 'Awaiting Approval', 'Changes Requested', 'Completed', 'Cancelled'];
var PRIOS = ['P0', 'P1', 'P2', 'P3'];
var HML = ['High', 'Medium', 'Low'];

/**
 * One entry per tab. `cols` is the column order; `lists` are array
 * fields with their separator; `bools`/`nums` get type coercion;
 * `drop` adds a dropdown validation on that column; `prefix` is used to
 * auto-generate IDs for rows whose ID cell is blank.
 */
var SCHEMA = [
  { tab: 'Projects', key: 'projects', id: 'id', prefix: 'PRJ', width: 220,
    cols: ['id', 'name', 'category', 'type', 'program', 'valueClass', 'priority', 'priorityProposed', 'status', 'owner', 'accountable', 'sponsor', 'start', 'due', 'datesProposed', 'objective', 'problem', 'outcome', 'impact', 'metrics', 'dependencies', 'risks', 'assumptions', 'hypothesis', 'successCriteria', 'testPeriod', 'baseline', 'cadence', 'nextAction', 'priorityRationale', 'flags', 'clarification', 'parent', 'completedAt'],
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
    drop: { status: ['Open', 'Pending AK/Ankit decision', 'Decided', 'Deferred', 'Closed', 'Escalated'] } },
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

// ------------------------------------------------------------
//  Menu + setup
// ------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Control Tower')
    .addItem('Set up / repair tabs', 'setupSheet')
    .addItem('Bump version (force website refresh)', 'bumpVersionMenu')
    .addItem('Show sync status', 'showStatus')
    .addSeparator()
    .addItem('Turn on sign-in', 'enableSignIn')
    .addItem('Turn off sign-in', 'disableSignIn')
    .addItem('Back up this Sheet now', 'backupNow')
    .addItem('Turn on daily backup', 'turnOnDailyBackup')
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActive();
  SCHEMA.forEach(function (s) {
    var sh = ss.getSheetByName(s.tab) || ss.insertSheet(s.tab);
    var cols = s.cols.concat([EXTRA]);
    var existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    var sameHeader = existing.length >= cols.length && cols.every(function (c, i) { return existing[i] === c; });
    if (!sameHeader) {
      if (sh.getLastRow() > 0 && existing.join('') !== '') {
        // header exists but differs — migrate data by column name
        migrateColumns_(sh, existing, cols);
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
  // remove the default empty "Sheet1" if present and empty
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  // put Projects first
  ss.setActiveSheet(ss.getSheetByName('Projects')); ss.moveActiveSheet(1);
  try { SpreadsheetApp.getUi().alert('Control Tower sheet is ready.\n\nNext: Deploy → New deployment → Web app (Execute as Me, access Anyone), then paste the /exec URL into the website under Data & settings → Google Sheet sync.'); } catch (e) {}
}

function migrateColumns_(sh, oldCols, newCols) {
  var n = sh.getLastRow();
  var data = n > 1 ? sh.getRange(2, 1, n - 1, oldCols.length).getValues() : [];
  // Columns someone added by hand move to the right. They are never dropped.
  var all = newCols.concat(oldCols.filter(function (c) { return c !== '' && newCols.indexOf(c) < 0; }));
  var out = data.map(function (row) { return all.map(function (c) { var i = oldCols.indexOf(c); return i >= 0 ? row[i] : ''; }); });
  sh.getRange(1, 1, 1, all.length).setValues([all]);
  if (out.length) { sh.getRange(2, 1, out.length, all.length).setValues(out); }
  if (oldCols.length > all.length) sh.getRange(1, all.length + 1, n, oldCols.length - all.length).clearContent();
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
  if (!SCHEMA.some(function (s) { return s.tab === name; })) return;
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
    if (action === 'ping') return json_({ ok: true, app: APP, api: API, version: getVersion_(), auth: pub });
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
  if (a.role === 'Administrator') {
    res.state.users = users_();
    res.state.trash = readTable_(TRASH_SHEET, TRASH_COLS).filter(function (t) { return !t.restoredAt; }).slice(-200).reverse().map(function (t) {
      return { trashId: t.trashId, ts: t.ts, actorName: t.actorName, collection: t.collection, recordId: t.recordId, record: t.record + t.record2 + t.record3 + t.record4, restoredAt: t.restoredAt };
    });
  }
  res.me = { name: a.name || '', email: a.email || '', role: a.role };
  res.auth = { required: authCfg_().required };
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
    var a = actor_(body);
    if (!a) return json_(authError_());
    lock.waitLock(25000); locked = true;
    if (action === 'pull') return json_(fullPull_(a));
    if (action === 'apply') { var applied = apply_(body, a); SpreadsheetApp.flush(); return json_(applied); }
    if (action === 'snapshot') return json_(a.role === 'Viewer' ? { ok: true, added: 0 } : snapshot_(body, a));
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
  if (s.id) data.forEach(function (r) { var v = r[header.indexOf(s.id)]; if (v !== '' && v != null) usedIds[String(v)] = true; });
  data.forEach(function (r, ri) {
    if (r.every(function (v) { return v === '' || v == null; })) return; // blank row
    var o = {};
    header.forEach(function (h, i) {
      if (!h) return;
      var v = r[i];
      if (h === EXTRA) { if (v) { try { var ex = JSON.parse(v); Object.keys(ex).forEach(function (k) { o[k] = ex[k]; }); } catch (x) {} } return; }
      if (s.lists && s.lists[h] !== undefined) { o[h] = splitList_(v); return; }
      if (s.bools && s.bools.indexOf(h) >= 0) { o[h] = toBool_(v); return; }
      if (s.nums && s.nums.indexOf(h) >= 0) { var n = parseFloat(v); o[h] = isNaN(n) ? 0 : n; return; }
      o[h] = cell_(v);
    });
    // required-ish defaults so the website never sees undefined where it expects a string
    s.cols.forEach(function (c) { if (o[c] === undefined) o[c] = (s.lists && s.lists[c] !== undefined) ? [] : (s.bools && s.bools.indexOf(c) >= 0) ? false : (s.nums && s.nums.indexOf(c) >= 0) ? 0 : ''; });
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
  var cols = s.cols.concat([EXTRA]);
  var lastCol = sh.getLastColumn();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (header.slice(0, cols.length).join('\u0001') !== cols.join('\u0001')) { sh.getRange(1, 1, 1, cols.length).setValues([cols]); header = cols; if (lastCol > cols.length) sh.getRange(1, cols.length + 1, 1, lastCol - cols.length).clearContent(); }
  clearData_(sh, cols.length);
  if (!rows.length) return;
  var known = {}; s.cols.forEach(function (c) { known[c] = true; });
  var values = rows.map(function (o) {
    var extra = {};
    Object.keys(o).forEach(function (k) { if (!known[k] && k !== 'workstreams' && k !== 'milestones' && k !== 'raci' && k !== 'comments') extra[k] = o[k]; });
    return s.cols.map(function (c) {
      var v = o[c];
      if (s.lists && s.lists[c] !== undefined) return Array.isArray(v) ? v.join(s.lists[c]) : (v == null ? '' : String(v));
      if (s.bools && s.bools.indexOf(c) >= 0) return v === false || v === 'false' ? 'FALSE' : (v === true || v === 'true' ? 'TRUE' : (v == null || v === '' ? '' : String(v)));
      if (s.nums && s.nums.indexOf(c) >= 0) return v == null || v === '' ? 0 : Number(v);
      if (v == null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }).concat([Object.keys(extra).length ? JSON.stringify(extra) : '']);
  });
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
  // Accept dates typed as dd/mm/yyyy or dd-mm-yyyy and normalise to yyyy-mm-dd
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}
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
var USERS_SHEET = 'Users', AUDIT_SHEET = 'AuditLog', TRASH_SHEET = 'Trash', SNAP_SHEET = 'Snapshots';
var ROLES = ['Administrator', 'Project Owner', 'Task Owner', 'Viewer'];
var USER_COLS = ['email', 'name', 'role', 'active', 'addedBy', 'addedAt'];
var AUDIT_COLS = ['activityId', 'ts', 'actorEmail', 'actorName', 'entityType', 'entityId', 'projectId', 'taskId', 'action', 'field', 'oldValue', 'newValue', 'text', 'requestId'];
var TRASH_COLS = ['trashId', 'ts', 'actorName', 'collection', 'recordId', 'record', 'restoredAt', 'record2', 'record3', 'record4'];
var CELL_MAX = 49000; // Sheets refuses a cell over 50,000 characters
var SNAP_COLS = ['date', 'projectId', 'progress', 'done', 'active', 'overdue', 'blocked', 'health'];
var NESTED = ['workstreams', 'milestones', 'raci', 'comments'];
var APPEND_ONLY = ['comments', 'notes'];
var STAMPS = ['updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'originalDue'];
var TRANSITIONS = {
  'Backlog': ['Not Started', 'In Progress', 'Cancelled'],
  'Not Started': ['Backlog', 'In Progress', 'Blocked', 'On Hold', 'Completed', 'Cancelled'],
  'In Progress': ['Not Started', 'Blocked', 'On Hold', 'In Review', 'Completed', 'Cancelled'],
  'Blocked': ['Not Started', 'In Progress', 'On Hold', 'Cancelled'],
  'On Hold': ['Not Started', 'In Progress', 'Blocked', 'Cancelled'],
  'In Review': ['In Progress', 'Changes Requested', 'Completed', 'Cancelled'],
  'Awaiting Approval': ['In Progress', 'In Review', 'Changes Requested', 'Completed', 'Cancelled'],
  'Changes Requested': ['In Progress', 'In Review', 'Blocked', 'Cancelled'],
  'Completed': ['In Progress', 'Not Started', 'In Review', 'Awaiting Approval'],
  'Cancelled': ['Not Started']
};
// Fields a task owner may change on their own task. Scope, owner and dates stay with the project owner.
var TASK_OWNER_FIELDS = ['status', 'progress', 'notes', 'checklist', 'blocker', 'completedAt', 'latestUpdate', 'attachments', 'cancelReason', 'review', 'extensionRequest', 'actualEffort'];

function props_() { return PropertiesService.getScriptProperties(); }
function authCfg_() {
  var p = props_();
  return { required: p.getProperty('AUTH_REQUIRED') === 'true', clientId: p.getProperty('AUTH_CLIENT_ID') || '', domain: p.getProperty('AUTH_DOMAIN') || 'suraasa.com' };
}

function ensureSystemTabs_() {
  var ss = SpreadsheetApp.getActive();
  [[USERS_SHEET, USER_COLS], [AUDIT_SHEET, AUDIT_COLS], [TRASH_SHEET, TRASH_COLS], [SNAP_SHEET, SNAP_COLS]].forEach(function (t) {
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
}

// ---------- users and sessions ----------
function users_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, USER_COLS.length).getValues().filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return { email: String(r[0]).trim().toLowerCase(), name: String(r[1]).trim(), role: ROLES.indexOf(String(r[2])) >= 0 ? String(r[2]) : 'Viewer', active: toBool_(r[3]), addedBy: String(r[4] || ''), addedAt: String(r[5] || '') };
  });
}
function userByEmail_(email) {
  email = String(email || '').toLowerCase();
  return users_().filter(function (u) { return u.email === email; })[0] || null;
}
function login_(body) {
  var cfg = authCfg_();
  if (!cfg.required) return { ok: true, open: true };
  if (!body.idToken) return { ok: false, auth: true, error: 'Sign in with your Suraasa Google account.' };
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(body.idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, auth: true, error: 'Google could not confirm this sign-in. Try again.' };
  var t = JSON.parse(res.getContentText());
  var email = String(t.email || '').toLowerCase();
  if (t.aud !== cfg.clientId) return { ok: false, auth: true, error: 'This sign-in was issued for a different app.' };
  if (String(t.email_verified) !== 'true') return { ok: false, auth: true, error: 'This Google account is not verified.' };
  if (email.split('@')[1] !== cfg.domain) return { ok: false, auth: true, error: 'Use your @' + cfg.domain + ' account.' };
  if (Number(t.exp || 0) * 1000 < Date.now()) return { ok: false, auth: true, error: 'This sign-in expired. Try again.' };
  var u = userByEmail_(email);
  if (!u || !u.active) return { ok: false, auth: true, denied: true, error: 'Your account has no access yet. Ask an administrator to add ' + email + '.' };
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess:' + token, email, 21600);
  return { ok: true, session: token, user: publicUser_(u) };
}
function publicUser_(u) { return { email: u.email, name: u.name, role: u.role }; }
/** Returns who is calling. Role is read fresh on every request, so a role change applies at once. */
function actor_(body) {
  var cfg = authCfg_();
  if (!cfg.required) return { open: true, email: '', name: String(body.actorName || 'Website').slice(0, 80), role: 'Administrator' };
  if (!body.session) return null;
  var email = CacheService.getScriptCache().get('sess:' + body.session);
  if (!email) return null;
  var u = userByEmail_(email);
  return u && u.active ? publicUser_(u) : null;
}
function authError_() { return { ok: false, auth: true, error: 'Your session has ended. Sign in again.' }; }

// ---------- what a person may see and do ----------
/** True only for a confirmed name. "TBD — proposed: AK" gives AK no rights, and "AK" never matches "Mak". */
function isMine_(field, name) {
  if (!name || /^\s*tbd/i.test(String(field || ''))) return false;
  return String(field || '').split(/\s*[,\/&]\s*|\s+or\s+/i).some(function (x) { return x.trim().toLowerCase() === String(name).trim().toLowerCase(); });
}
function ownsProject_(p, a) { return !!p && (isMine_(p.owner, a.name) || isMine_(p.accountable, a.name)); }
function canSeeProject_(p, tasks, a) {
  if (a.role === 'Administrator' || !p.restricted) return true;
  if (ownsProject_(p, a) || isMine_(p.sponsor, a.name)) return true;
  if ((p.members || []).some(function (m) { return isMine_(m, a.name); })) return true;
  return tasks.some(function (t) { return t.projectId === p.id && isMine_(t.owner, a.name); });
}
function scopeState_(state, a) {
  if (a.role === 'Administrator') return state;
  var seen = {};
  state.projects = state.projects.filter(function (p) { var ok = canSeeProject_(p, state.tasks, a); if (ok) seen[p.id] = true; return ok; });
  ['tasks', 'risks', 'dependencies', 'decisions', 'updates', 'actions'].forEach(function (k) {
    state[k] = (state[k] || []).filter(function (r) { return !r.projectId || seen[r.projectId]; });
  });
  var general = ['decisions', 'risks', 'dependencies', 'actions', 'updates'];
  state.audit = (state.audit || []).filter(function (r) { return r.projectId ? seen[r.projectId] : general.indexOf(r.entityType) >= 0; });
  state.snapshots = (state.snapshots || []).filter(function (r) { return seen[r.projectId]; });
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
/** Returns a refusal message, or '' when allowed. Checked on the server for every record. */
function deny_(a, coll, cur, next, st) {
  if (a.role === 'Administrator') return '';
  if (a.role === 'Viewer') return 'Viewers cannot change anything.';
  if (['governance', 'options', 'users', 'roles', 'programs'].indexOf(coll) >= 0) return 'Only an administrator can change this.';
  var rec = next || cur;
  var byId = function (id) { return st.projects.filter(function (p) { return p.id === id; })[0]; };
  if (coll === 'projects') {
    if (!cur) return a.role === 'Project Owner' ? '' : 'Only project owners can create projects.';
    if (!next) return 'Only an administrator can delete a project.';
    if (ownsProject_(cur, a) && a.role === 'Project Owner') return '';
    var ch = changedFields_(cur, next);
    if (ch.length === 1 && APPEND_ONLY.indexOf(ch[0]) >= 0) return '';
    return 'Only this project\'s owner can change it.';
  }
  var proj = byId(rec.projectId);
  var from = cur ? byId(cur.projectId) : proj;
  if (a.role === 'Project Owner' && ownsProject_(proj, a) && ownsProject_(from, a)) return '';
  if (cur && next && cur.projectId !== next.projectId) return 'Only the owner of both projects can move this.';
  if (['risks', 'decisions', 'actions', 'dependencies'].indexOf(coll) >= 0 && cur && next && isMine_(cur.owner || cur.responsible, a.name)) {
    var off = changedFields_(cur, next).filter(function (f) { return f === 'owner' || f === 'responsible'; });
    return off.length ? 'Ask the project owner to reassign this.' : '';
  }
  if (coll === 'tasks' && cur && next) {
    if (!isMine_(cur.owner, a.name)) {
      var cf = changedFields_(cur, next);
      return cf.length === 1 && APPEND_ONLY.indexOf(cf[0]) >= 0 ? '' : 'Only the task owner or project owner can change this task.';
    }
    var bad = changedFields_(cur, next).filter(function (f) { return TASK_OWNER_FIELDS.indexOf(f) < 0; });
    return bad.length ? 'Task owners cannot change ' + bad.join(', ') + '. Ask the project owner.' : '';
  }
  if (coll === 'tasks' && !cur && next && next.parent) {
    var parent = st.tasks.filter(function (t) { return t.id === next.parent; })[0];
    return parent && parent.projectId === next.projectId && isMine_(parent.owner, a.name) ? '' : 'You can add subtasks only to your own tasks.';
  }
  if (coll === 'updates' && !cur) return '';
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
    if (ROLES.indexOf(next.role) < 0) return 'Unknown role.';
    if (!/^[^@\s]+@[^@\s]+$/.test(String(next.email || ''))) return 'Enter a valid email address.';
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
  var nameOf = function (n) { return String(n.who || n.author || '').trim().toLowerCase(); };
  var me = String(a.name || '').trim().toLowerCase();
  var was = {}, seen = {}, bad = '';
  (cur[f] || []).forEach(function (n) { was[noteKey_(n)] = n; });
  (next[f] || []).forEach(function (n) {
    var k = noteKey_(n), o = was[k];
    seen[k] = true;
    if (!o) { if (nameOf(n) !== me) bad = 'You can only add notes in your own name.'; return; }
    if (canon_(o) !== canon_(n) && !canManage && nameOf(o) !== me) bad = 'You can only edit your own notes.';
    if (nameOf(o) !== nameOf(n)) bad = 'The author of a note cannot be changed.';
  });
  Object.keys(was).forEach(function (k) { if (!seen[k] && !canManage && nameOf(was[k]) !== me) bad = 'You can only remove your own notes.'; });
  return bad;
}

// ---------- audit ----------
var FIELD_NAMES = { status: 'Status', owner: 'Owner', accountable: 'Answerable', due: 'Due date', priority: 'Priority', progress: 'Progress', name: 'Name', desc: 'Description', criteria: 'Acceptance criteria', deliverable: 'Expected outcome', start: 'Start date', objective: 'Objective', outcome: 'Expected outcome', blocker: 'Blocker', dependsOn: 'Dependencies', archivedAt: 'Archived', final: 'Final decision' };
var FIELD_ACTIONS = { status: 'status_changed', owner: 'owner_changed', accountable: 'owner_changed', due: 'deadline_changed', progress: 'progress_changed', priority: 'priority_changed', blocker: 'blocker_changed', dependsOn: 'dependency_changed', archivedAt: 'archive_changed' };
function short_(v) { var s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v == null ? '' : v); return s.length > 300 ? s.slice(0, 297) + '...' : s; }
function auditFor_(coll, cur, next, a, reqId, ts, reason) {
  var rec = next || cur;
  var id = rec.id || rec.name || rec.email || coll;
  var label = rec.name || rec.decision || rec.desc || rec.action || id;
  var projectId = coll === 'projects' ? rec.id : (rec.projectId || '');
  var taskId = coll === 'tasks' ? rec.id : '';
  var row = function (action, field, oldV, newV, text) { return [Utilities.getUuid(), ts, a.email || '', a.name || '', coll, String(id), projectId, taskId, action, field, short_(oldV), short_(newV), text + (reason ? ' Reason: ' + reason : ''), reqId]; };
  if (!cur) return [row('created', '', '', '', 'Created ' + coll.replace(/s$/, '') + ' "' + short_(label) + '"')];
  if (!next) return [row('deleted', '', '', '', 'Deleted ' + coll.replace(/s$/, '') + ' "' + short_(label) + '"')];
  var out = [];
  changedFields_(cur, next).forEach(function (f) {
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
  rng.setValues(rows);
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

function apply_(body, a) {
  var ops = body.ops || [];
  if (!ops.length) return { ok: true, version: getVersion_(), stamped: [] };
  if (ops.length > 500) return { ok: false, error: 'Too many changes at once.' };
  if (ops.filter(function (o) { return o.del; }).length > 25) return { ok: false, error: 'Refused: this save would delete more than 25 records at once.' };
  var cache = CacheService.getScriptCache();
  var reqId = String(body.requestId || Utilities.getUuid());
  var seen = cache.get('req:' + reqId);
  if (seen) return JSON.parse(seen); // the same save arrived twice: do not apply it twice
  var pulled = pull_();
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
      var uNext = op.del ? null : Object.assign({}, uCur || {}, op.rec || {}, { email: String(op.id).toLowerCase() });
      var ud = deny_(a, 'users', uCur, uNext, st) || invalid_('users', uCur, uNext, st, a);
      if (ud) return reject(ud, 'denied');
      var admins = users.filter(function (u) { return u.active && u.role === 'Administrator' && u.email !== String(op.id).toLowerCase(); }).length;
      if (authCfg_().required && !admins && (!uNext || !uNext.active || uNext.role !== 'Administrator')) return reject('There must always be at least one active administrator.', 'invalid');
      if (uNext) { uNext.active = uNext.active !== false && String(uNext.active) !== 'false'; uNext.addedBy = uNext.addedBy || a.name; uNext.addedAt = uNext.addedAt || ts; }
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
      if (!op.rec) return reject('This record no longer exists.', 'missing');
      next = JSON.parse(JSON.stringify(op.rec));
      next[idField] = op.id;
      if (!op.restoreOf) STAMPS.forEach(function (k) { delete next[k]; });
    } else {
      next = JSON.parse(JSON.stringify(cur));
      var conflict = null;
      Object.keys(op.set || {}).forEach(function (f) {
        if (conflict || f === idField || STAMPS.indexOf(f) >= 0) return; // IDs and server stamps never change
        var base = (op.base || {})[f];
        if (APPEND_ONLY.indexOf(f) >= 0) { next[f] = mergeAppend_(cur[f], base, op.set[f]); return; }
        if (!same_(cur[f], base) && !same_(cur[f], op.set[f])) { conflict = f; return; }
        if (op.set[f] === null || op.set[f] === undefined) delete next[f]; else next[f] = op.set[f];
      });
      if (conflict) return reject((FIELD_NAMES[conflict] || conflict) + ' was changed by ' + (cur.updatedBy || 'someone else') + '. Check the latest value.', 'conflict', conflict, cur[conflict]);
    }
    if (a.role !== 'Administrator' && next.projectId) {
      var dest = st.projects.filter(function (p) { return p.id === next.projectId; })[0];
      if (dest && !canSeeProject_(dest, st.tasks, a)) return reject('You do not have access to this project.', 'denied');
    }
    var denied = deny_(a, op.c, cur, next, st);
    if (denied) return reject(denied, 'denied');
    var problem = '';
    if (cur) APPEND_ONLY.forEach(function (f) {
      var owner = op.c === 'projects' ? cur : st.projects.filter(function (p) { return p.id === cur.projectId; })[0];
      problem = problem || (canon_(cur[f]) !== canon_(next[f]) ? noteProblem_(f, cur, next, a, a.role === 'Administrator' || (a.role === 'Project Owner' && ownsProject_(owner, a))) : '');
    });
    if (problem) return reject(problem, 'denied');
    if (schemaFor_(op.c) && oversize_(op.c, next)) return reject('This record has grown too long for the Sheet. Remove some notes or text and try again.', 'invalid');
    var bad = invalid_(op.c, cur, next, st, a);
    if (bad) return reject(bad, 'invalid');
    next.updatedAt = ts; next.updatedBy = a.name;
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
  var audit = [], trash = [], stamped = [];
  var headerBad = '';
  var tabs = {}; plan.forEach(function (p) { if (p.c) { tabs[p.c] = true; if (p.c === 'projects') NESTED.forEach(function (k) { tabs[k] = true; }); } });
  Object.keys(tabs).forEach(function (k) { var sc = schemaFor_(k); if (sc && !headerBad) headerBad = checkHeader_(ss, sc); });
  if (headerBad) return { ok: false, error: headerBad };
  var failure = null;
  try { plan.forEach(function (p) {
    if (p.doc) { var o = {}; o[p.doc] = JSON.stringify(p.value); metaSet_(o); audit.push([Utilities.getUuid(), ts, a.email || '', a.name || '', p.doc, p.doc, '', '', 'settings_changed', '', '', '', 'Changed ' + p.doc, reqId]); return; }
    if (p.users) { writeUser_(p.cur, p.next); audit.push([Utilities.getUuid(), ts, a.email || '', a.name || '', 'users', (p.next || p.cur).email, '', '', p.next ? 'user_changed' : 'user_removed', 'role', p.cur ? p.cur.role : '', p.next ? p.next.role : '', (p.next ? 'User ' + p.next.email + ' set to ' + p.next.role + (p.next.active ? '' : ' (inactive)') : 'Removed user ' + p.cur.email), reqId]); return; }
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
    if (p.next) stamped.push({ c: p.c, id: p.id, updatedAt: p.next.updatedAt, updatedBy: p.next.updatedBy, createdAt: p.next.createdAt, createdBy: p.next.createdBy, originalDue: p.next.originalDue });
  }); } catch (err) { failure = err; }
  // Whatever did get written is recorded and announced, so a retry finishes the rest.
  appendRows_(TRASH_SHEET, trash);
  appendRows_(AUDIT_SHEET, audit);
  var v = getVersion_() + 1;
  metaSet_({ version: String(v), updatedAt: ts, updatedBy: a.name || 'website' });
  if (failure) return { ok: false, version: v, error: 'Only part of this save reached the Sheet (' + String(failure.message || failure) + ').' };
  var res = { ok: true, version: v, stamped: stamped, audit: audit.length, refresh: moved };
  res.entries = audit.slice(0, 50).map(function (r) { var o = {}; AUDIT_COLS.forEach(function (c, i) { o[c] = r[i]; }); return o; }).filter(function (o) { return a.role === 'Administrator' || !o.projectId || o.entityType !== 'users'; });
  try { cache.put('req:' + reqId, JSON.stringify(res), 600); } catch (x) { /* very large reply: skip the replay cache */ }
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
  var cols = s.cols.concat([EXTRA]);
  var have = sh ? sh.getRange(1, 1, 1, cols.length).getValues()[0] : [];
  return cols.every(function (c, i) { return String(have[i]) === c; }) ? '' : 'The columns of the ' + s.tab + ' tab were changed. An administrator should run Control Tower > Set up / repair tabs.';
}

function rowValues_(s, o) {
  var known = {}; s.cols.forEach(function (c) { known[c] = true; });
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
  }).concat([Object.keys(extra).length ? JSON.stringify(extra) : '']);
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
  var width = Math.max(sh.getLastColumn(), s.cols.length + 1);
  var last = sh.getLastRow();
  var col = s.cols.indexOf('projectId');
  var kept = last >= 2 ? sh.getRange(2, 1, last - 1, width).getValues().filter(function (r) { return String(r[col]) !== String(projectId); }) : [];
  var fresh = rows.map(function (o) {
    var v = rowValues_(s, Object.assign({}, o, { projectId: projectId }));
    while (v.length < width) v.push('');
    return v;
  });
  var all = kept.concat(fresh);
  if (all.length) {
    ensureRows_(sh, all.length + 1);
    var rng = sh.getRange(2, 1, all.length, width);
    rng.setNumberFormat('@');
    rng.setValues(all);
  }
  if (last - 1 > all.length) sh.getRange(all.length + 2, 1, last - 1 - all.length, width).clearContent();
}
function writeUser_(cur, next) {
  var sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  var email = (next || cur).email;
  // The tab may hold an address typed in capitals. Sign-in ignores case, so this must too.
  var row = -1, n = sh.getLastRow();
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { if (row < 0 && String(r[0]).trim().toLowerCase() === email) row = i + 2; });
  if (!next) { if (row > 0) deleteSheetRow_(sh, row); return; }
  var vals = USER_COLS.map(function (c) { return c === 'active' ? (next.active ? 'TRUE' : 'FALSE') : String(next[c] == null ? '' : next[c]); });
  if (row < 0) row = Math.max(sh.getLastRow(), 1) + 1;
  ensureRows_(sh, row);
  sh.getRange(row, 1, 1, vals.length).setValues([vals]);
}
function markRestored_(trashId, ts) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TRASH_SHEET);
  var row = rowOfId_(sh, 1, trashId);
  if (row > 0) sh.getRange(row, TRASH_COLS.indexOf('restoredAt') + 1, 1, 1).setValues([[ts]]);
}

// ---------- history of progress ----------
function snapshot_(body, a) {
  var rows = (body.rows || []).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) && r.projectId; });
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
  if (!admins.length) { ui.alert('Add at least one active Administrator to the Users tab first, then run this again.'); return; }
  props_().setProperties({ AUTH_CLIENT_ID: id, AUTH_REQUIRED: 'true' });
  ui.alert('Sign-in is on. Only people listed in the Users tab can now open the site.');
}
function disableSignIn() { props_().setProperty('AUTH_REQUIRED', 'false'); SpreadsheetApp.getUi().alert('Sign-in is off. Anyone with the link can read and change the data.'); }
function backupNow() {
  var ss = SpreadsheetApp.getActive();
  var file = DriveApp.getFileById(ss.getId());
  var name = 'Backup ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH-mm') + ' ' + ss.getName();
  var it = file.getParents();
  var copy = it.hasNext() ? file.makeCopy(name, it.next()) : file.makeCopy(name);
  return copy.getId();
}
function turnOnDailyBackup() {
  ScriptApp.getProjectTriggers().filter(function (t) { return ['backupNow', 'dailyChecks'].indexOf(t.getHandlerFunction()) >= 0; }).forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('dailyChecks').timeBased().everyDays(1).atHour(6).create();
  SpreadsheetApp.getUi().alert('A copy of this Sheet will be saved in the same Drive folder every night, and late work will be recorded each morning.');
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
    if (rows.length) { appendRows_(AUDIT_SHEET, rows); bumpVersion_('System'); }
    return { ok: true, added: rows.length };
  } finally { lock.releaseLock(); }
}
