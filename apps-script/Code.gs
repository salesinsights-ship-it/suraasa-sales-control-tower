/**
 * ============================================================
 * Suraasa Sales Control Tower — Google Apps Script Sync Engine
 * ============================================================
 * Bound to the master Google Sheet. Provides two-way synchronization
 * between the web dashboard and Google Sheets.
 */

const SCHEMA = {
  Projects: {
    key: 'id',
    cols: [
      'id', 'name', 'category', 'type', 'program', 'valueClass',
      'objective', 'problem', 'outcome', 'impact', 'metrics',
      'owner', 'accountable', 'sponsor', 'start', 'due',
      'status', 'priority', 'priorityProposed', 'datesProposed',
      'nextAction', 'priorityRationale', 'dependencies', 'risks',
      'assumptions', 'hypothesis', 'successCriteria', 'testPeriod',
      'baseline', 'cadence', 'flags', 'completedAt'
    ],
    lists: ['metrics', 'dependencies', 'risks', 'assumptions', 'flags'],
    bools: ['priorityProposed', 'datesProposed'],
    drop: {
      category: 'categories',
      type: 'projectTypes',
      status: 'projectStatuses',
      priority: 'priorities',
      valueClass: 'valueClasses'
    }
  },
  Tasks: {
    key: 'id',
    cols: [
      'id', 'projectId', 'ws', 'ms', 'name', 'desc', 'owner', 'accountable',
      'start', 'due', 'priority', 'status', 'deliverable', 'completionCriteria',
      'dependency', 'progress', 'kind', 'parent', 'completedAt'
    ],
    nums: ['progress'],
    drop: {
      priority: 'priorities',
      status: 'taskStatuses',
      kind: 'taskKinds'
    }
  },
  Workstreams: {
    key: 'id',
    cols: ['id', 'projectId', 'name']
  },
  Milestones: {
    key: 'id',
    cols: ['id', 'projectId', 'ws', 'name', 'due', 'status'],
    drop: {
      status: 'milestoneStatuses'
    }
  },
  RACI: {
    key: null,
    cols: ['projectId', 'item', 'R', 'A', 'C', 'I'],
    lists: ['R', 'C', 'I']
  },
  Risks: {
    key: 'id',
    cols: ['id', 'projectId', 'desc', 'impact', 'probability', 'mitigation', 'owner', 'deadline', 'status', 'source'],
    drop: {
      impact: 'riskLevels',
      probability: 'riskLevels',
      status: 'riskStatuses'
    }
  },
  Dependencies: {
    key: 'id',
    cols: ['id', 'projectId', 'desc', 'responsible', 'externalOwner', 'status', 'requiredBy', 'escalation'],
    drop: {
      status: 'dependencyStatuses'
    }
  },
  Decisions: {
    key: 'id',
    cols: ['id', 'projectId', 'decision', 'owner', 'raised', 'requiredBy', 'impact', 'status', 'final', 'source'],
    drop: {
      status: 'decisionStatuses'
    }
  },
  Updates: {
    key: 'id',
    cols: ['id', 'projectId', 'ts', 'week', 'progress', 'completed', 'blockers', 'missed', 'next', 'decisions', 'rag', 'author'],
    drop: {
      rag: 'updateRag'
    }
  },
  Actions: {
    key: 'id',
    cols: ['id', 'kind', 'action', 'why', 'ownerRole', 'priority', 'output', 'dependency', 'timeline', 'projectId', 'taskId', 'bucket'],
    drop: {
      kind: 'actionKinds',
      priority: 'priorities',
      bucket: 'actionBuckets'
    }
  },
  Programs: {
    key: 'id',
    cols: ['id', 'name', 'objective', 'children', 'note'],
    lists: ['children']
  },
  Roles: {
    key: 'name',
    cols: ['name', 'kind', 'note']
  },
  Governance: {
    key: null,
    cols: ['section', 'key', 'value', 'note']
  },
  Options: {
    key: 'list',
    cols: ['list', 'values'],
    lists: ['values']
  },
  Comments: {
    key: null,
    cols: ['projectId', 'who', 'ts', 'text']
  },
  Activity: {
    key: null,
    cols: ['ts', 'text']
  },
  _Meta: {
    key: 'key',
    cols: ['key', 'value']
  }
};

