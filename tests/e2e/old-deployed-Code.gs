var APP = 'Suraasa Sales Control Tower';
var META_SHEET = '_Meta';
var ACTIVITY_SHEET = 'Activity';
var EXTRA = '_extra';
var NL = '\n';

var STATUS_P = ['Not Started', 'In Progress', 'On Hold', 'Blocked', 'Completed'];
var STATUS_T = ['Not Started', 'In Progress', 'Awaiting Approval', 'Blocked', 'On Hold', 'Completed'];
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
    drop: { status: ['Open', 'Decided', 'Deferred', 'Escalated'] } },
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
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActive();
  SCHEMA.forEach(function (s) {
    var sh = ss.getSheetByName(s.tab) || ss.insertSheet(s.tab);
    var cols = s.cols.concat([EXTRA]);
    var existing = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    var sameHeader = existing.length === cols.length && cols.every(function (c, i) { return existing[i] === c; });
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
  var out = data.map(function (row) { return newCols.map(function (c) { var i = oldCols.indexOf(c); return i >= 0 ? row[i] : ''; }); });
  sh.clearContents();
  sh.getRange(1, 1, 1, newCols.length).setValues([newCols]);
  if (out.length) sh.getRange(2, 1, out.length, newCols.length).setValues(out);
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
  var rows = n >= 2 ? sh.getRange(2, 1, n - 1, 2).getValues() : [];
  Object.keys(obj).forEach(function (k) {
    var i = -1; rows.forEach(function (r, j) { if (String(r[0]) === k) i = j; });
    if (i >= 0) rows[i][1] = obj[k]; else rows.push([k, obj[k]]);
  });
  sh.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
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
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    if (!name || name === META_SHEET || name === ACTIVITY_SHEET) return;
    var isDataTab = SCHEMA.some(function (s) { return s.tab === name; });
    if (!isDataTab) return;
    // Debounce: several edits within 2s count as one version bump
    var cache = CacheService.getScriptCache();
    if (cache.get('editBump')) return;
    cache.put('editBump', '1', 2);
    bumpVersion_('sheet edit' + (e.user && e.user.getEmail ? ' by ' + e.user.getEmail() : ''));
  } catch (err) { /* never block the user's edit */ }
}

// ------------------------------------------------------------
//  Web app API
// ------------------------------------------------------------
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  try {
    if (action === 'ping') return json_({ ok: true, app: APP, version: getVersion_(), sheet: SpreadsheetApp.getActive().getName() });
    if (action === 'version') { var m = metaMap_(); return json_({ ok: true, version: parseInt(m.version, 10) || 0, updatedAt: m.updatedAt || '', updatedBy: m.updatedBy || '' }); }
    if (action === 'pull') return json_(pull_());
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var body = {};
    try { body = JSON.parse(e.postData && e.postData.contents || '{}'); } catch (x) { return json_({ ok: false, error: 'Body is not JSON' }); }
    var action = body.action || 'push';
    if (action === 'push') return json_(push_(body));
    if (action === 'pull') return json_(pull_());
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
  finally { try { lock.releaseLock(); } catch (x) {} }
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
  SCHEMA.forEach(function (s) {
    var rows = s.nested ? flat[s.key] : (state[s.key] || []);
    writeTab_(ss, s, rows);
  });
  // activity
  var act = ss.getSheetByName(ACTIVITY_SHEET);
  var activity = (state.activity || []).slice(0, 500);
  clearData_(act, 2);
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
  if (header.join('\u0001') !== cols.join('\u0001')) { sh.getRange(1, 1, 1, cols.length).setValues([cols]); header = cols; if (lastCol > cols.length) sh.getRange(1, cols.length + 1, 1, lastCol - cols.length).clearContent(); }
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
  var rng = sh.getRange(2, 1, values.length, cols.length);
  rng.setNumberFormat('@');
  if (s.nums) s.nums.forEach(function (c) { sh.getRange(2, cols.indexOf(c) + 1, values.length, 1).setNumberFormat('0'); });
  rng.setValues(values);
}

function clearData_(sh, ncols) {
  var lastRow = sh.getLastRow(); var lastCol = Math.max(sh.getLastColumn(), ncols || 1);
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