/**
 * HTTP GET endpoint: returns state JSON for pull or status
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'pull';
    if (action === 'status') {
      const meta = getMeta_();
      return jsonResponse_({ status: 'ok', app: 'Suraasa Sales Control Tower', version: meta.version || 1 });
    }
    const state = pull_();
    return jsonResponse_(state);
  } catch (err) {
    return jsonResponse_({ error: err.message, stack: err.stack }, 500);
  }
}

/**
 * HTTP POST endpoint: receives state JSON for push
 */
function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    const action = body.action || (e && e.parameter && e.parameter.action) || 'push';

    if (action === 'push') {
      if (!body.state) throw new Error('Missing state payload in push request');
      const res = push_(body.state);
      return jsonResponse_(res);
    }

    if (action === 'setup') {
      setupSheet();
      return jsonResponse_({ success: true, message: 'Setup completed successfully.' });
    }

    return jsonResponse_({ error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return jsonResponse_({ error: err.message, stack: err.stack }, 500);
  }
}

/**
 * Helper to return JSON with CORS headers
 */
function jsonResponse_(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Converts Google Sheet rows into complete state JSON S
 */
function pull_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const S = {
    meta: {},
    roles: [],
    programs: [],
    projects: [],
    tasks: [],
    risks: [],
    dependencies: [],
    decisions: [],
    updates: [],
    actions: [],
    governance: { cadence: {}, rag: {}, classification: [] },
    options: {},
    activity: []
  };

  // 1. Read _Meta
  S.meta = getMeta_();

  // 2. Read Options
  const optSheet = ss.getSheetByName('Options');
  if (optSheet && optSheet.getLastRow() > 1) {
    const rows = optSheet.getRange(2, 1, optSheet.getLastRow() - 1, 2).getValues();
    rows.forEach(r => {
      const key = String(r[0] || '').trim();
      if (!key) return;
      const vals = String(r[1] || '').split('\n').map(s => s.trim()).filter(Boolean);
      S.options[key] = vals;
    });
  }

  // 3. Read Governance
  const govSheet = ss.getSheetByName('Governance');
  if (govSheet && govSheet.getLastRow() > 1) {
    const rows = govSheet.getRange(2, 1, govSheet.getLastRow() - 1, 4).getValues();
    rows.forEach(r => {
      const sec = String(r[0] || '').trim();
      const key = String(r[1] || '').trim();
      const val = String(r[2] || '');
      const note = String(r[3] || '');
      if (sec === 'cadence') {
        S.governance.cadence[key] = val.split('\n').map(s => s.trim()).filter(Boolean);
      } else if (sec === 'rag') {
        S.governance.rag[key] = val;
      } else if (sec === 'classification') {
        S.governance.classification.push({ initiative: key, mapped: val, note });
      }
    });
  }

  // 4. Read Flat collections: Roles, Programs, Tasks, Risks, Dependencies, Decisions, Updates, Actions, Activity
  ['Roles', 'Programs', 'Tasks', 'Risks', 'Dependencies', 'Decisions', 'Updates', 'Actions', 'Activity'].forEach(tab => {
    const targetKey = tab.toLowerCase();
    const sheet = ss.getSheetByName(tab);
    if (!sheet || sheet.getLastRow() <= 1) return;
    const cfg = SCHEMA[tab];
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, cfg.cols.length).getValues();
    S[targetKey] = data.map(row => {
      const item = {};
      cfg.cols.forEach((col, idx) => {
        let val = row[idx];
        if (cfg.lists && cfg.lists.includes(col)) {
          item[col] = String(val || '').split(col === 'children' ? ',' : '\n').map(s => s.trim()).filter(Boolean);
        } else if (cfg.bools && cfg.bools.includes(col)) {
          item[col] = val === true || String(val).toLowerCase() === 'true';
        } else if (cfg.nums && cfg.nums.includes(col)) {
          item[col] = Number(val) || 0;
        } else {
          item[col] = val != null ? String(val) : '';
        }
      });
      return item;
    });
  });

  // 5. Read Projects and their nested sub-collections: Workstreams, Milestones, RACI, Comments
  const projSheet = ss.getSheetByName('Projects');
  if (projSheet && projSheet.getLastRow() > 1) {
    const pCfg = SCHEMA.Projects;
    const pData = projSheet.getRange(2, 1, projSheet.getLastRow() - 1, pCfg.cols.length).getValues();
    S.projects = pData.map(row => {
      const p = { workstreams: [], milestones: [], raci: [], comments: [] };
      pCfg.cols.forEach((col, idx) => {
        let val = row[idx];
        if (pCfg.lists && pCfg.lists.includes(col)) {
          p[col] = String(val || '').split('\n').map(s => s.trim()).filter(Boolean);
        } else if (pCfg.bools && pCfg.bools.includes(col)) {
          p[col] = val === true || String(val).toLowerCase() === 'true';
        } else {
          p[col] = val != null ? String(val) : '';
        }
      });
      return p;
    });
  }

  // Link Workstreams
  const wsSheet = ss.getSheetByName('Workstreams');
  if (wsSheet && wsSheet.getLastRow() > 1) {
    const wsData = wsSheet.getRange(2, 1, wsSheet.getLastRow() - 1, 3).getValues();
    wsData.forEach(r => {
      const p = S.projects.find(x => x.id === r[1]);
      if (p) p.workstreams.push({ id: r[0], projectId: r[1], name: r[2] });
    });
  }

  // Link Milestones
  const msSheet = ss.getSheetByName('Milestones');
  if (msSheet && msSheet.getLastRow() > 1) {
    const msData = msSheet.getRange(2, 1, msSheet.getLastRow() - 1, 6).getValues();
    msData.forEach(r => {
      const p = S.projects.find(x => x.id === r[1]);
      if (p) p.milestones.push({ id: r[0], projectId: r[1], ws: r[2], name: r[3], due: r[4] ? formatDate_(r[4]) : '', status: r[5] });
    });
  }

  // Link RACI
  const raciSheet = ss.getSheetByName('RACI');
  if (raciSheet && raciSheet.getLastRow() > 1) {
    const rData = raciSheet.getRange(2, 1, raciSheet.getLastRow() - 1, 6).getValues();
    rData.forEach(r => {
      const p = S.projects.find(x => x.id === r[0]);
      if (p) {
        p.raci.push({
          item: r[1],
          R: String(r[2] || '').split(',').map(s => s.trim()).filter(Boolean),
          A: r[3] || 'TBD',
          C: String(r[4] || '').split(',').map(s => s.trim()).filter(Boolean),
          I: String(r[5] || '').split(',').map(s => s.trim()).filter(Boolean)
        });
      }
    });
  }

  // Link Comments
  const comSheet = ss.getSheetByName('Comments');
  if (comSheet && comSheet.getLastRow() > 1) {
    const cData = comSheet.getRange(2, 1, comSheet.getLastRow() - 1, 4).getValues();
    cData.forEach(r => {
      const p = S.projects.find(x => x.id === r[0]);
      if (p) p.comments.push({ projectId: r[0], who: r[1], ts: r[2], text: r[3] });
    });
  }

  return S;
}

/**
 * Writes complete state JSON S into the Sheet tabs
 */
function push_(state) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentMeta = getMeta_();
  const newVersion = (currentMeta.version || 0) + 1;
  const now = new Date().toISOString();

  // 1. Write Options
  if (state.options) {
    const optRows = Object.entries(state.options).map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : String(v || '')]);
    writeTab_(ss, 'Options', SCHEMA.Options.cols, optRows);
  }

  // 2. Write Governance
  if (state.governance) {
    const govRows = [];
    if (state.governance.cadence) {
      Object.entries(state.governance.cadence).forEach(([k, list]) => {
        govRows.push(['cadence', k, (list || []).join('\n'), '']);
      });
    }
    if (state.governance.rag) {
      Object.entries(state.governance.rag).forEach(([k, desc]) => {
        govRows.push(['rag', k, desc, '']);
      });
    }
    if (state.governance.classification) {
      (state.governance.classification || []).forEach(c => {
        govRows.push(['classification', c.initiative || '', c.mapped || '', c.note || '']);
      });
    }
    writeTab_(ss, 'Governance', SCHEMA.Governance.cols, govRows);
  }

  // 3. Write Projects and unpack sub-tables
  const workstreams = [];
  const milestones = [];
  const raciList = [];
  const comments = [];

  const projRows = (state.projects || []).map(p => {
    (p.workstreams || []).forEach(w => workstreams.push([w.id, p.id, w.name]));
    (p.milestones || []).forEach(m => milestones.push([m.id, p.id, m.ws || '', m.name, m.due || '', m.status || 'Pending']));
    (p.raci || []).forEach(r => raciList.push([p.id, r.item, (r.R || []).join(', '), r.A || 'TBD', (r.C || []).join(', '), (r.I || []).join(', ')]));
    (p.comments || []).forEach(c => comments.push([p.id, c.who, c.ts, c.text]));

    return SCHEMA.Projects.cols.map(col => {
      let val = p[col];
      if (SCHEMA.Projects.lists.includes(col)) {
        return Array.isArray(val) ? val.join('\n') : (val || '');
      }
      return val != null ? val : '';
    });
  });

  writeTab_(ss, 'Projects', SCHEMA.Projects.cols, projRows);
  writeTab_(ss, 'Workstreams', SCHEMA.Workstreams.cols, workstreams);
  writeTab_(ss, 'Milestones', SCHEMA.Milestones.cols, milestones);
  writeTab_(ss, 'RACI', SCHEMA.RACI.cols, raciList);
  writeTab_(ss, 'Comments', SCHEMA.Comments.cols, comments);

  // 4. Write Flat collections
  const collections = [
    { tab: 'Tasks', list: state.tasks || [], cfg: SCHEMA.Tasks },
    { tab: 'Risks', list: state.risks || [], cfg: SCHEMA.Risks },
    { tab: 'Dependencies', list: state.dependencies || [], cfg: SCHEMA.Dependencies },
    { tab: 'Decisions', list: state.decisions || [], cfg: SCHEMA.Decisions },
    { tab: 'Updates', list: state.updates || [], cfg: SCHEMA.Updates },
    { tab: 'Actions', list: state.actions || [], cfg: SCHEMA.Actions },
    { tab: 'Programs', list: state.programs || [], cfg: SCHEMA.Programs },
    { tab: 'Roles', list: state.roles || [], cfg: SCHEMA.Roles },
    { tab: 'Activity', list: (state.activity || []).slice(0, 100), cfg: SCHEMA.Activity }
  ];

  collections.forEach(c => {
    const rows = c.list.map(item => {
      return c.cfg.cols.map(col => {
        let val = item[col];
        if (c.cfg.lists && c.cfg.lists.includes(col)) {
          return Array.isArray(val) ? (col === 'children' ? val.join(', ') : val.join('\n')) : (val || '');
        }
        return val != null ? val : '';
      });
    });
    writeTab_(ss, c.tab, c.cfg.cols, rows);
  });

  // 5. Update _Meta
  const metaRows = [
    ['app', 'Suraasa Sales Control Tower'],
    ['version', newVersion],
    ['savedAt', now],
    ['note', (state.meta && state.meta.note) || 'Synced via Web Dashboard']
  ];
  writeTab_(ss, '_Meta', ['key', 'value'], metaRows);

  return { success: true, version: newVersion, savedAt: now };
}

/**
 * Safely writes 2D rows into a tab while preserving headers and formatting
 */
function writeTab_(ss, tabName, cols, rows) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    formatHeader_(sheet, cols);
  }

  // Clear existing content below header
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), cols.length);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }

  // Write new rows
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, cols.length).setValues(rows);
  }
}

/**
 * Creates and formats all tabs in the schema
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.entries(SCHEMA).forEach(([tabName, cfg]) => {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    formatHeader_(sheet, cfg.cols);
  });

  // Setup dropdown validations based on Options tab
  applyValidationRules_(ss);

  // Set friendly tab colors
  const mainSheets = ['Projects', 'Tasks', 'Workstreams', 'Milestones', 'RACI', 'Risks', 'Dependencies', 'Decisions', 'Updates', 'Actions', 'Programs', 'Roles', 'Governance', 'Options'];
  mainSheets.forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) s.setTabColor('#2F5BEA');
  });

  const metaSheet = ss.getSheetByName('_Meta');
  if (metaSheet) metaSheet.setTabColor('#64748B');
}

/**
 * Applies dropdown validation rules across tabs using the Options tab
 */
function applyValidationRules_(ss) {
  const optSheet = ss.getSheetByName('Options');
  const optionsMap = {};
  if (optSheet && optSheet.getLastRow() > 1) {
    const optRows = optSheet.getRange(2, 1, optSheet.getLastRow() - 1, 2).getValues();
    optRows.forEach(r => {
      const key = String(r[0] || '').trim();
      const vals = String(r[1] || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (key && vals.length) optionsMap[key] = vals;
    });
  }

  // Apply to sheets defined in SCHEMA with 'drop'
  Object.entries(SCHEMA).forEach(([tabName, cfg]) => {
    if (!cfg.drop) return;
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    Object.entries(cfg.drop).forEach(([colName, optKey]) => {
      const colIdx = cfg.cols.indexOf(colName) + 1;
      if (colIdx < 1) return;
      const vals = optionsMap[optKey] || [];
      if (vals.length > 0) {
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(vals, true)
          .setAllowInvalid(true)
          .build();
        sheet.getRange(2, colIdx, Math.max(100, sheet.getMaxRows() - 1), 1).setDataValidation(rule);
      }
    });
  });
}

/**
 * Formats header row
 */
function formatHeader_(sheet, cols) {
  // Ensure enough columns
  if (sheet.getMaxColumns() < cols.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), cols.length - sheet.getMaxColumns());
  }

  const headerRange = sheet.getRange(1, 1, 1, cols.length);
  headerRange.setValues([cols]);
  headerRange.setBackground('#0F1B33');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setFontFamily('Inter');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
}

/**
 * Reads _Meta table
 */
function getMeta_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metaSheet = ss.getSheetByName('_Meta');
  const meta = { version: 1, app: 'Suraasa Sales Control Tower', savedAt: new Date().toISOString() };
  if (!metaSheet || metaSheet.getLastRow() <= 1) return meta;

  const data = metaSheet.getRange(2, 1, metaSheet.getLastRow() - 1, 2).getValues();
  data.forEach(r => {
    const k = String(r[0] || '').trim();
    if (k) meta[k] = r[1];
  });
  if (meta.version) meta.version = Number(meta.version) || 1;
  return meta;
}

/**
 * Formats date object or string into YYYY-MM-DD
 */
function formatDate_(d) {
  if (!d) return '';
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).split('T')[0];
}

/**
 * Triggered on manual user edit inside Google Sheet.
 * Increments version so web app can detect remote edits.
 */
function onEdit(e) {
  try {
    const meta = getMeta_();
    meta.version = (meta.version || 1) + 1;
    meta.savedAt = new Date().toISOString();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const metaSheet = ss.getSheetByName('_Meta');
    if (metaSheet) {
      writeTab_(ss, '_Meta', ['key', 'value'], Object.entries(meta));
    }
  } catch (err) {
    console.error('onEdit handler error: ' + err.message);
  }
}
