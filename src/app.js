/* ============================================================
   Suraasa Sales Control Tower
   Home answers "what needs me today?". Every list is one line per thing;
   everything else about a thing lives in its side panel.
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'suraasa_sales_control_tower_v1';

  // Fallback defaults for configurable option lists
  const FALLBACKS = {
    priorities: ['P0', 'P1', 'P2', 'P3'],
    projectStatuses: ['Not Started', 'In Progress', 'On Hold', 'Blocked', 'Completed'],
    taskStatuses: ['Not Started', 'In Progress', 'Awaiting Approval', 'Blocked', 'On Hold', 'Completed'],
    taskKinds: ['Task', 'Subtask', 'Recurring', 'Decision'],
    milestoneStatuses: ['Pending', 'In Progress', 'Completed'],
    categories: [
      'Revenue Generation',
      'Funnel Conversion & Sales Productivity',
      'B2B Business Development',
      'Marketing & Demand Generation',
      'Cross-functional Dependencies'
    ],
    projectTypes: [
      'Project',
      'Strategic Project',
      'Experiment',
      'Recurring Operation',
      'Recurring Programme',
      'Project → Recurring Ops',
      'Dependency Cluster',
      'Recurring Operation + Experiment'
    ],
    valueClasses: [
      'Revenue-generating',
      'Conversion improvement',
      'Operational efficiency',
      'Strategic growth',
      'Experiment',
      'Dependency'
    ],
    riskLevels: ['High', 'Medium', 'Low'],
    riskStatuses: ['Open', 'Mitigated', 'Resolved', 'Escalated', 'Closed'],
    dependencyStatuses: ['Open', 'Escalated', 'Resolved', 'Closed'],
    decisionStatuses: ['Open', 'Pending AK/Ankit decision', 'Closed', 'Escalated'],
    actionKinds: ['Immediate action', 'Pending action', 'Recommendation'],
    actionBuckets: [
      'Implement immediately',
      'Requires a decision',
      'Requires technology / CRM support',
      'Requires another department',
      'Requires a complete project plan',
      'Requires a pilot / experiment'
    ],
    updateRag: ['Green', 'Amber', 'Red']
  };

  let S = null; // State object
  const UI = {
    view: 'overview',
    projectId: null,
    ptab: 'summary',
    taskFilter: 'pending',
    tgroup: 'due',
    pmode: 'list',
    pchip: 'all',
    actionTab: 'queue',
    raciTab: 'projects',
    weekTab: 'need',
    showFilters: false,
    showCharts: false,
    open: {},
    me: '',
    sort: {},
    filters: {},
    ganttOpen: {},
    riskTab: 'decisions'
  };

  // Helper to dynamically get option list from S.options or fallback
  const opt = k => (S && S.options && Array.isArray(S.options[k]) && S.options[k].length) ? S.options[k] : (FALLBACKS[k] || []);

  // ---------- utils ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const dnum = s => isDate(s) ? Math.floor(new Date(s + 'T00:00:00').getTime() / 86400000) : null;
  const daysFromToday = s => { const d = dnum(s); return d == null ? null : d - dnum(todayStr()); };
  const fmt = s => { if (!s) return '<span class="tbd">TBD</span>'; if (!isDate(s)) return esc(s); const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const fmtShort = s => { if (!s || !isDate(s)) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const dueBadge = s => {
    if (!s || !isDate(s)) return '<span class="brief-tag">No due date</span>';
    const d = daysFromToday(s);
    if (d < 0) return '<span class="brief-tag overdue">' + Math.abs(d) + 'd overdue</span>';
    if (d === 0) return '<span class="brief-tag urgent">Due today</span>';
    if (d === 1) return '<span class="brief-tag urgent">Due tomorrow</span>';
    if (d <= 3) return '<span class="brief-tag urgent">Due in ' + d + 'd</span>';
    return '<span class="brief-tag">Due ' + fmtShort(s) + '</span>';
  };
  const isTBD = v => !v || /^tbd/i.test(String(v).trim());
  const person = v => isTBD(v) ? '<span class="tbd">' + esc(v || 'TBD') + '</span>' : esc(v);
  const uid = p => p + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const nowIso = () => new Date().toISOString();
  const clone = o => JSON.parse(JSON.stringify(o));
  const by = (k, dir) => (a, b) => { const x = a[k] == null ? '' : a[k], y = b[k] == null ? '' : b[k]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); };
  const RAG_WORD = { Green: 'On track', Amber: 'At risk', Red: 'Delayed', Grey: 'Not started' };
  const pillRag = r => '<span class="pill ' + (r || 'grey').toLowerCase() + '">' + esc(RAG_WORD[r] || r || 'Not started') + '</span>';
  const pillPrio = p => '<span class="pill ' + (p || 'p3').toLowerCase() + '">' + esc(p || '—') + '</span>';
  const pillStatus = s => {
    const m = {
      'Completed': 'green', 'In Progress': 'blue', 'Blocked': 'red', 'On Hold': 'amber',
      'Awaiting Approval': 'amber', 'Not Started': 'grey', 'Pending': 'grey', 'Open': 'amber',
      'Closed': 'green', 'Resolved': 'green', 'Mitigated': 'green', 'Escalated': 'red', 'Decided': 'green'
    };
    return '<span class="pill ' + (m[s] || 'outline') + '">' + esc(s || '—') + '</span>';
  };
  function toast(msg, err, undo) {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button data-act="toast-undo">Undo</button>' : '');
    toast._undo = undo || null;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; toast._undo = null; }, undo ? 6000 : 2800);
  }

  // ---------- persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.projects) && Array.isArray(d.tasks)) {
          S = d;
          if (!Array.isArray(S.roles)) S.roles = [];
          if (!Array.isArray(S.programs)) S.programs = [];
          if (!S.options) S.options = buildSeed().options;
          if (!S.governance) S.governance = buildSeed().governance;
          if (!S.meta) S.meta = {};
          const DEFAULT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbxWGgTe5GJidK2m3nPeZOTTeL-bLKyaVdomX6VJZFa5eMScv-mQp7z9fbbsidPVFd1D/exec';
          let changed = false;
          if (!S.meta.sync) {
            S.meta.sync = { url: DEFAULT_SYNC_URL, enabled: true, autoSync: true, lastSync: null, status: 'connected', error: null, baseVersion: 2 };
            changed = true;
          } else if (!S.meta.sync.url || S.meta.sync.url.includes('/a/macros/suraasa.com/')) {
            S.meta.sync.url = DEFAULT_SYNC_URL;
            S.meta.sync.enabled = true;
            S.meta.sync.status = 'connected';
            changed = true;
          }
          if (S.roles.some(r => r.name === 'Shrayansh SoodCRM/Tech')) {
            S.roles = S.roles.filter(r => r.name !== 'Shrayansh SoodCRM/Tech');
            changed = true;
          }

          // Ensure standard roles exist in proper order
          const seedRoles = buildSeed().roles;
          const roleNames = new Set(S.roles.map(r => r.name));
          seedRoles.forEach(sr => {
            if (!roleNames.has(sr.name)) {
              S.roles.push(sr);
              roleNames.add(sr.name);
              changed = true;
            }
          });
          // Ensure options are populated with all lists
          Object.keys(FALLBACKS).forEach(k => {
            if (!Array.isArray(S.options[k]) || !S.options[k].length) {
              S.options[k] = FALLBACKS[k].slice();
              changed = true;
            }
          });

          if (changed) save(false);
          return;
        }
      }
    } catch (e) { console.warn('localStorage read failed', e); }
    S = buildSeed();
    save(false);
  }

  function save(triggerSync) {
    if (triggerSync === undefined) triggerSync = true;
    try {
      S.meta = S.meta || {};
      S.meta.savedAt = nowIso();
      S.meta.version = (S.meta.version || 1) + 1;
      localStorage.setItem(KEY, JSON.stringify(S));
      if (triggerSync && window.SYNC && window.SYNC.onLocalChange) {
        window.SYNC.onLocalChange();
      }
    } catch (e) { toast('Could not save in this browser: ' + e.message, true); }
  }

  function log(text) {
    S.activity = S.activity || [];
    S.activity.unshift({ ts: nowIso(), text });
    if (S.activity.length > 500) S.activity.length = 500;
  }

  function commit(text) {
    if (text) log(text);
    save(true);
    closeModal();
    render();
    if (text) toast(text);
  }

  // ---------- lookups ----------
  const P = id => S.projects.find(p => p.id === id);
  const pTasks = id => S.tasks.filter(t => t.projectId === id);
  const pName = id => { const p = P(id); return p ? p.name : (id || '—'); };
  const ws = (p, id) => (p.workstreams || []).find(w => w.id === id);
  const ms = (p, id) => (p.milestones || []).find(m => m.id === id);

  function people() {
    const list = [];
    const set = new Set();
    // 1. Follow S.roles exact order first
    (S.roles || []).forEach(r => {
      if (r && r.name && r.name !== 'Shrayansh SoodCRM/Tech' && !set.has(r.name)) {
        set.add(r.name);
        list.push(r.name);
      }
    });
    // 2. Add any other people referenced in projects/tasks that aren't in roles
    const extras = new Set();
    (S.projects || []).forEach(p => {
      [p.owner, p.accountable, p.sponsor].forEach(v => {
        if (v && !isTBD(v) && v !== 'Shrayansh SoodCRM/Tech' && !set.has(v)) extras.add(v);
      });
      (p.raci || []).forEach(r => {
        [].concat(r.R || [], r.C || [], r.I || [], [r.A]).forEach(v => {
          if (v && !isTBD(v) && v !== 'Shrayansh SoodCRM/Tech' && !set.has(v)) extras.add(v);
        });
      });
    });
    (S.tasks || []).forEach(t => {
      [t.owner, t.accountable].forEach(v => {
        if (v && !isTBD(v)) {
          String(v).split(',').forEach(x => {
            const tr = x.trim();
            if (tr && !isTBD(tr) && tr !== 'Shrayansh SoodCRM/Tech' && !set.has(tr)) extras.add(tr);
          });
        }
      });
    });
    return list.concat([...extras].sort());
  }

  // ---------- Person / Role cascading rename & delete ----------
  function renamePerson(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    const role = (S.roles || []).find(r => r.name === oldName);
    if (role) role.name = newName;

    S.projects.forEach(p => {
      if (p.owner === oldName) p.owner = newName;
      if (p.accountable === oldName) p.accountable = newName;
      if (p.sponsor === oldName) p.sponsor = newName;
      (p.raci || []).forEach(r => {
        if (r.A === oldName) r.A = newName;
        if (Array.isArray(r.R)) r.R = r.R.map(x => x === oldName ? newName : x);
        if (Array.isArray(r.C)) r.C = r.C.map(x => x === oldName ? newName : x);
        if (Array.isArray(r.I)) r.I = r.I.map(x => x === oldName ? newName : x);
      });
    });

    S.tasks.forEach(t => {
      if (t.owner === oldName) t.owner = newName;
      else if (t.owner && t.owner.includes(oldName)) {
        t.owner = t.owner.split(',').map(s => s.trim() === oldName ? newName : s.trim()).join(', ');
      }
      if (t.accountable === oldName) t.accountable = newName;
      else if (t.accountable && t.accountable.includes(oldName)) {
        t.accountable = t.accountable.split(',').map(s => s.trim() === oldName ? newName : s.trim()).join(', ');
      }
    });

    (S.risks || []).forEach(r => { if (r.owner === oldName) r.owner = newName; });
    (S.dependencies || []).forEach(d => {
      if (d.responsible === oldName) d.responsible = newName;
      if (d.externalOwner === oldName) d.externalOwner = newName;
    });
    (S.decisions || []).forEach(d => { if (d.owner === oldName) d.owner = newName; });
    (S.updates || []).forEach(u => { if (u.author === oldName) u.author = newName; });

    if (UI.me === oldName) UI.me = newName;
  }

  function deletePerson(targetName) {
    if (!confirm('Delete person "' + targetName + '"? References across projects, tasks and RACI will be set to TBD.')) return;
    S.roles = S.roles.filter(r => r.name !== targetName);
    const repl = 'TBD';

    S.projects.forEach(p => {
      if (p.owner === targetName) p.owner = repl;
      if (p.accountable === targetName) p.accountable = repl;
      if (p.sponsor === targetName) p.sponsor = repl;
      (p.raci || []).forEach(r => {
        if (r.A === targetName) r.A = repl;
        if (Array.isArray(r.R)) r.R = r.R.map(x => x === targetName ? repl : x);
        if (Array.isArray(r.C)) r.C = r.C.map(x => x === targetName ? repl : x);
        if (Array.isArray(r.I)) r.I = r.I.map(x => x === targetName ? repl : x);
      });
    });

    S.tasks.forEach(t => {
      if (t.owner === targetName) t.owner = repl;
      else if (t.owner && t.owner.includes(targetName)) {
        t.owner = t.owner.split(',').map(s => s.trim() === targetName ? repl : s.trim()).join(', ');
      }
      if (t.accountable === targetName) t.accountable = repl;
      else if (t.accountable && t.accountable.includes(targetName)) {
        t.accountable = t.accountable.split(',').map(s => s.trim() === targetName ? repl : s.trim()).join(', ');
      }
    });

    (S.risks || []).forEach(r => { if (r.owner === targetName) r.owner = repl; });
    (S.dependencies || []).forEach(d => {
      if (d.responsible === targetName) d.responsible = repl;
      if (d.externalOwner === targetName) d.externalOwner = repl;
    });
    (S.decisions || []).forEach(d => { if (d.owner === targetName) d.owner = repl; });

    if (UI.me === targetName) UI.me = '';
    commit('Deleted person ' + targetName);
  }

  // ---------- Option list usage validation ----------
  function checkOptionUsage(optKey, val) {
    const usages = [];
    if (optKey === 'priorities') {
      const pCount = S.projects.filter(p => p.priority === val).length;
      if (pCount) usages.push(pCount + ' project(s)');
      const tCount = S.tasks.filter(t => t.priority === val).length;
      if (tCount) usages.push(tCount + ' task(s)');
      const aCount = S.actions.filter(a => a.priority === val).length;
      if (aCount) usages.push(aCount + ' action(s)');
    } else if (optKey === 'projectStatuses') {
      const count = S.projects.filter(p => p.status === val).length;
      if (count) usages.push(count + ' project(s)');
    } else if (optKey === 'taskStatuses') {
      const count = S.tasks.filter(t => t.status === val).length;
      if (count) usages.push(count + ' task(s)');
    } else if (optKey === 'taskKinds') {
      const count = S.tasks.filter(t => t.kind === val).length;
      if (count) usages.push(count + ' task(s)');
    } else if (optKey === 'milestoneStatuses') {
      let count = 0;
      S.projects.forEach(p => { (p.milestones || []).forEach(m => { if (m.status === val) count++; }); });
      if (count) usages.push(count + ' milestone(s)');
    } else if (optKey === 'categories') {
      const count = S.projects.filter(p => p.category === val).length;
      if (count) usages.push(count + ' project(s)');
    } else if (optKey === 'projectTypes') {
      const count = S.projects.filter(p => p.type === val).length;
      if (count) usages.push(count + ' project(s)');
    } else if (optKey === 'valueClasses') {
      const count = S.projects.filter(p => p.valueClass === val).length;
      if (count) usages.push(count + ' project(s)');
    } else if (optKey === 'riskLevels') {
      const count = S.risks.filter(r => r.impact === val || r.probability === val).length;
      if (count) usages.push(count + ' risk(s)');
    } else if (optKey === 'riskStatuses') {
      const count = S.risks.filter(r => r.status === val).length;
      if (count) usages.push(count + ' risk(s)');
    } else if (optKey === 'dependencyStatuses') {
      const count = S.dependencies.filter(d => d.status === val).length;
      if (count) usages.push(count + ' dependency(ies)');
    } else if (optKey === 'decisionStatuses') {
      const count = S.decisions.filter(d => d.status === val).length;
      if (count) usages.push(count + ' decision(s)');
    } else if (optKey === 'actionKinds') {
      const count = S.actions.filter(a => a.kind === val).length;
      if (count) usages.push(count + ' action(s)');
    } else if (optKey === 'actionBuckets') {
      const count = S.actions.filter(a => a.bucket === val).length;
      if (count) usages.push(count + ' action(s)');
    }
    return usages;
  }

  // ---------- computed ----------
  function taskOverdue(t) { return t.status !== 'Completed' && isDate(t.due) && daysFromToday(t.due) < 0; }
  function projectProgress(id) {
    const ts = pTasks(id).filter(t => t.kind !== 'Recurring');
    if (!ts.length) return 0;
    return Math.round(ts.reduce((a, t) => a + (t.status === 'Completed' ? 100 : (+t.progress || 0)), 0) / ts.length);
  }
  function nextMilestone(p) {
    const open = (p.milestones || []).filter(m => m.status !== 'Completed');
    const dated = open.filter(m => isDate(m.due)).sort(by('due'));
    return dated[0] || open[0] || null;
  }
  function lastUpdate(id) {
    const u = S.updates.filter(u => u.projectId === id).sort((a, b) => b.ts > a.ts ? 1 : -1);
    return u[0] || null;
  }
  function health(p) {
    const reasons = [];
    const ts = pTasks(p.id);
    if (p.status === 'Completed') return { rag: 'Green', reasons: ['Completed'] };
    if (p.status === 'Blocked') reasons.push('Status set to Blocked');
    const odT = ts.filter(taskOverdue); if (odT.length) reasons.push(odT.length + ' overdue task' + (odT.length > 1 ? 's' : ''));
    const odM = (p.milestones || []).filter(m => m.status !== 'Completed' && isDate(m.due) && daysFromToday(m.due) < 0); if (odM.length) reasons.push(odM.length + ' overdue milestone' + (odM.length > 1 ? 's' : ''));
    const deps = S.dependencies.filter(d => d.projectId === p.id && d.status !== 'Closed' && d.status !== 'Resolved');
    const odD = deps.filter(d => isDate(d.requiredBy) && daysFromToday(d.requiredBy) < 0); if (odD.length) reasons.push(odD.length + ' dependency past required-by date');
    if (reasons.length) return { rag: 'Red', reasons };
    const started = p.status !== 'Not Started' || ts.some(t => t.status !== 'Not Started');
    if (!started) return { rag: 'Grey', reasons: ['Not started'] };
    const amber = [];
    const soonM = (p.milestones || []).filter(m => m.status !== 'Completed' && isDate(m.due) && daysFromToday(m.due) <= 7);
    soonM.forEach(m => {
      const mt = ts.filter(t => t.ms === m.id);
      const prog = mt.length ? Math.round(mt.reduce((a, t) => a + (t.status === 'Completed' ? 100 : +t.progress || 0), 0) / mt.length) : 0;
      if (prog < 50) amber.push('Milestone "' + m.name + '" due in ' + daysFromToday(m.due) + 'd at ' + prog + '% task progress');
    });
    const soonT = ts.filter(t => t.status !== 'Completed' && isDate(t.due) && daysFromToday(t.due) <= 7 && (+t.progress || 0) < 50 && (t.priority === 'P0' || t.priority === 'P1'));
    if (soonT.length) amber.push(soonT.length + ' P0/P1 task' + (soonT.length > 1 ? 's' : '') + ' due within 7 days with <50% progress');
    const soonD = deps.filter(d => isDate(d.requiredBy) && daysFromToday(d.requiredBy) <= 14);
    if (soonD.length) amber.push(soonD.length + ' open dependency due within 14 days');
    const lu = lastUpdate(p.id);
    const ageOk = lu && (Date.now() - new Date(lu.ts).getTime()) / 86400000 <= 14;
    if (!ageOk && p.status === 'In Progress') amber.push(lu ? 'No owner update in 14+ days' : 'No weekly owner update submitted yet');
    if (isTBD(p.accountable)) amber.push('No confirmed Accountable owner');
    if (p.status === 'On Hold') amber.push('On hold');
    if (amber.length) return { rag: 'Amber', reasons: amber };
    return { rag: 'Green', reasons: ['On track'] };
  }
  function raciIssues() {
    const out = [];
    S.projects.forEach(p => {
      (p.raci || []).forEach(r => {
        if (isTBD(r.A)) out.push({ projectId: p.id, item: r.item, issue: 'Missing Accountable', sev: 'red' });
        else if (/\/|,| or /i.test(r.A)) out.push({ projectId: p.id, item: r.item, issue: 'Conflicting accountability (more than one named)', sev: 'red' });
        if (!(r.R || []).filter(x => !isTBD(x)).length) out.push({ projectId: p.id, item: r.item, issue: 'No confirmed Responsible', sev: 'amber' });
      });
      if (!(p.raci || []).length) out.push({ projectId: p.id, item: '(project)', issue: 'No RACI defined', sev: 'red' });
    });
    S.tasks.forEach(t => {
      if (t.status !== 'Completed' && isTBD(t.owner)) out.push({ projectId: t.projectId, item: t.id + ' ' + t.name, issue: 'Task has no Responsible owner', sev: 'amber' });
    });
    return out;
  }
  const openDec = d => !['Closed', 'Decided'].includes(d.status);
  const closedDecStatus = () => opt('decisionStatuses').includes('Decided') ? 'Decided' : 'Closed';
  function stats() {
    const hs = S.projects.map(p => ({ p, h: health(p) }));
    return {
      total: S.projects.length,
      active: S.projects.filter(p => p.status === 'In Progress').length,
      notStarted: S.projects.filter(p => p.status === 'Not Started').length,
      atRisk: hs.filter(x => x.h.rag === 'Amber').length,
      delayed: hs.filter(x => x.h.rag === 'Red').length,
      completed: S.projects.filter(p => p.status === 'Completed').length,
      decisions: S.decisions.filter(openDec).length,
      deps: S.dependencies.filter(d => d.status === 'Open' || d.status === 'Escalated').length,
      overdue: S.tasks.filter(taskOverdue).length,
      hs
    };
  }
  function actionQueue() {
    const items = [];
    S.tasks.filter(taskOverdue).forEach(t => items.push({ rank: 1, type: 'Overdue task', ref: t.id, text: t.name, owner: t.owner, project: t.projectId, due: t.due, prio: t.priority, go: { v: 'project', id: t.projectId, tab: 'tasks' } }));
    S.risks.filter(r => r.status === 'Open' && r.impact === 'High' && r.probability === 'High').forEach(r => items.push({ rank: 2, type: 'Critical risk', ref: r.id, text: r.desc, owner: r.owner, project: r.projectId, due: r.deadline, prio: 'P0', go: { v: 'risks' } }));
    S.dependencies.filter(d => (d.status === 'Open' || d.status === 'Escalated') && (/^yes/i.test(d.escalation || '') || (isDate(d.requiredBy) && daysFromToday(d.requiredBy) <= 7))).forEach(d => items.push({ rank: 2, type: 'Blocking dependency', ref: d.id, text: d.desc, owner: d.externalOwner, project: d.projectId, due: d.requiredBy, prio: 'P0', go: { v: 'risks', tab: 'deps' } }));
    S.projects.filter(p => p.status === 'Blocked').forEach(p => items.push({ rank: 2, type: 'Blocked project', ref: p.id, text: p.name, owner: p.owner, project: p.id, due: p.due, prio: p.priority, go: { v: 'project', id: p.id } }));
    S.decisions.filter(openDec).forEach(d => items.push({ rank: 3, type: 'Pending decision', ref: d.id, text: d.decision, owner: d.owner, project: d.projectId, due: d.requiredBy, prio: isDate(d.requiredBy) && daysFromToday(d.requiredBy) <= 7 ? 'P0' : 'P1', go: { v: 'decisions' } }));
    S.tasks.filter(t => t.status !== 'Completed' && !taskOverdue(t) && isDate(t.due) && daysFromToday(t.due) <= 7).forEach(t => items.push({ rank: 4, type: 'Due within 7 days', ref: t.id, text: t.name, owner: t.owner, project: t.projectId, due: t.due, prio: t.priority, go: { v: 'project', id: t.projectId, tab: 'tasks' } }));
    S.projects.forEach(p => (p.milestones || []).filter(m => m.status !== 'Completed' && isDate(m.due) && daysFromToday(m.due) <= 7 && daysFromToday(m.due) >= 0).forEach(m => items.push({ rank: 4, type: 'Milestone due', ref: m.id, text: m.name, owner: p.owner, project: p.id, due: m.due, prio: p.priority, go: { v: 'project', id: p.id, tab: 'plan' } })));
    S.tasks.filter(t => t.status !== 'Completed' && (t.priority === 'P0' || t.priority === 'P1') && isTBD(t.owner) && !taskOverdue(t) && !(isDate(t.due) && daysFromToday(t.due) <= 7)).forEach(t => items.push({ rank: 5, type: 'High-priority, unassigned', ref: t.id, text: t.name, owner: t.owner, project: t.projectId, due: t.due, prio: t.priority, go: { v: 'project', id: t.projectId, tab: 'tasks' } }));
    return items.sort((a, b) => a.rank - b.rank || (a.due || 'z').localeCompare(b.due || 'z'));
  }

  // ---------- navigation ----------
  const PTAB_ALIAS = { charter: 'summary', tasks: 'plan', raci: 'people', history: 'updates' };

  function go(v, params) {
    params = params || {};
    if (v === 'risks') { v = 'decisions'; UI.riskTab = params.tab || 'risks'; }
    else if (v === 'decisions') { UI.riskTab = params.tab || 'decisions'; }
    else if (v === 'timeline') { v = 'portfolio'; UI.pmode = 'timeline'; }
    UI.view = v;
    if (params.id !== undefined) UI.projectId = params.id;
    if (v === 'project') UI.ptab = PTAB_ALIAS[params.tab] || params.tab || 'summary';
    if (v === 'portfolio' && params.chip) { UI.pchip = params.chip; UI.pmode = 'list'; }
    if (v === 'tasks' && params.tab) UI.taskFilter = params.tab;
    window.scrollTo(0, 0);
    render();
  }

  // ---------- render root ----------
  const NAV = [['overview', 'Home'], ['portfolio', 'Projects'], ['tasks', 'Tasks'], ['decisions', 'Decisions & risks'], ['weekly', 'Weekly review']];
  const NAV_MORE = [['actions', 'Action plan'], ['raci', 'Who does what'], ['governance', 'How we work'], ['data', 'Data & settings']];
  const ICON = {
    overview: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
    portfolio: '<path d="M4 5h16v3H4zm0 5.5h16v3H4zM4 16h16v3H4z"/>',
    tasks: '<path d="m9.5 16.2-4-4L4 13.7l5.5 5.5L20.5 8.2 19 6.7z"/>',
    decisions: '<path d="M12 2 4 5.5V11c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5.5zm-1 14.2-3.7-3.7 1.4-1.4 2.3 2.3 5.3-5.3 1.4 1.4z"/>',
    more: '<path d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>'
  };
  const ico = k => '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">' + (ICON[k] || '') + '</svg>';
  const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  function moreMenu(id) {
    return '<div class="menu" id="menu-' + id + '" role="menu">' + NAV_MORE.map(n => '<button role="menuitem" data-act="nav" data-v="' + n[0] + '">' + n[1] + '</button>').join('') + '</div>';
  }

  function renderNav(st) {
    const on = v => UI.view === v || (UI.view === 'project' && v === 'portfolio');
    const moreOn = NAV_MORE.some(n => n[0] === UI.view);
    const missing = weeklyRows().filter(r => r.stale && r.p.status === 'In Progress').length;
    const badge = { decisions: st.decisions, weekly: missing };
    $('#nav').innerHTML = NAV.map(n => '<button data-act="nav" data-v="' + n[0] + '" class="' + (on(n[0]) ? 'on' : '') + '"' + (on(n[0]) ? ' aria-current="page"' : '') + '>' + n[1] + (badge[n[0]] ? '<span class="count">' + badge[n[0]] + '</span>' : '') + '</button>').join('') +
      '<div class="menu-wrap"><button class="' + (moreOn ? 'on' : '') + '" data-act="menu" data-m="more" aria-haspopup="true" aria-expanded="false">More</button>' + moreMenu('more') + '</div>';
    const tabs = [['overview', 'Home'], ['portfolio', 'Projects'], ['tasks', 'Tasks'], ['decisions', 'Decisions']];
    $('#tabbar').innerHTML = tabs.map(n => '<button data-act="nav" data-v="' + n[0] + '" class="' + (on(n[0]) ? 'on' : '') + '"' + (on(n[0]) ? ' aria-current="page"' : '') + '>' + ico(n[0]) + '<span>' + n[1] + '</span></button>').join('') +
      '<div class="menu-wrap"><button class="' + (moreOn || UI.view === 'weekly' ? 'on' : '') + '" data-act="menu" data-m="more-m" aria-haspopup="true" aria-expanded="false">' + ico('more') + '<span>More</span></button><div class="menu" id="menu-more-m" role="menu"><button role="menuitem" data-act="nav" data-v="weekly">Weekly review</button>' + NAV_MORE.map(n => '<button role="menuitem" data-act="nav" data-v="' + n[0] + '">' + n[1] + '</button>').join('') + '</div></div>';
  }

  function renderMe() {
    const list = people();
    const opts = '<option value="">Everyone</option>' + list.map(p => '<option ' + (UI.me === p ? 'selected' : '') + '>' + esc(p) + '</option>').join('');
    $('#me').innerHTML = opts;
    $('#me-btn').innerHTML = UI.me ? esc(initials(UI.me)) : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.3-8 5.2V21h16v-1.8c0-2.9-3.6-5.2-8-5.2z"/></svg>';
    $('#me-btn').setAttribute('aria-label', UI.me ? 'Signed in view: ' + UI.me : 'Choose your name');
  }

  function render() {
    const ae = document.activeElement;
    const keep = ae && ae.closest && ae.closest('#main') && ae.dataset && ae.dataset.act ? '[data-act="' + ae.dataset.act + '"][data-id="' + ae.dataset.id + '"]' : null;
    const st = stats();
    const aq = actionQueue();
    renderNav(st);
    renderMe();
    const R = {
      overview: vOverview, actions: vActions, portfolio: vPortfolio,
      tasks: vTasks, raci: vRaci, decisions: vDecisions, weekly: vWeekly,
      governance: vGovernance, data: vData, project: vProject
    };
    $('#main').innerHTML = (R[UI.view] || vOverview)(st, aq);
    if (keep) { try { const n = $(keep); if (n) n.focus(); } catch (e) { /* selector unavailable */ } }
    if (window.SYNC && window.SYNC.updateUI) window.SYNC.updateUI();
  }

  // ---------- shared pieces ----------
  const initials = n => String(n).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const mineMatch = v => !UI.me || String(v || '').includes(UI.me);

  function whoParts(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s || /^tbd$/i.test(s)) return { name: 'No owner yet', open: true };
    const m = /^tbd\s*[—–-]\s*(?:proposed:\s*)?(.+)$/i.exec(s);
    if (m) return { name: m[1], proposed: true };
    return { name: s };
  }
  function who(v) {
    const w = whoParts(v);
    if (w.open) return '<span class="who none">' + esc(w.name) + '</span>';
    if (w.proposed) return '<span class="who proposed" title="Proposed, not confirmed: ' + esc(w.name) + '">' + esc(w.name) + '</span>';
    return '<span class="who" title="' + esc(w.name) + '">' + esc(w.name) + '</span>';
  }
  function when(s, closed) {
    if (!s || !isDate(s)) return '<span class="when none">No date</span>';
    const d = daysFromToday(s);
    const date = new Date(s + 'T00:00:00');
    const sameYear = date.getFullYear() === new Date().getFullYear();
    let label = date.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
    if (!closed && d < 0) return '<span class="when late" title="' + esc(label) + '">' + plural(Math.abs(d), 'day') + ' late</span>';
    if (closed) return '<span class="when">' + label + '</span>';
    if (d === 0) return '<span class="when soon">Today</span>';
    if (d === 1) return '<span class="when soon">Tomorrow</span>';
    if (d <= 6) return '<span class="when soon" title="' + esc(label) + '">' + date.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + label + '</span>';
    return '<span class="when">' + label + '</span>';
  }
  const chip = (act, attrs, label, n, active) => '<button class="chip' + (active ? ' on' : '') + '" data-act="' + act + '" ' + attrs + ' aria-pressed="' + !!active + '">' + esc(label) + (n != null ? '<span>' + n + '</span>' : '') + '</button>';
  const seg = (act, items, cur) => '<div class="seg" role="group">' + items.map(i => '<button data-act="' + act + '" data-tab="' + i[0] + '" class="' + (cur === i[0] ? 'on' : '') + '" aria-pressed="' + (cur === i[0]) + '">' + esc(i[1]) + (i[2] != null ? '<span>' + i[2] + '</span>' : '') + '</button>').join('') + '</div>';
  const filterSel = (k, label, opts) => '<label class="fsel"><span>' + esc(label) + '</span><select data-act="filter" data-k="' + k + '"><option value="">All</option>' + opts.map(o => '<option value="' + esc(o[0]) + '" ' + (UI.filters[k] === o[0] ? 'selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
  const emptyLine = (title, hint, btn) => '<div class="empty"><b>' + esc(title) + '</b>' + (hint ? '<span>' + esc(hint) + '</span>' : '') + (btn || '') + '</div>';

  function group(key, title, count, body, defOpen, tone) {
    const open = UI.open[key] !== undefined ? UI.open[key] : defOpen;
    return '<section class="g"><button class="g-h' + (open ? ' open' : '') + '" data-act="group" data-k="' + esc(key) + '" aria-expanded="' + !!open + '">' + CHEV + '<span class="g-t ' + (tone || '') + '">' + esc(title) + '</span><span class="g-n">' + count + '</span></button>' + (open ? '<div class="rows">' + body + '</div>' : '') + '</section>';
  }

  // ---------- rows ----------
  function taskRow(t, o) {
    o = o || {};
    const done = t.status === 'Completed';
    return '<div class="r r-task' + (done ? ' is-done' : '') + (t.parent ? ' is-sub' : '') + '" data-act="edit-task" data-id="' + esc(t.id) + '">' +
      '<input class="tick" type="checkbox" data-act="task-done" data-id="' + esc(t.id) + '" ' + (done ? 'checked' : '') + ' aria-label="Mark done: ' + esc(t.name) + '">' +
      '<span class="r-main"><button class="r-t" data-act="edit-task" data-id="' + esc(t.id) + '">' + esc(t.name) + '</button>' + (o.noProject ? '' : '<span class="r-s">' + esc(pName(t.projectId)) + '</span>') + '</span>' +
      '<span class="r-p">' + pillPrio(t.priority) + '</span>' +
      '<span class="r-who">' + who(t.owner) + '</span>' +
      '<span class="r-when">' + when(t.due, done) + '</span>' +
      '<span class="r-st"><select class="st" aria-label="Status of ' + esc(t.name) + '" data-act="task-status" data-id="' + esc(t.id) + '">' + opt('taskStatuses').map(s => '<option ' + (t.status === s ? 'selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></span></div>';
  }

  function decisionRow(d, o) {
    o = o || {};
    const open = openDec(d);
    return '<div class="r r-dec' + (open ? '' : ' is-done') + '" data-act="edit-decision" data-id="' + esc(d.id) + '">' +
      '<span class="mark ' + (open ? 'ring' : 'green') + '"></span>' +
      '<span class="r-main"><button class="r-t" data-act="edit-decision" data-id="' + esc(d.id) + '">' + esc(d.decision) + '</button><span class="r-s">' + esc(open ? (o.noProject ? (d.impact || '') : (d.projectId ? pName(d.projectId) : 'Whole portfolio')) : (d.final || 'Closed')) + '</span></span>' +
      '<span class="r-who">' + who(d.owner) + '</span>' +
      '<span class="r-when">' + when(d.requiredBy, !open) + '</span>' +
      '<span class="r-do">' + (open ? '<button class="btn sm" data-act="edit-decision" data-id="' + esc(d.id) + '">Decide</button>' : pillStatus(d.status)) + '</span></div>';
  }

  const riskScore = r => { const s = { High: 3, Medium: 2, Low: 1 }; return (s[r.impact] || 1) * (s[r.probability] || 1); };
  const riskLevel = r => { const s = riskScore(r); return s >= 6 ? ['Critical', 'red'] : s >= 3 ? ['Significant', 'amber'] : ['Low', 'grey']; };

  function riskRow(r, o) {
    o = o || {};
    const lv = riskLevel(r);
    const closed = ['Resolved', 'Closed', 'Mitigated'].includes(r.status);
    return '<div class="r r-risk' + (closed ? ' is-done' : '') + '" data-act="edit-risk" data-id="' + esc(r.id) + '">' +
      '<span class="pill ' + lv[1] + '">' + lv[0] + '</span>' +
      '<span class="r-main"><button class="r-t" data-act="edit-risk" data-id="' + esc(r.id) + '">' + esc(r.desc) + '</button><span class="r-s">' + esc(o.noProject ? (r.mitigation || '') : pName(r.projectId)) + '</span></span>' +
      '<span class="r-who">' + who(r.owner) + '</span>' +
      '<span class="r-when">' + when(r.deadline, closed) + '</span>' +
      '<span class="r-do">' + pillStatus(r.status) + '</span></div>';
  }

  function depRow(d, o) {
    o = o || {};
    const closed = d.status === 'Closed' || d.status === 'Resolved';
    return '<div class="r r-dep' + (closed ? ' is-done' : '') + '" data-act="edit-dep" data-id="' + esc(d.id) + '">' +
      '<span class="mark ' + (closed ? 'green' : d.status === 'Escalated' ? 'red' : 'ring') + '"></span>' +
      '<span class="r-main"><button class="r-t" data-act="edit-dep" data-id="' + esc(d.id) + '">' + esc(d.desc) + '</button>' + (o.noProject ? '' : '<span class="r-s">' + esc(pName(d.projectId)) + '</span>') + '</span>' +
      '<span class="r-who">' + who(d.externalOwner) + '</span>' +
      '<span class="r-when">' + when(d.requiredBy, closed) + '</span>' +
      '<span class="r-do">' + pillStatus(d.status) + '</span></div>';
  }

  function projectRow(x) {
    const p = x.p, h = x.h, nm = nextMilestone(p), prog = projectProgress(p.id);
    const line = h.rag === 'Amber' || h.rag === 'Red' ? h.reasons[0] : (p.nextAction || p.objective || '');
    const nextDate = nm && isDate(nm.due) ? nm.due : p.due;
    return '<div class="r r-proj" data-act="open" data-id="' + esc(p.id) + '">' +
      '<span class="mark ' + h.rag.toLowerCase() + '" title="' + esc(RAG_WORD[h.rag]) + '"></span>' +
      '<span class="r-main"><button class="r-t" data-act="open" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button><span class="r-s">' + esc(line) + '</span></span>' +
      '<span class="r-p">' + pillPrio(p.priority) + '</span>' +
      '<span class="r-who">' + who(p.owner) + '</span>' +
      '<span class="r-when">' + (nextDate ? when(nextDate) : '<span class="when none">Ongoing</span>') + '</span>' +
      '<span class="r-prog"><span class="prog"><i style="width:' + prog + '%"></i></span><span>' + prog + '%</span></span></div>';
  }

  function queueRow(a) {
    const t = /^T-/.test(a.ref) ? S.tasks.find(x => x.id === a.ref) : null;
    if (t) return taskRow(t);
    return '<div class="r r-q" data-act="go" data-go=\'' + JSON.stringify(a.go).replace(/'/g, '&#39;') + '\'>' +
      '<span class="mark ' + (a.rank <= 2 ? 'red' : 'ring') + '"></span>' +
      '<span class="r-main"><button class="r-t" data-act="go" data-go=\'' + JSON.stringify(a.go).replace(/'/g, '&#39;') + '\'>' + esc(a.text) + '</button><span class="r-s">' + esc(a.type) + (a.project ? ' on ' + esc(pName(a.project)) : '') + '</span></span>' +
      '<span class="r-who">' + who(a.owner) + '</span>' +
      '<span class="r-when">' + when(a.due) + '</span></div>';
  }

  // ---------- Home ----------
  function vOverview(st, aq) {
    const me = UI.me;
    const dec = S.decisions.filter(d => openDec(d) && mineMatch(d.owner)).sort((a, b) => (a.requiredBy || 'z').localeCompare(b.requiredBy || 'z'));
    const slip = st.hs.filter(x => (x.h.rag === 'Red' || x.h.rag === 'Amber') && (!me || [x.p.owner, x.p.accountable, x.p.sponsor].some(mineMatch)))
      .sort((a, b) => (a.h.rag === 'Red' ? 0 : 1) - (b.h.rag === 'Red' ? 0 : 1) || String(a.p.priority).localeCompare(String(b.p.priority)));
    const dueAll = aq.filter(a => (a.rank === 1 || a.rank === 4) && mineMatch(a.owner));
    const late = dueAll.filter(a => a.rank === 1).length;
    const blocks = aq.filter(a => a.rank === 2 && (!me || mineMatch(a.owner)));

    const s1 = dec.length ? plural(dec.length, 'decision is', 'decisions are') + ' waiting' + (me ? ' on you' : '') : 'No decisions are waiting';
    const s2 = slip.length ? plural(slip.length, 'project is', 'projects are') + ' slipping' : 'no projects are slipping';
    const s3 = dueAll.length ? plural(dueAll.length, 'thing is', 'things are') + ' due this week' + (late ? ', ' + late + ' already late' : '') : 'nothing is due this week';
    const clear = !dec.length && !slip.length && !dueAll.length;

    const seen = { Red: 0, Amber: 0, Green: 0, Grey: 0 };
    st.hs.forEach(x => { if (x.p.status !== 'Completed') seen[x.h.rag]++; });
    const live = st.total - st.completed;
    const strip = [['Red', 'attention'], ['Amber', 'attention'], ['Green', 'Green'], ['Grey', 'Grey']].filter(k => seen[k[0]]);
    const noOwner = S.projects.filter(p => isTBD(p.owner)).length;

    const sect = (title, n, rows, all, emptyText) => '<section class="home-s"><div class="s-h"><h2>' + esc(title) + '</h2>' + (n > rows.length ? all : '') + '</div>' + (rows.length ? '<div class="rows">' + rows.join('') + '</div>' : '<p class="quiet">' + esc(emptyText) + '</p>') + '</section>';

    return `
    <div class="home">
      <p class="today">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      ${clear ? '<h1 class="say">Nothing needs you today.</h1>' : `<h1 class="say">
        <button class="${dec.length ? 'u-blue' : ''}" data-act="go-decisions">${s1},</button>
        <button class="${slip.length ? 'u-amber' : ''}" data-act="go-attention">${s2},</button>
        <button class="${late ? 'u-red' : dueAll.length ? 'u-ink' : ''}" data-act="go-week">and ${s3}.</button>
      </h1>`}
      <div class="strip" role="img" aria-label="${live} live projects: ${seen.Red} delayed, ${seen.Amber} at risk, ${seen.Green} on track, ${seen.Grey} not started">
        ${strip.map(k => '<button class="seg-' + k[0].toLowerCase() + '" style="flex:' + seen[k[0]] + '" data-act="go-chip" data-chip="' + k[1] + '" title="' + esc(RAG_WORD[k[0]]) + '" aria-label="' + seen[k[0]] + ' ' + esc(RAG_WORD[k[0]]) + '"></button>').join('')}
      </div>
      <p class="strip-key">${live} live projects: ${['Red', 'Amber', 'Green', 'Grey'].filter(k => seen[k]).map(k => '<span class="key"><i class="k-' + k.toLowerCase() + '"></i>' + seen[k] + ' ' + RAG_WORD[k].toLowerCase() + '</span>').join('')}</p>
      ${me ? '' : '<p class="whoami">Showing everyone\'s work. <label>See only yours: <select data-act="set-me" aria-label="Choose your name"><option value="">Choose your name</option>' + people().map(p => '<option>' + esc(p) + '</option>').join('') + '</select></label></p>'}
      ${noOwner ? '<p class="flag"><span>' + (noOwner === st.total ? 'None of the ' + st.total + ' projects has' : noOwner + ' of ' + st.total + ' projects have no') + ' a confirmed owner.</span> <button class="linkbtn" data-act="go-portfolio">Assign owners</button></p>'.replace('have no a confirmed', 'have no confirmed') : ''}
      ${sect(me ? 'Your decisions' : 'Decisions waiting', dec.length, dec.slice(0, 4).map(d => decisionRow(d)), '<button class="linkbtn" data-act="go-decisions">See all ' + dec.length + '</button>', 'No decisions are waiting.')}
      ${sect('Slipping', slip.length, slip.slice(0, 4).map(projectRow), '<button class="linkbtn" data-act="go-attention">See all ' + slip.length + '</button>', 'Every project is on track.')}
      ${sect('Due this week', dueAll.length, dueAll.slice(0, 4).map(queueRow), '<button class="linkbtn" data-act="go-week">See all ' + dueAll.length + '</button>', 'Nothing is due in the next 7 days.')}
      ${blocks.length ? sect('Blocking work', blocks.length, blocks.slice(0, 4).map(queueRow), '<button class="linkbtn" data-act="nav" data-v="actions">See all ' + blocks.length + '</button>', '') : ''}
    </div>`;
  }

  // ---------- Action plan ----------
  function vActions(st, aq) {
    const t = UI.actionTab;
    const tabs = [['queue', 'What needs attention', aq.length], ['plan', 'Planned actions', S.actions.length]];
    let body;
    if (t === 'queue') {
      const lvl = [['Late', a => a.rank === 1, 'late', true], ['Blocking work', a => a.rank === 2, 'late', true], ['Decisions to make', a => a.rank === 3, '', true], ['Due within 7 days', a => a.rank === 4, '', false], ['Important, no owner', a => a.rank === 5, '', false]];
      body = lvl.map(l => { const items = aq.filter(l[1]); return items.length ? group('q-' + l[0], l[0], items.length, items.map(queueRow).join(''), l[3], l[2]) : ''; }).join('') || emptyLine('Nothing needs attention', 'New items appear here as dates approach.');
    } else {
      const row = a => '<div class="r r-act" data-act="edit-action" data-id="' + esc(a.id) + '"><span class="r-p">' + pillPrio(a.priority) + '</span><span class="r-main"><button class="r-t" data-act="edit-action" data-id="' + esc(a.id) + '">' + esc(a.action) + '</button><span class="r-s">' + esc(a.why || '') + '</span></span><span class="r-who">' + esc(a.ownerRole || '') + '</span><span class="r-when"><span class="when">' + esc(a.timeline || '') + '</span></span></div>';
      body = opt('actionBuckets').map(b => {
        const items = S.actions.filter(a => a.bucket === b).sort((x, y) => String(x.priority || '').localeCompare(String(y.priority || '')));
        return items.length ? group('a-' + b, b, items.length, items.map(row).join(''), b === 'Implement immediately') : '';
      }).join('');
    }
    return `<div class="page-h"><h1>Action plan</h1><button class="btn primary no-print" data-act="add-action">Add action</button></div>
      <div class="bar-row">${seg('atab', tabs, t)}</div>${body}`;
  }

  // ---------- Projects ----------
  function vPortfolio(st) {
    if (UI.pmode === 'timeline') return portfolioHead() + vTimeline();
    const f = UI.filters;
    let rows = st.hs.slice();
    ['category', 'priority', 'status', 'type', 'program'].forEach(k => { if (f[k]) rows = rows.filter(r => k === 'program' ? (f[k] === 'none' ? !r.p.program : r.p.program === f[k]) : r.p[k] === f[k]); });
    if (f.owner) rows = rows.filter(r => r.p.owner === f.owner || r.p.accountable === f.owner);
    const attention = x => x.h.rag === 'Red' || x.h.rag === 'Amber';
    const isDone = x => x.p.status === 'Completed';
    const chips = [
      ['all', 'All', rows.length], ['attention', 'Needs attention', rows.filter(attention).length],
      ['Green', 'On track', rows.filter(x => x.h.rag === 'Green' && !isDone(x)).length],
      ['Grey', 'Not started', rows.filter(x => x.h.rag === 'Grey').length], ['done', 'Done', rows.filter(isDone).length]
    ];
    const test = { all: () => true, attention, Green: x => x.h.rag === 'Green' && !isDone(x), Grey: x => x.h.rag === 'Grey', done: isDone };
    rows = rows.filter(test[UI.pchip] || test.all);
    const sk = UI.sort.portfolio || 'priority';
    const key = { priority: x => String(x.p.priority), due: x => (nextMilestone(x.p) || {}).due || x.p.due || 'z', name: x => x.p.name.toLowerCase(), progress: x => -projectProgress(x.p.id) };
    rows.sort((a, b) => { const x = key[sk](a), y = key[sk](b); return x > y ? 1 : x < y ? -1 : 0; });

    const active = ['category', 'priority', 'status', 'type', 'program', 'owner'].filter(k => f[k]).length;
    const showF = UI.showFilters || active > 0;
    const filters = showF ? '<div class="filters">' +
      filterSel('category', 'Category', opt('categories').map(c => [c, c])) +
      filterSel('priority', 'Priority', opt('priorities').map(p => [p, p])) +
      filterSel('status', 'Status', opt('projectStatuses').map(s => [s, s])) +
      filterSel('type', 'Type', opt('projectTypes').map(t => [t, t])) +
      filterSel('program', 'Program', [['none', 'No program']].concat((S.programs || []).map(p => [p.id, p.name]))) +
      filterSel('owner', 'Owner', people().map(p => [p, p])) +
      (active ? '<button class="linkbtn" data-act="clear-filters">Clear filters</button>' : '') + '</div>' : '';
    const head = '<div class="r r-proj r-head" aria-hidden="true"><span></span><span>Project</span><span>Priority</span><span>Owner</span><span>Next date</span><span>Tasks done</span></div>';
    const sections = UI.pchip === 'all' && sk === 'priority' ? [['Needs attention', attention, 'late'], ['On track', test.Green, ''], ['Not started', test.Grey, ''], ['Done', isDone, '']] : null;
    let headUsed = false;
    const headOnce = () => { if (headUsed) return ''; headUsed = true; return head; };
    const list = !rows.length ? emptyLine('No projects match', 'Try another filter, or clear them.', active ? '<button class="btn sm" data-act="clear-filters">Clear filters</button>' : '')
      : sections ? sections.map(s => { const r = rows.filter(s[1]); return r.length ? group('p-' + s[0], s[0], r.length, headOnce() + r.map(projectRow).join(''), s[0] !== 'Done', s[2]) : ''; }).join('')
        : '<div class="rows">' + head + rows.map(projectRow).join('') + '</div>';

    return portfolioHead() + `
      <div class="bar-row">
        <div class="chips">${chips.filter(c => c[0] === 'all' || c[2] || UI.pchip === c[0]).map(c => chip('pchip', 'data-h="' + c[0] + '"', c[1], c[2], UI.pchip === c[0])).join('')}</div>
        <div class="bar-end">
          <label class="fsel"><span>Sort</span><select data-act="sort-sel" data-t="portfolio">${[['priority', 'Priority'], ['due', 'Next date'], ['name', 'Name'], ['progress', 'Tasks done']].map(o => '<option value="' + o[0] + '" ' + (sk === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('')}</select></label>
          <button class="btn sm" data-act="toggle-filters" aria-expanded="${showF}">Filters${active ? ' (' + active + ')' : ''}</button>
        </div>
      </div>
      ${filters}${list}`;
  }

  function portfolioHead() {
    return '<div class="page-h"><h1>Projects</h1>' + seg('pmode', [['list', 'List'], ['timeline', 'Timeline']], UI.pmode) + '</div>';
  }

  function vProject() {
    const p = P(UI.projectId);
    if (!p) return '<button class="back" data-act="nav" data-v="portfolio">Projects</button>' + emptyLine('This project no longer exists', 'It may have been removed in the Google Sheet.');
    const h = health(p), prog = projectProgress(p.id), ts = pTasks(p.id);
    const openT = ts.filter(t => t.status !== 'Completed');
    const nm = nextMilestone(p);
    const decs = S.decisions.filter(d => openDec(d) && d.projectId === p.id);
    const rs = S.risks.filter(r => r.projectId === p.id), ds = S.dependencies.filter(d => d.projectId === p.id);
    const openRisks = rs.filter(r => r.status === 'Open' || r.status === 'Escalated').length + ds.filter(d => d.status === 'Open' || d.status === 'Escalated').length;
    const tabs = [['summary', 'Summary'], ['plan', 'Plan', openT.length], ['risks', 'Risks', openRisks], ['updates', 'Updates', S.updates.filter(u => u.projectId === p.id).length + (p.comments || []).length], ['people', 'People']];
    const tab = UI.ptab;
    const pg = p.program ? (S.programs.find(x => x.id === p.program) || {}).name : '';
    let body = '';

    if (tab === 'summary') {
      const dl = pairs => '<dl class="dl">' + pairs.filter(x => x[1]).map(x => '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>').join('') + '</dl>';
      const ul = a => (a || []).length ? '<ul class="list">' + a.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
      body = `
        ${p.nextAction ? '<div class="next"><h2>Next action</h2><p>' + esc(p.nextAction) + '</p></div>' : ''}
        ${h.rag === 'Amber' || h.rag === 'Red' ? '<section class="sec"><h2>Why it is ' + esc(RAG_WORD[h.rag].toLowerCase()) + '</h2><ul class="list">' + h.reasons.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></section>' : ''}
        ${decs.length ? '<section class="sec"><h2>Decisions waiting</h2><div class="rows">' + decs.map(d => decisionRow(d, { noProject: true })).join('') + '</div></section>' : ''}
        <section class="sec"><h2>What this project is for</h2>${dl([['Objective', esc(p.objective)], ['Expected outcome', esc(p.outcome)], ['Success measures', ul(p.metrics)]])}</section>
        <details class="acc"><summary>${CHEV}Full charter</summary><div class="acc-bd">${dl([
        ['Problem', esc(p.problem)], ['Business impact', esc(p.impact)], ['Category', esc(p.category)], ['Type', esc(p.type)], ['Program', esc(pg)], ['Value class', esc(p.valueClass)],
        ['Priority', esc(p.priority) + (p.priorityProposed ? ' (proposed)' : '')], ['Why this priority', esc(p.priorityRationale)],
        ['Start', p.start ? fmt(p.start) + (p.datesProposed ? ' (proposed)' : '') : ''], ['Target end', p.due ? fmt(p.due) + (p.datesProposed ? ' (proposed)' : '') : 'Ongoing'],
        ['Hypothesis', esc(p.hypothesis)], ['Test period', esc(p.testPeriod)], ['Success criteria', esc(p.successCriteria)], ['Baseline', esc(p.baseline)], ['Cadence', esc(p.cadence)], ['To clarify', esc(p.clarification)],
        ['Depends on', ul(p.dependencies)], ['Known risks', ul(p.risks)], ['Assumptions', ul(p.assumptions)], ['Flags', (p.flags || []).map(esc).join(', ')]
      ])}</div></details>`;
    } else if (tab === 'plan') {
      const withSubs = list => list.map(t => taskRow(t, { noProject: true }) + S.tasks.filter(x => x.parent === t.id).map(x => taskRow(x, { noProject: true })).join('')).join('');
      const tops = ts.filter(t => !t.parent);
      const seen = new Set();
      const msBlock = m => {
        const mt = tops.filter(t => t.ms === m.id); mt.forEach(t => seen.add(t.id));
        const d = daysFromToday(m.due); const late = m.status !== 'Completed' && d != null && d < 0;
        return '<div class="ms"><div class="r r-ms" data-act="edit-ms" data-id="' + esc(p.id) + '" data-ms="' + esc(m.id) + '"><span class="mark ' + (m.status === 'Completed' ? 'green' : late ? 'red' : 'diamond') + '"></span><span class="r-main"><button class="r-t" data-act="edit-ms" data-id="' + esc(p.id) + '" data-ms="' + esc(m.id) + '">' + esc(m.name) + '</button></span><span class="r-when">' + when(m.due, m.status === 'Completed') + '</span><span class="r-do">' + pillStatus(m.status) + '</span></div>' + withSubs(mt) + '</div>';
      };
      const blocks = (p.workstreams || []).map(w => {
        const mss = (p.milestones || []).filter(m => m.ws === w.id);
        const inner = mss.map(msBlock).join('');
        return '<section class="ws"><div class="s-h"><h2>' + esc(w.name) + '</h2><button class="linkbtn" data-act="edit-ws" data-id="' + esc(p.id) + '" data-ws="' + esc(w.id) + '">Edit</button></div>' + (inner || '<p class="quiet">No milestones yet.</p>') + '</section>';
      }).join('');
      const orphanMs = (p.milestones || []).filter(m => !ws(p, m.ws));
      const orphanHtml = orphanMs.length ? '<section class="ws"><div class="s-h"><h2>Other milestones</h2></div>' + orphanMs.map(msBlock).join('') + '</section>' : '';
      const loose = tops.filter(t => !seen.has(t.id));
      const looseHtml = loose.length ? '<section class="ws"><div class="s-h"><h2>Other tasks</h2></div><div class="rows">' + withSubs(loose) + '</div></section>' : '';
      body = '<div class="bar-row no-print"><p class="quiet">' + ts.filter(t => t.status === 'Completed').length + ' of ' + plural(ts.length, 'task') + ' done</p><div class="bar-end"><button class="btn sm" data-act="add-ws" data-id="' + esc(p.id) + '">Add workstream</button><button class="btn sm" data-act="add-ms" data-id="' + esc(p.id) + '">Add milestone</button><button class="btn sm primary" data-act="add-task" data-pid="' + esc(p.id) + '">Add task</button></div></div>' +
        (blocks + orphanHtml + looseHtml || emptyLine('Nothing planned yet', 'Add a milestone or a first task to get this moving.'));
    } else if (tab === 'risks') {
      body = '<section class="sec"><div class="s-h"><h2>Risks</h2><button class="btn sm" data-act="add-risk" data-pid="' + esc(p.id) + '">Add risk</button></div>' + (rs.length ? '<div class="rows">' + rs.slice().sort((a, b) => riskScore(b) - riskScore(a)).map(r => riskRow(r, { noProject: true })).join('') + '</div>' : '<p class="quiet">No risks logged.</p>') + '</section>' +
        '<section class="sec"><div class="s-h"><h2>Waiting on others</h2><button class="btn sm" data-act="add-dep" data-pid="' + esc(p.id) + '">Add dependency</button></div>' + (ds.length ? '<div class="rows">' + ds.slice().sort(by('requiredBy')).map(d => depRow(d, { noProject: true })).join('') + '</div>' : '<p class="quiet">Not waiting on anyone.</p>') + '</section>';
    } else if (tab === 'updates') {
      const ups = S.updates.filter(u => u.projectId === p.id).sort((a, b) => b.ts > a.ts ? 1 : -1);
      const acts = S.activity.filter(a => a.text.includes(p.id) || a.text.includes(p.name));
      const comments = (p.comments || []).map((c, idx) => '<div class="comment"><div class="c-h"><b>' + esc(c.who || 'Someone') + '</b><span class="quiet">' + new Date(c.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (c.editedAt ? ', edited' : '') + '</span><span class="c-acts no-print"><button class="linkbtn" data-act="edit-comment" data-pid="' + esc(p.id) + '" data-i="' + idx + '">Edit</button><button class="linkbtn danger" data-act="del-comment" data-pid="' + esc(p.id) + '" data-i="' + idx + '">Delete</button></span></div><p>' + esc(c.text) + '</p></div>').join('');
      body = '<section class="sec"><div class="s-h"><h2>Weekly updates</h2><button class="btn sm primary" data-act="add-update" data-pid="' + esc(p.id) + '">Add update</button></div>' + (ups.length ? ups.map(updateCard).join('') : '<p class="quiet">No updates yet. Active projects show as at risk until one is added.</p>') + '</section>' +
        '<section class="sec"><h2>Comments</h2><form data-act="add-comment" data-pid="' + esc(p.id) + '" class="c-form no-print"><input name="c" aria-label="Add a comment" placeholder="Add a comment" required>' + (UI.me ? '<input type="hidden" name="who" value="' + esc(UI.me) + '">' : '<input name="who" aria-label="Your name" placeholder="Your name">') + '<button class="btn">Post</button></form>' + comments + '</section>' +
        (acts.length ? '<details class="acc"><summary>' + CHEV + 'History (' + acts.length + ')</summary><div class="acc-bd">' + acts.map(a => '<div class="comment"><p>' + esc(a.text) + '</p><span class="quiet">' + new Date(a.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</span></div>').join('') + '</div></details>' : '');
    } else if (tab === 'people') {
      body = '<section class="sec"><dl class="dl"><dt>Owner</dt><dd>' + who(p.owner) + '</dd><dt>Accountable</dt><dd>' + who(p.accountable) + '</dd><dt>Sponsor</dt><dd>' + who(p.sponsor) + '</dd></dl></section>' +
        '<section class="sec"><div class="s-h"><h2>Who does what</h2><button class="btn sm" data-act="add-raci" data-id="' + esc(p.id) + '">Add row</button></div>' + raciTable(p) + '</section>';
    }

    return `<button class="back no-print" data-act="nav" data-v="portfolio">Projects</button>
      <div class="p-head">
        <div class="p-title"><h1>${esc(p.name)}</h1>
          <div class="p-tags">${pillRag(h.rag)}${pillStatus(p.status)}${pillPrio(p.priority)}</div></div>
        <div class="btnrow no-print"><button class="btn" data-act="edit-project" data-id="${esc(p.id)}">Edit</button>
          <div class="menu-wrap"><button class="btn icon" data-act="menu" data-m="proj" aria-haspopup="true" aria-expanded="false" aria-label="More project actions">${ico('more')}</button>
          <div class="menu right" id="menu-proj" role="menu"><button role="menuitem" data-act="print-project" data-id="${esc(p.id)}">Print report</button><button role="menuitem" class="danger" data-act="del-project" data-id="${esc(p.id)}">Delete project</button></div></div></div>
      </div>
      <dl class="facts">
        <div><dt>Owner</dt><dd>${who(p.owner)}</dd></div>
        <div><dt>Next milestone</dt><dd>${nm ? '<span class="clip" title="' + esc(nm.name) + '">' + esc(nm.name) + '</span>' + when(nm.due) : '<span class="when none">None set</span>'}</dd></div>
        <div><dt>Target end</dt><dd>${p.due ? when(p.due, p.status === 'Completed') : '<span class="when none">Ongoing</span>'}</dd></div>
        <div><dt>Tasks done</dt><dd><span class="r-prog"><span class="prog"><i style="width:${prog}%"></i></span><span>${prog}%</span></span></dd></div>
      </dl>
      <div class="tabs no-print" role="tablist">${tabs.map(t => '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-act="ptab" data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + (t[2] ? '<span>' + t[2] + '</span>' : '') + '</button>').join('')}</div>
      ${body}`;
  }

  function updateCard(u) {
    const line = (l, v) => v ? '<dt>' + l + '</dt><dd>' + esc(v) + '</dd>' : '';
    return '<article class="upd" data-act="edit-update" data-id="' + esc(u.id) + '"><div class="c-h"><b>Week of ' + fmt(u.week) + '</b>' + pillRag(u.rag || 'Grey') + '<span class="quiet">' + esc(u.author || '') + '</span><button class="linkbtn no-print" data-act="edit-update" data-id="' + esc(u.id) + '">Edit</button></div><dl class="dl">' + line('Done last week', u.progress) + line('Delivered', u.completed) + line('Blocked by', u.blockers) + line('Missed', u.missed) + line('Next week', u.next) + line('Needs a decision', u.decisions) + '</dl></article>';
  }

  // ---------- Tasks ----------
  function vTasks(st, aq) {
    const f = UI.taskFilter;
    const wk = t => t.status !== 'Completed' && isDate(t.due) && daysFromToday(t.due) <= 7;
    const F = {
      all: () => true, my: t => UI.me && ((t.owner || '').includes(UI.me) || (t.accountable || '').includes(UI.me)) && t.status !== 'Completed',
      overdue: taskOverdue, week: wk, pending: t => t.status !== 'Completed', completed: t => t.status === 'Completed',
      approval: t => (t.status === 'Awaiting Approval' || t.kind === 'Decision') && t.status !== 'Completed',
      unassigned: t => isTBD(t.owner) && t.status !== 'Completed'
    };
    const ff = UI.filters;
    const base = S.tasks.filter(t => (!ff.tproject || t.projectId === ff.tproject) && (!ff.tprio || t.priority === ff.tprio) && (!ff.towner || (t.owner || '').includes(ff.towner)));
    const count = k => base.filter(F[k]).length;
    const chips = [['pending', 'Open'], ['my', 'Mine'], ['week', 'Due this week']];
    if (S.tasks.some(taskOverdue)) chips.splice(1, 0, ['overdue', 'Late']);
    chips.push(['approval', 'Needs approval'], ['unassigned', 'No owner'], ['completed', 'Done']);
    const list = base.filter(F[f] || F.pending).sort((a, b) => (a.due || 'z').localeCompare(b.due || 'z') || String(a.priority).localeCompare(String(b.priority)));

    const active = ['tproject', 'tprio', 'towner'].filter(k => ff[k]).length;
    const narrow = active > 0 || f !== 'pending';
    let body;
    if (!list.length) {
      body = f === 'my' && !UI.me ? '' : emptyLine('No tasks here', f === 'pending' ? 'Add a task to get started.' : 'Try another view above.');
    } else if (UI.tgroup === 'project') {
      const ids = [...new Set(list.map(t => t.projectId))];
      body = ids.map(id => { const ts = list.filter(t => t.projectId === id); return group('tp-' + id, pName(id), ts.length, ts.map(t => taskRow(t, { noProject: true })).join(''), narrow); }).join('');
    } else {
      const d = t => isDate(t.due) ? daysFromToday(t.due) : null;
      const late = t => t.status !== 'Completed' && d(t) != null && d(t) < 0;
      const buckets = [
        ['Late', late, 'late', true],
        ['This week', t => !late(t) && d(t) != null && d(t) <= 7, '', true],
        ['Next 30 days', t => d(t) != null && d(t) > 7 && d(t) <= 30, '', narrow],
        ['Later', t => d(t) != null && d(t) > 30, '', narrow],
        ['No date', t => d(t) == null, '', narrow]
      ];
      body = buckets.map(b => { const ts = list.filter(b[1]); return ts.length ? group('t-' + b[0], b[0], ts.length, ts.map(t => taskRow(t)).join(''), b[3], b[2]) : ''; }).join('');
    }
    if (f === 'week') {
      const mil = aq.filter(a => a.type === 'Milestone due');
      if (mil.length) body += group('t-milestones', 'Milestones', mil.length, mil.map(queueRow).join(''), true);
    }
    const showF = UI.showFilters || active > 0;
    const filters = showF ? '<div class="filters">' +
      filterSel('tproject', 'Project', S.projects.map(p => [p.id, p.name])) +
      filterSel('tprio', 'Priority', opt('priorities').map(p => [p, p])) +
      filterSel('towner', 'Owner', people().map(p => [p, p])) +
      (active ? '<button class="linkbtn" data-act="clear-filters">Clear filters</button>' : '') + '</div>' : '';

    return `<div class="page-h"><h1>Tasks</h1><button class="btn primary no-print" data-act="add-task">Add task</button></div>
      <div class="bar-row">
        <div class="chips">${chips.map(c => chip('tfilter', 'data-f="' + c[0] + '"', c[1], c[0] === 'my' && !UI.me ? null : count(c[0]), f === c[0])).join('')}</div>
        <div class="bar-end">
          <label class="fsel"><span>Group</span><select data-act="tgroup"><option value="due" ${UI.tgroup !== 'project' ? 'selected' : ''}>By date</option><option value="project" ${UI.tgroup === 'project' ? 'selected' : ''}>By project</option></select></label>
          <button class="btn sm" data-act="toggle-filters" aria-expanded="${showF}">Filters${active ? ' (' + active + ')' : ''}</button>
        </div>
      </div>
      ${filters}
      ${f === 'my' && !UI.me ? '<p class="whoami"><label>See your tasks: <select data-act="set-me" aria-label="Choose your name"><option value="">Choose your name</option>' + people().map(p => '<option>' + esc(p) + '</option>').join('') + '</select></label></p>' : ''}
      ${body}
      <p class="quiet foot">Names in italics are proposed, not confirmed. Click a task to see or change everything about it.</p>`;
  }

  // ---------- Who does what ----------
  function raciTable(p, filterFn) {
    const rows = (p.raci || []).filter(r => !filterFn || filterFn(r));
    if (!rows.length) return '<p class="quiet">Nothing here yet.</p>';
    const cell = arr => (arr || []).length ? arr.map(who).join('') : '<span class="who none">Nobody</span>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Does the work</th><th>Answerable</th><th>Consulted</th><th>Kept informed</th><th><span class="sr">Flags</span></th></tr></thead><tbody>' + rows.map(r => {
      const idx = p.raci.indexOf(r);
      const flags = [];
      if (isTBD(r.A)) flags.push('Needs someone answerable');
      else if (/\/|,| or /i.test(r.A)) flags.push('More than one answerable');
      if (!(r.R || []).filter(x => !isTBD(x)).length) flags.push('Nobody confirmed for the work');
      return '<tr data-act="edit-raci" data-id="' + esc(p.id) + '" data-i="' + idx + '"><td><button class="r-t" data-act="edit-raci" data-id="' + esc(p.id) + '" data-i="' + idx + '">' + esc(r.item) + '</button></td><td>' + cell(r.R) + '</td><td>' + (r.A ? who(r.A) : '<span class="who none">Nobody</span>') + '</td><td>' + cell(r.C) + '</td><td>' + cell(r.I) + '</td><td class="flags">' + flags.map(x => '<span class="pill amber">' + esc(x) + '</span>').join('') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function vRaci() {
    const t = UI.raciTab;
    const issues = raciIssues();
    const f = UI.filters;
    const noOwner = issues.filter(i => i.issue.startsWith('Task')).length;
    let body;
    if (t === 'people') {
      body = '<div class="rows">' + S.roles.map(r => {
        const pOwned = S.projects.filter(p => p.owner === r.name || p.accountable === r.name).length;
        const tOwned = S.tasks.filter(x => (x.owner || '').includes(r.name)).length;
        const refs = [pOwned ? plural(pOwned, 'project') : '', tOwned ? plural(tOwned, 'task') : ''].filter(Boolean).join(', ') || 'Nothing assigned';
        return '<div class="r r-person" data-act="edit-role" data-id="' + esc(r.name) + '"><span class="av">' + esc(initials(r.name)) + '</span><span class="r-main"><button class="r-t" data-act="edit-role" data-id="' + esc(r.name) + '">' + esc(r.name) + '</button><span class="r-s">' + esc(r.note || '') + '</span></span><span class="r-who">' + esc(r.kind) + '</span><span class="r-when"><span class="when">' + refs + '</span></span></div>';
      }).join('') + '</div>';
    } else {
      const match = (p, r) => {
        if (f.rproject && p.id !== f.rproject) return false;
        if (f.rperson && ![].concat(r.R || [], [r.A], r.C || [], r.I || []).some(x => (x || '').includes(f.rperson))) return false;
        if (f.rdesig) {
          const m = { R: r.R || [], A: [r.A], C: r.C || [], I: r.I || [] }[f.rdesig];
          if (f.rperson ? !m.some(x => (x || '').includes(f.rperson)) : !m.filter(x => !isTBD(x)).length) return false;
        }
        if (f.rissue === 'missingA' && !isTBD(r.A) && !/\/|,| or /i.test(r.A)) return false;
        if (f.rissue === 'noR' && (r.R || []).filter(x => !isTBD(x)).length) return false;
        return true;
      };
      const projs = S.projects.filter(p => (p.raci || []).some(r => match(p, r)));
      const anyF = f.rproject || f.rperson || f.rdesig || f.rissue;
      body = '<div class="filters">' +
        filterSel('rproject', 'Project', S.projects.map(p => [p.id, p.name])) +
        filterSel('rperson', 'Person', people().map(p => [p, p])) +
        filterSel('rdesig', 'Role', [['R', 'Does the work'], ['A', 'Answerable'], ['C', 'Consulted'], ['I', 'Kept informed']]) +
        filterSel('rissue', 'Show', [['missingA', 'Needs someone answerable'], ['noR', 'Nobody confirmed for the work']]) +
        (anyF ? '<button class="linkbtn" data-act="clear-filters">Clear filters</button>' : '') + '</div>' +
        (noOwner ? '<p class="flag"><span>' + plural(noOwner, 'open task has', 'open tasks have') + ' no confirmed owner.</span> <button class="linkbtn" data-act="go-unassigned">See them</button></p>' : '') +
        (projs.length ? projs.map(p => group('rc-' + p.id, p.name, (p.raci || []).filter(r => match(p, r)).length, '<div class="in-g"><button class="btn sm" data-act="add-raci" data-id="' + esc(p.id) + '">Add row</button></div>' + raciTable(p, r => match(p, r)), !!anyF)).join('') : emptyLine('Nothing matches', 'Try another filter.'));
    }
    return `<div class="page-h"><h1>Who does what</h1><button class="btn primary no-print" data-act="add-role">Add person</button></div>
      <div class="bar-row">${seg('rctab', [['projects', 'By project'], ['people', 'People', S.roles.length]], t)}</div>${body}`;
  }

  // ---------- chart helpers (inline SVG, no dependencies) ----------
  function barChart(o) {
    const W = 640, H = o.height || 230, padL = 44, padR = 12, padT = 22, padB = 40;
    const n = o.cats.length; const cw = (W - padL - padR) / Math.max(1, n);
    const totals = o.cats.map((c, i) => o.stacked ? o.series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...o.series.map(s => s.values[i] || 0)));
    const max = Math.max(1, ...totals); const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10; const top = Math.ceil(max / step) * step;
    const y = v => padT + (H - padT - padB) * (1 - v / top);
    let g = '';
    for (let v = 0; v <= top; v += step) g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--border)"/><text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" font-size="12" fill="var(--muted)" text-anchor="end">' + v + '</text>';
    let bars = '';
    o.cats.forEach((c, i) => {
      const x0 = padL + i * cw;
      if (o.stacked) {
        let acc = 0;
        o.series.forEach(s => {
          const v = s.values[i] || 0; if (!v) return;
          const y1 = y(acc + v), y0 = y(acc);
          bars += '<rect x="' + (x0 + cw * .22) + '" y="' + y1 + '" width="' + (cw * .56) + '" height="' + Math.max(0, y0 - y1) + '" fill="' + s.color + '" rx="2"><title>' + esc(c + ' · ' + s.name + ': ' + v) + '</title></rect>';
          acc += v;
        });
        if (acc) bars += '<text x="' + (x0 + cw / 2) + '" y="' + (y(acc) - 5) + '" font-size="13" font-weight="600" fill="var(--text)" text-anchor="middle">' + acc + '</text>';
      } else {
        const k = o.series.length; const bw = cw * .7 / k;
        o.series.forEach((s, j) => {
          const v = s.values[i] || 0; const x = x0 + cw * .15 + j * bw;
          bars += '<rect x="' + x + '" y="' + y(v) + '" width="' + (bw - 2) + '" height="' + Math.max(0, y(0) - y(v)) + '" fill="' + s.color + '" rx="2"><title>' + esc(c + ' · ' + s.name + ': ' + v) + '</title></rect>' + (v ? '<text x="' + (x + (bw - 2) / 2) + '" y="' + (y(v) - 4) + '" font-size="12" font-weight="600" fill="var(--text)" text-anchor="middle">' + v + '</text>' : '');
        });
      }
      bars += '<text x="' + (x0 + cw / 2) + '" y="' + (H - padB + 22) + '" font-size="12" fill="var(--text-2)" text-anchor="middle">' + esc(c) + '</text>';
    });
    const legend = '<div class="legend">' + o.series.map(s => '<span><i class="lg" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block" role="img">' + g + bars + '</svg>' + legend;
  }

  function donut(parts, label) {
    const total = parts.reduce((a, p) => a + p.value, 0) || 1; let acc = 0; const R = 54, r = 36, cx = 70, cy = 70;
    const arc = (a0, a1, col, name, v) => {
      const p = a => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
      const q = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1), [u0, v0] = q(a1), [u1, v1] = q(a0);
      const big = a1 - a0 > Math.PI ? 1 : 0;
      return '<path d="M' + x0 + ' ' + y0 + 'A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + x1 + ' ' + y1 + 'L' + u0 + ' ' + v0 + 'A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + u1 + ' ' + v1 + 'Z" fill="' + col + '"><title>' + esc(name + ': ' + v) + '</title></path>';
    };
    let s = '';
    parts.forEach(p => {
      if (!p.value) return;
      const a0 = -Math.PI / 2 + acc / total * 2 * Math.PI;
      acc += p.value;
      const a1 = -Math.PI / 2 + acc / total * 2 * Math.PI - 0.01;
      s += arc(a0, a1, p.color, p.name, p.value);
    });
    return '<div style="display:flex;align-items:center;gap:16px"><svg viewBox="0 0 140 140" width="140" height="140">' + s + '<text x="70" y="66" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text)">' + total + '</text><text x="70" y="84" text-anchor="middle" font-size="11" fill="var(--muted)">' + esc(label) + '</text></svg><div>' + parts.map(p => '<div class="kv" style="margin:3px 0"><i class="lg" style="background:' + p.color + ';margin-right:6px"></i>' + esc(p.name) + ' <b>' + p.value + '</b></div>').join('') + '</div></div>';
  }

  function vTimeline() {
    const dates = [];
    S.projects.forEach(p => { if (isDate(p.start)) dates.push(p.start); if (isDate(p.due)) dates.push(p.due); (p.milestones || []).forEach(m => { if (isDate(m.due)) dates.push(m.due); }); });
    S.tasks.forEach(t => { if (isDate(t.due)) dates.push(t.due); });
    dates.push(todayStr()); dates.sort();
    const first = new Date(dates[0] + 'T00:00:00'), last = new Date(dates[dates.length - 1] + 'T00:00:00');
    const months = []; const cur = new Date(first.getFullYear(), first.getMonth(), 1); const end = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    while (cur < end) {
      const m0 = new Date(cur); const m1 = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const key = m0.getFullYear() + '-' + String(m0.getMonth() + 1).padStart(2, '0');
      months.push({ key, label: m0.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), days: Math.round((m1 - m0) / 86400000), n0: dnum(key + '-01'), n1: dnum(key + '-01') + Math.round((m1 - m0) / 86400000) - 1 });
      cur.setMonth(cur.getMonth() + 1);
    }
    const mi = d => months.findIndex(m => d.slice(0, 7) === m.key);
    const monthCats = months.map(m => m.label);

    const msDone = months.map(() => 0), msOpen = months.map(() => 0), msLate = months.map(() => 0);
    S.projects.forEach(p => (p.milestones || []).forEach(m => { if (!isDate(m.due)) return; const i = mi(m.due); if (i < 0) return; if (m.status === 'Completed') msDone[i]++; else if (daysFromToday(m.due) < 0) msLate[i]++; else msOpen[i]++; }));
    const tp = { P0: months.map(() => 0), P1: months.map(() => 0), P2: months.map(() => 0), P3: months.map(() => 0) };
    S.tasks.forEach(t => { if (t.status === 'Completed' || !isDate(t.due)) return; const i = mi(t.due); if (i >= 0 && tp[t.priority]) tp[t.priority][i]++; });
    const active = months.map(m => S.projects.filter(p => p.status !== 'Completed' && isDate(p.start) && dnum(p.start) <= m.n1 && (!p.due || dnum(p.due) >= m.n0)).length);
    const starting = months.map(m => S.projects.filter(p => isDate(p.start) && mi(p.start) === months.indexOf(m)).length);
    const finishing = months.map(m => S.projects.filter(p => isDate(p.due) && mi(p.due) === months.indexOf(m)).length);
    const hs = S.projects.map(p => health(p).rag);
    const rag = ['Green', 'Amber', 'Red', 'Grey'].map(k => ({ name: RAG_WORD[k], value: hs.filter(h => h === k).length, color: { Green: '#1c8a5a', Amber: '#9a5b00', Red: '#c8352b', Grey: '#9aa3b2' }[k] }));
    const prio = opt('priorities').map(pr => ({ name: pr, value: S.projects.filter(p => p.priority === pr).length, color: { P0: 'var(--text)', P1: '#c8352b', P2: '#9a5b00', P3: '#9aa3b2' }[pr] || '#9aa3b2' }));

    const MW = 124; const n0 = months[0].n0; const total = months.reduce((a, m) => a + m.days, 0); const pxPerDay = MW / 30.4;
    const px = s => (dnum(s) - n0) * pxPerDay; const width = Math.round(total * pxPerDay); const tn = dnum(todayStr());
    const grid = months.map(m => '<div class="gm" style="left:' + Math.round((m.n0 - n0) * pxPerDay) + 'px;width:' + Math.round(m.days * pxPerDay) + 'px"></div>').join('');
    const todayLine = '<div class="gtoday" style="left:' + Math.round((tn - n0) * pxPerDay) + 'px"></div>';
    const f = UI.filters; let list = S.projects.slice(); if (f.gprio) list = list.filter(p => p.priority === f.gprio);
    const catColor = { 'Revenue Generation': '#4666f6', 'Funnel Conversion & Sales Productivity': '#0e9f6e', 'B2B Business Development': '#7c3aed', 'Marketing & Demand Generation': '#db2777', 'Cross-functional Dependencies': '#64748b' };
    const lanes = opt('categories').map(c => {
      const ps = list.filter(p => p.category === c).sort((a, b) => a.priority.localeCompare(b.priority) || (a.start || 'z').localeCompare(b.start || 'z'));
      if (!ps.length) return '';
      const rows = ps.map(p => {
        const h = health(p); const open = UI.ganttOpen[p.id];
        const mss = (p.milestones || []).filter(m => isDate(m.due)).sort(by('due'));
        const endDate = p.due || (mss.length ? mss[mss.length - 1].due : '');
        const ongoing = !p.due;
        const s = isDate(p.start) ? px(p.start) : (isDate(endDate) ? px(endDate) - 30 : 0);
        const e = ongoing ? width : (isDate(endDate) ? px(endDate) : s + 30);
        const bar = '<div class="gbar ' + h.rag.toLowerCase() + (ongoing ? ' ongoing' : '') + '" style="left:' + Math.round(s) + 'px;width:' + Math.max(40, Math.round(e - s)) + 'px" title="' + esc(p.name + ': ' + (p.start || 'TBD') + ' to ' + (p.due || 'ongoing')) + '"><span>' + esc(p.name) + '</span></div>';
        const dia = mss.map(m => '<div class="gms ' + (m.status === 'Completed' ? 'done' : daysFromToday(m.due) < 0 ? 'late' : '') + '" style="left:' + Math.round(px(m.due) - 5) + 'px" title="' + esc(m.name + ' (' + m.due + ')') + '"></div>').join('');
        let r = '<div class="grow proj"><div class="glabel" data-act="gantt-toggle" data-id="' + p.id + '"><span class="caret">' + (open ? '&#9662;' : '&#9656;') + '</span><div style="min-width:0"><div class="gname"><span class="link" data-act="open" data-id="' + p.id + '">' + esc(p.name) + '</span></div><div class="mini">' + pillPrio(p.priority) + ' ' + esc(whoParts(p.owner).name) + '</div></div></div><div class="gtrack" style="min-width:' + width + 'px">' + grid + todayLine + bar + dia + '</div></div>';
        if (open) r += mss.map(m => {
          const late = m.status !== 'Completed' && daysFromToday(m.due) < 0;
          return '<div class="grow ms"><div class="glabel sub"><div style="min-width:0"><div class="gname">' + esc(m.name) + '</div><div class="mini">' + fmt(m.due) + (late ? ' <span class="tbd">overdue</span>' : '') + '</div></div></div><div class="gtrack" style="min-width:' + width + 'px">' + grid + todayLine + '<div class="gms ' + (m.status === 'Completed' ? 'done' : late ? 'late' : '') + '" style="left:' + Math.round(px(m.due) - 5) + 'px"></div><div class="gmslabel" style="left:' + Math.round(px(m.due) + 10) + 'px">' + esc(m.name) + '</div></div></div>';
        }).join('');
        return r;
      }).join('');
      return '<div class="grow lane" style="--lc:' + (catColor[c] || '#64748b') + '"><div class="glabel"><span class="lane-dot"></span><b>' + esc(c) + '</b><span class="mini">' + ps.length + '</span></div><div class="gtrack" style="min-width:' + width + 'px">' + grid + todayLine + '</div></div>' + rows;
    }).join('');

    const head = '<div class="grow head"><div class="glabel"><b>Project</b></div><div class="gtrack" style="min-width:' + width + 'px">' + months.map(m => '<div class="gmh" style="left:' + Math.round((m.n0 - n0) * pxPerDay) + 'px;width:' + Math.round(m.days * pxPerDay) + 'px">' + m.label + '</div>').join('') + todayLine + '</div></div>';
    const soonM = []; S.projects.forEach(p => (p.milestones || []).forEach(m => { if (m.status !== 'Completed' && isDate(m.due) && daysFromToday(m.due) <= 30) soonM.push({ p, m }); })); soonM.sort((a, b) => a.m.due.localeCompare(b.m.due));
    const allOpen = S.projects.length > 0 && S.projects.every(p => UI.ganttOpen[p.id]);

    const legend = '<div class="legend"><span><i class="lg green"></i>On track</span><span><i class="lg amber"></i>At risk</span><span><i class="lg red"></i>Delayed</span><span><i class="lg grey"></i>Not started</span><span><i class="lg dia"></i>Milestone</span><span><i class="lg today"></i>Today</span></div>';
    const cats = {}; S.projects.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    const catParts = Object.keys(cats).map(k => ({ name: k, value: cats[k], color: catColor[k] || '#64748b' }));
    const charts = UI.showCharts ? `<div class="grid g3 charts">
        <div class="card"><div class="hd"><h3>Milestones by month</h3></div><div class="bd">${barChart({ cats: monthCats, stacked: true, series: [{ name: 'Completed', color: '#1c8a5a', values: msDone }, { name: 'Upcoming', color: '#4666f6', values: msOpen }, { name: 'Late', color: '#c8352b', values: msLate }] })}</div></div>
        <div class="card"><div class="hd"><h3>Open tasks by month</h3></div><div class="bd">${barChart({ cats: monthCats, stacked: true, series: [{ name: 'P0', color: '#1b2540', values: tp.P0 }, { name: 'P1', color: '#c8352b', values: tp.P1 }, { name: 'P2', color: '#9a5b00', values: tp.P2 }, { name: 'P3', color: '#9aa3b2', values: tp.P3 }] })}</div></div>
        <div class="card"><div class="hd"><h3>Projects running by month</h3></div><div class="bd">${barChart({ cats: monthCats, stacked: false, series: [{ name: 'Running', color: '#4666f6', values: active }, { name: 'Starting', color: '#1c8a5a', values: starting }, { name: 'Finishing', color: '#7c3aed', values: finishing }] })}</div></div>
      </div>
      <div class="grid g3 charts">
        <div class="card"><div class="hd"><h3>Health today</h3></div><div class="bd">${donut(rag, 'projects')}</div></div>
        <div class="card"><div class="hd"><h3>Priority mix</h3></div><div class="bd">${donut(prio, 'projects')}</div></div>
        <div class="card"><div class="hd"><h3>By category</h3></div><div class="bd">${donut(catParts, 'projects')}</div></div>
      </div>` : '';

    return `<div class="bar-row">
        ${legend}
        <div class="bar-end">
          <label class="fsel"><span>Priority</span><select data-act="filter" data-k="gprio"><option value="">All</option>${opt('priorities').map(p => '<option ' + (f.gprio === p ? 'selected' : '') + '>' + p + '</option>').join('')}</select></label>
          <button class="btn sm" data-act="gantt-all" data-open="${allOpen ? 0 : 1}">${allOpen ? 'Hide milestones' : 'Show milestones'}</button>
          <button class="btn sm" data-act="toggle-charts" aria-expanded="${!!UI.showCharts}">${UI.showCharts ? 'Hide charts' : 'Show charts'}</button>
        </div>
      </div>
      ${charts}
      <div class="gantt2"><div class="gscroll">${head}${lanes || emptyLine('No projects match', 'Try another priority.')}</div></div>
      ${soonM.length ? '<section class="sec"><h2>Milestones in the next 30 days</h2><div class="rows">' + soonM.map(x => '<div class="r r-tl" data-act="open" data-id="' + esc(x.p.id) + '" data-tab="plan"><span class="r-main"><button class="r-t" data-act="open" data-id="' + esc(x.p.id) + '" data-tab="plan">' + esc(x.m.name) + '</button><span class="r-s">' + esc(x.p.name) + '</span></span><span class="r-when">' + when(x.m.due) + '</span></div>').join('') + '</div></section>' : ''}`;
  }

  // ---------- Decisions & risks ----------
  function vDecisions() {
    const t = UI.riskTab;
    const f = UI.filters;
    const openD = S.decisions.filter(openDec).length;
    const openR = S.risks.filter(r => r.status === 'Open' || r.status === 'Escalated').length;
    const openP = S.dependencies.filter(d => d.status === 'Open' || d.status === 'Escalated').length;
    const tabs = [['decisions', 'Decisions', openD], ['risks', 'Risks', openR], ['deps', 'Waiting on others', openP]];
    const add = { decisions: ['add-decision', 'Add decision'], risks: ['add-risk', 'Add risk'], deps: ['add-dep', 'Add dependency'] }[t];
    let body;
    if (t === 'decisions') {
      let ds = S.decisions.slice();
      if (f.downer) ds = ds.filter(d => (d.owner || '').includes(f.downer));
      if (f.dstatus) ds = ds.filter(d => d.status === f.dstatus);
      ds.sort((a, b) => (a.requiredBy || 'z').localeCompare(b.requiredBy || 'z'));
      const open = ds.filter(openDec), done = ds.filter(d => !openDec(d));
      body = '<div class="filters">' + filterSel('downer', 'Owner', people().map(p => [p, p])) + filterSel('dstatus', 'Status', opt('decisionStatuses').map(s => [s, s])) + ((f.downer || f.dstatus) ? '<button class="linkbtn" data-act="clear-filters">Clear filters</button>' : '') + '</div>' +
        (open.length ? '<div class="rows">' + open.map(d => decisionRow(d)).join('') + '</div>' : emptyLine('No decisions are waiting', 'Add one when something needs a call.')) +
        (done.length ? group('dec-done', 'Decided', done.length, done.map(d => decisionRow(d)).join(''), false) : '');
    } else if (t === 'risks') {
      const closed = r => ['Resolved', 'Closed', 'Mitigated'].includes(r.status);
      const rs = S.risks.slice().sort((a, b) => riskScore(b) - riskScore(a));
      const open = rs.filter(r => !closed(r)), done = rs.filter(closed);
      body = (open.length ? '<div class="rows">' + open.map(r => riskRow(r)).join('') + '</div>' : emptyLine('No open risks', 'Add a risk when you spot one.')) +
        (done.length ? group('risk-done', 'Resolved', done.length, done.map(r => riskRow(r)).join(''), false) : '');
    } else {
      const closed = d => d.status === 'Closed' || d.status === 'Resolved';
      const ds = S.dependencies.slice().sort(by('requiredBy'));
      const open = ds.filter(d => !closed(d)), done = ds.filter(closed);
      body = (open.length ? '<div class="rows">' + open.map(d => depRow(d)).join('') + '</div>' : emptyLine('Not waiting on anyone', 'Add a dependency when work relies on someone else.')) +
        (done.length ? group('dep-done', 'Resolved', done.length, done.map(d => depRow(d)).join(''), false) : '');
    }
    return `<div class="page-h"><h1>Decisions &amp; risks</h1><button class="btn primary no-print" data-act="${add[0]}">${add[1]}</button></div>
      <div class="bar-row">${seg('rtab', tabs, t)}</div>${body}`;
  }

  // ---------- Weekly review ----------
  const localDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDate(d); };

  function weeklyRows() {
    const wkStart = weekStart();
    return S.projects.filter(p => p.status !== 'Completed').map(p => {
      const u = lastUpdate(p.id);
      const stale = !u || (Date.now() - new Date(u.ts).getTime()) / 86400000 > 7;
      const ts = pTasks(p.id);
      return {
        p, u, stale, h: health(p),
        done: ts.filter(t => t.status === 'Completed' && t.completedAt && t.completedAt >= wkStart).length,
        late: ts.filter(taskOverdue).length,
        next: ts.filter(t => t.status !== 'Completed' && isDate(t.due) && daysFromToday(t.due) >= 0 && daysFromToday(t.due) <= 7).length,
        decs: S.decisions.filter(d => openDec(d) && d.projectId === p.id).length
      };
    });
  }

  function vWeekly() {
    const all = weeklyRows();
    const need = all.filter(r => r.stale && r.p.status === 'In Progress');
    const rows = UI.weekTab === 'need' ? need : all.slice().sort((a, b) => (a.stale ? 0 : 1) - (b.stale ? 0 : 1));
    const stat = (n, l, cls) => n ? '<span class="st-n ' + (cls || '') + '"><b>' + n + '</b> ' + l + '</span>' : '';
    const row = r => {
      const facts = stat(r.done, 'done') + stat(r.late, 'late', 'late') + stat(r.next, 'due') + stat(r.decs, r.decs === 1 ? 'decision' : 'decisions', 'amber');
      return '<div class="r r-week" data-act="open" data-id="' + esc(r.p.id) + '" data-tab="updates">' +
        '<span class="mark ' + r.h.rag.toLowerCase() + '" title="' + esc(RAG_WORD[r.h.rag]) + '"></span>' +
        '<span class="r-main"><button class="r-t" data-act="open" data-id="' + esc(r.p.id) + '" data-tab="updates">' + esc(r.p.name) + '</button><span class="r-s">' + (r.u ? esc(r.u.progress || '') : 'No update yet') + '</span></span>' +
        '<span class="r-who">' + who(r.p.owner) + '</span>' +
        '<span class="r-facts">' + (facts || '<span class="quiet">Nothing this week</span>') + '</span>' +
        '<span class="r-do"><button class="btn sm' + (r.stale ? ' primary' : '') + '" data-act="add-update" data-pid="' + esc(r.p.id) + '">Add update</button></span></div>';
    };
    return `<div class="page-h"><h1>Weekly review</h1><p class="quiet">Week of ${fmtShort(weekStart())}</p></div>
      <div class="bar-row">${seg('wtab', [['need', 'Needs an update', need.length], ['all', 'All projects', all.length]], UI.weekTab)}</div>
      ${rows.length ? '<div class="rows">' + rows.map(row).join('') + '</div>' : emptyLine('Every active project is up to date', 'Nothing more to chase this week.')}`;
  }

  // ---------- How we work ----------
  function vGovernance() {
    const g = S.governance || {};
    const cadences = g.cadence || {};
    const rags = g.rag || {};
    const classifications = g.classification || [];
    const pName2 = id => esc(pName(id));
    return `<div class="page-h"><h1>How we work</h1></div>
    <section class="sec"><h2>Regular check-ins</h2><div class="grid g3">${Object.entries(cadences).map(([k, v]) => '<div class="plain"><div class="s-h"><h3>' + esc(k) + '</h3><button class="linkbtn" data-act="edit-cadence" data-cadence="' + esc(k) + '">Edit</button></div><ul class="list">' + (v || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('')}</div></section>
    <section class="sec"><div class="s-h"><h2>What each health colour means</h2><button class="linkbtn" data-act="edit-rag">Edit</button></div>
      <dl class="dl">${Object.entries(rags).map(([k, v]) => '<dt>' + pillRag(k) + '</dt><dd>' + esc(v) + '</dd>').join('')}</dl>
      <p class="quiet">Health comes from dates, milestones, dependencies and owner updates, not from task completion.</p></section>
    <section class="sec"><h2>What each priority means</h2>
      <dl class="dl"><dt>${pillPrio('P0')}</dt><dd>Stuck on a leadership decision or holding up several revenue projects. Fix in days.</dd><dt>${pillPrio('P1')}</dt><dd>Direct effect on revenue or conversion, moving or quick to start.</dd><dt>${pillPrio('P2')}</dt><dd>Builds a channel or process. Needs definition and input from other teams first.</dd><dt>${pillPrio('P3')}</dt><dd>Long-term or depends on things outside Sales.</dd></dl>
      <details class="acc"><summary>${CHEV}Projects by priority</summary><div class="acc-bd"><dl class="dl">${opt('priorities').map(pr => '<dt>' + pillPrio(pr) + '</dt><dd>' + (S.projects.filter(p => p.priority === pr).map(p => '<button class="linkbtn" data-act="open" data-id="' + esc(p.id) + '">' + esc(p.name) + '</button>').join(', ') || 'None') + '</dd>').join('')}</dl></div></details></section>
    <section class="sec"><div class="s-h"><h2>Programs</h2><button class="btn sm" data-act="add-program">Add program</button></div>
      <div class="rows">${(S.programs || []).map(pg => '<div class="r r-tl" data-act="edit-program" data-id="' + esc(pg.id) + '"><span class="r-main"><button class="r-t" data-act="edit-program" data-id="' + esc(pg.id) + '">' + esc(pg.name) + '</button><span class="r-s">' + esc(pg.objective || '') + '</span></span><span class="r-when"><span class="when">' + plural((pg.children || []).length, 'project') + '</span></span></div>').join('') || '<p class="quiet">No programs yet.</p>'}</div></section>
    <details class="acc"><summary>${CHEV}How the brief maps to projects (${classifications.length})</summary><div class="acc-bd">
      <div class="in-g"><button class="btn sm" data-act="add-classification">Add row</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Initiative</th><th>Mapped to</th><th>Note</th></tr></thead><tbody>${classifications.map((c, i) => '<tr data-act="edit-classification" data-i="' + i + '"><td><button class="r-t" data-act="edit-classification" data-i="' + i + '">' + esc(c.initiative) + '</button></td><td>' + esc(c.mapped) + '</td><td>' + esc(c.note) + '</td></tr>').join('')}</tbody></table></div></div></details>`;
  }

  // ---------- Data & settings ----------
  function vData() {
    const sz = (() => { try { return Math.round((localStorage.getItem(KEY) || '').length / 1024); } catch (e) { return '?'; } })();
    const sync = (S.meta && S.meta.sync) || { url: '', enabled: false, autoSync: true, status: 'idle' };
    const stateWord = !sync.url || !sync.enabled ? ['This browser only', 'grey'] : sync.status === 'syncing' ? ['Saving', 'blue'] : sync.status === 'error' ? ['Not saved to Sheet', 'red'] : ['Saved to Sheet', 'green'];
    const labelMap = {
      priorities: 'Priorities', projectStatuses: 'Project statuses', taskStatuses: 'Task statuses',
      taskKinds: 'Task kinds', milestoneStatuses: 'Milestone statuses', categories: 'Categories',
      projectTypes: 'Project types', valueClasses: 'Value classes', riskLevels: 'Risk levels',
      riskStatuses: 'Risk statuses', dependencyStatuses: 'Dependency statuses', decisionStatuses: 'Decision statuses',
      actionKinds: 'Action kinds', actionBuckets: 'Action groups', updateRag: 'Update health'
    };
    const optRows = Object.keys(FALLBACKS).map(k => '<div class="r r-tl" data-act="edit-option-list" data-opt="' + k + '"><span class="r-main"><button class="r-t" data-act="edit-option-list" data-opt="' + k + '">' + esc(labelMap[k] || k) + '</button><span class="r-s">' + esc(opt(k).join(', ')) + '</span></span><span class="r-when"><span class="when">' + plural(opt(k).length, 'item') + '</span></span></div>').join('');
    return `<div class="page-h"><h1>Data &amp; settings</h1></div>
    <section class="sec" id="sync-card"><div class="s-h"><h2>Google Sheet</h2><span class="pill ${stateWord[1]}">${stateWord[0]}</span></div>
      <p class="quiet">Changes here save to the Sheet, and edits in the Sheet appear here. Last synced ${sync.lastSync ? new Date(sync.lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not yet'}.</p>
      ${sync.error ? '<p class="flag">' + esc(sync.error) + '</p>' : ''}
      <div class="btnrow"><button class="btn primary" data-act="sync-pull">Get latest from Sheet</button><button class="btn" data-act="sync-push">Send everything to Sheet</button><button class="btn" data-act="sync-test">Test connection</button></div>
      <details class="acc"><summary>${CHEV}Connection settings</summary><div class="acc-bd"><div class="form one">
        <div class="f"><label for="sync-url-input">Apps Script web app URL</label><div class="btnrow nowrap"><input id="sync-url-input" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(sync.url || '')}"><button class="btn" data-act="save-sync-config">Save</button></div></div>
        <label class="check"><input type="checkbox" id="sync-auto-input" ${sync.autoSync !== false ? 'checked' : ''}> Save to the Sheet automatically</label>
      </div></div></details></section>
    <section class="sec"><h2>Download</h2><div class="btnrow"><button class="btn" data-act="export-csv" data-what="projects">Projects</button><button class="btn" data-act="export-csv" data-what="tasks">Tasks</button><button class="btn" data-act="export-csv" data-what="risks">Risks</button><button class="btn" data-act="export-csv" data-what="dependencies">Dependencies</button><button class="btn" data-act="export-csv" data-what="decisions">Decisions</button><button class="btn" data-act="export-json">Full backup</button><button class="btn" data-act="print-portfolio">Print projects</button></div></section>
    <details class="acc"><summary>${CHEV}Dropdown lists</summary><div class="acc-bd"><div class="rows">${optRows}</div></div></details>
    <details class="acc"><summary>${CHEV}Restore from a backup</summary><div class="acc-bd"><label class="f"><span class="quiet">Choose a backup file. It replaces everything here after you confirm.</span><input type="file" id="importFile" accept="application/json,.json"></label></div></details>
    <details class="acc"><summary>${CHEV}History (${S.activity.length})</summary><div class="acc-bd">${S.activity.slice(0, 60).map(a => '<div class="comment"><p>' + esc(a.text) + '</p><span class="quiet">' + new Date(a.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</span></div>').join('')}</div></details>
    <details class="acc"><summary>${CHEV}Data summary</summary><div class="acc-bd"><p class="quiet">${plural(S.projects.length, 'project')}, ${plural(S.tasks.length, 'task')}, ${plural(S.projects.reduce((a, p) => a + (p.milestones || []).length, 0), 'milestone')}, ${plural(S.risks.length, 'risk')}, ${plural(S.dependencies.length, 'dependency', 'dependencies')}, ${plural(S.decisions.length, 'decision')}, ${plural(S.updates.length, 'weekly update')}. Using ${sz} KB in this browser.</p></div></details>
    <details class="acc"><summary>${CHEV}Reset</summary><div class="acc-bd"><p class="quiet">Replaces everything in this browser with the original data from the 30 Oct 2026 brief.</p><button class="btn danger" data-act="reset">Reset to original data</button></div></details>`;
  }

  // ---------- forms ----------
  function fieldHtml(f, vals) {
    let v = vals[f.k] == null ? '' : vals[f.k];
    if (f.type === 'static') return '<div class="f full static"><span class="f-l">' + esc(f.label) + '</span><p>' + esc(f.text || '') + '</p></div>';
    const proposed = f.tbd && isTBD(v) ? whoParts(v) : null;
    if (proposed) v = '';
    const id = 'f-' + f.k;
    const ph = proposed ? ' placeholder="' + esc(proposed.proposed ? 'Proposed: ' + proposed.name : 'Not decided yet') + '"' : '';
    let inp;
    if (f.type === 'textarea') inp = '<textarea id="' + id + '" name="' + f.k + '" rows="' + (f.rows || 3) + '">' + esc(v) + '</textarea>';
    else if (f.type === 'select') inp = '<select id="' + id + '" name="' + f.k + '">' + (f.allowBlank ? '<option value="">None</option>' : '') + f.options.map(o => {
      const ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(ov) + '" ' + (String(v) === String(ov) ? 'selected' : '') + '>' + esc(ol) + '</option>';
    }).join('') + '</select>';
    else if (f.type === 'datalist') inp = '<input id="' + id + '" name="' + f.k + '" list="dl-' + f.k + '" value="' + esc(v) + '"' + ph + ' autocomplete="off"><datalist id="dl-' + f.k + '">' + f.options.map(o => '<option value="' + esc(o) + '">').join('') + '</datalist>';
    else inp = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '" ' + (f.min != null ? 'min="' + f.min + '" max="' + f.max + '"' : '') + '>';
    return '<div class="f' + (f.full ? ' full' : '') + '"><label for="' + id + '">' + esc(f.label) + '</label>' + inp + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
  }

  function openForm(title, fields, vals, onSave, extraBtn, saveLabel) {
    const main = fields.filter(f => !f.more), more = fields.filter(f => f.more);
    const opener = document.activeElement;
    const h = '<div class="modal-bg" id="modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title"><div class="mh"><h2 id="m-title">' + esc(title) + '</h2><button class="btn icon ghost" data-act="close-modal" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><form id="mform" class="mb"><div class="form">' + main.map(f => fieldHtml(f, vals)).join('') + '</div>' +
      (more.length ? '<details class="acc more-f"><summary>' + CHEV + 'More details</summary><div class="form">' + more.map(f => fieldHtml(f, vals)).join('') + '</div></details>' : '') +
      '<div class="ferr" id="ferr" role="alert"></div></form><div class="mf">' + (extraBtn ? '<div class="mf-l">' + extraBtn + '</div>' : '') + '<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="save-modal">' + esc(saveLabel || 'Save') + '</button></div></div></div>';
    $('#modal-root').innerHTML = h;
    const form = $('#mform');
    $('#modal-root')._dirty = false;
    $('#modal-root')._opener = opener;
    form.addEventListener('input', () => { $('#modal-root')._dirty = true; });
    form.addEventListener('submit', e => { e.preventDefault(); $('#modal-root')._onSave(); });
    $('#modal-root')._onSave = () => {
      const fd = new FormData(form);
      const o = {};
      fields.forEach(f => {
        if (f.type === 'static') return;
        let v = fd.get(f.k);
        if (v == null) v = '';
        v = String(v).trim();
        if (f.type === 'number') v = v === '' ? 0 : +v;
        if (f.tbd && v === '') v = isTBD(vals[f.k]) ? (vals[f.k] || 'TBD') : 'TBD';
        o[f.k] = v;
      });
      const errs = [];
      fields.forEach(f => {
        if (f.type === 'static') return;
        if (f.req && (o[f.k] === '' || o[f.k] == null)) errs.push(f.label + ' is required.');
        if (f.type === 'date' && o[f.k] && !isDate(o[f.k])) errs.push(f.label + ' must be a valid date.');
      });
      if (o.start && o.due && isDate(o.start) && isDate(o.due) && o.due < o.start) errs.push('Due date cannot be before start date.');
      if (errs.length) {
        $('#ferr').textContent = errs.join(' ');
        const d = $('#mform details'); if (d && more.some(f => f.req && !o[f.k])) d.open = true;
        return;
      }
      const r = onSave(o);
      if (r !== false) closeModal();
    };
    setTimeout(() => {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const first = coarse ? $('#modal .mh button') : $('#mform input, #mform select, #mform textarea');
      if (first) first.focus();
    }, 30);
  }

  // Close a panel, asking first if something typed would be lost.
  function tryCloseModal() {
    const root = $('#modal-root');
    if (root._dirty && !confirm('Discard your changes?')) return;
    closeModal();
  }

  function closeModal() {
    const root = $('#modal-root');
    if (!root || !root.innerHTML) return;
    const o = root._opener;
    root.innerHTML = '';
    root._dirty = false;
    if (o && o.isConnected) o.focus();
  }
  const listToStr = a => (a || []).join(', ');
  const strToList = s => String(s || '').split(/\s*[;,]\s*/).map(x => x.trim()).filter(Boolean);
  const lineList = s => String(s || '').split(/\n/).map(x => x.trim()).filter(Boolean);

  function nextId(prefix) {
    let n = 1;
    const ids = new Set([].concat(
      S.projects.map(p => p.id),
      S.tasks.map(t => t.id),
      S.risks.map(r => r.id),
      S.dependencies.map(d => d.id),
      S.decisions.map(d => d.id),
      S.actions.map(a => a.id),
      (S.programs || []).map(pg => pg.id)
    ));
    while (ids.has(prefix + '-' + String(n).padStart(prefix === 'SI' ? 2 : 3, '0'))) n++;
    return prefix + '-' + String(n).padStart(prefix === 'SI' ? 2 : 3, '0');
  }

  function projectForm(p) {
    const isNew = !p;
    p = p || {
      id: nextId('PRJ'), status: 'Not Started', priority: 'P2', priorityProposed: true,
      category: opt('categories')[0] || 'Revenue Generation', type: 'Project',
      owner: 'TBD', accountable: 'TBD', sponsor: 'Head of Sales',
      metrics: [], dependencies: [], risks: [], assumptions: [], workstreams: [],
      milestones: [], raci: [], comments: [], flags: [], datesProposed: true
    };
    const f = [
      { k: 'name', label: 'Project name', req: true, full: true },
      { k: 'objective', label: 'What is it for?', type: 'textarea', full: true, rows: 2 },
      { k: 'owner', label: 'Owner', type: 'datalist', options: people(), tbd: true },
      { k: 'accountable', label: 'Answerable', type: 'datalist', options: people(), tbd: true },
      { k: 'priority', label: 'Priority', type: 'select', options: opt('priorities') },
      { k: 'status', label: 'Status', type: 'select', options: opt('projectStatuses') },
      { k: 'start', label: 'Start date', type: 'date' },
      { k: 'due', label: 'Target end', type: 'date', hint: 'Leave blank if ongoing' },
      { k: 'nextAction', label: 'Next action', full: true },
      { k: 'outcome', label: 'Expected outcome', type: 'textarea', full: true, more: true },
      { k: 'problem', label: 'Problem', type: 'textarea', full: true, more: true },
      { k: 'impact', label: 'Business impact', type: 'textarea', full: true, more: true },
      { k: 'metrics', label: 'Success measures (one per line)', type: 'textarea', full: true, more: true },
      { k: 'category', label: 'Category', type: 'select', options: opt('categories'), more: true },
      { k: 'type', label: 'Type', type: 'select', options: opt('projectTypes'), more: true },
      { k: 'program', label: 'Program', type: 'select', allowBlank: true, options: (S.programs || []).map(x => [x.id, x.name]), more: true },
      { k: 'valueClass', label: 'Value class', type: 'select', allowBlank: true, options: opt('valueClasses'), more: true },
      { k: 'sponsor', label: 'Sponsor', type: 'datalist', options: people(), tbd: true, more: true },
      { k: 'priorityProposed', label: 'Priority is', type: 'select', options: [['true', 'Proposed'], ['false', 'Approved']], more: true },
      { k: 'datesProposed', label: 'Dates are', type: 'select', options: [['true', 'Proposed'], ['false', 'Confirmed']], more: true },
      { k: 'priorityRationale', label: 'Why this priority', type: 'textarea', full: true, more: true },
      { k: 'dependencies', label: 'Depends on (one per line)', type: 'textarea', more: true },
      { k: 'risks', label: 'Known risks (one per line)', type: 'textarea', more: true },
      { k: 'assumptions', label: 'Assumptions (one per line)', type: 'textarea', full: true, more: true },
      { k: 'hypothesis', label: 'Hypothesis (experiments)', type: 'textarea', more: true },
      { k: 'successCriteria', label: 'Success criteria (experiments)', type: 'textarea', more: true },
      { k: 'testPeriod', label: 'Test period (experiments)', more: true },
      { k: 'baseline', label: 'Baseline', more: true },
      { k: 'cadence', label: 'Cadence (recurring work)', more: true },
      { k: 'flags', label: 'Flags (comma separated)', more: true },
      { k: 'id', label: 'Project ID', req: true, more: true }
    ];
    const vals = Object.assign({}, p, {
      metrics: (p.metrics || []).join('\n'),
      dependencies: (p.dependencies || []).join('\n'),
      risks: (p.risks || []).join('\n'),
      assumptions: (p.assumptions || []).join('\n'),
      flags: listToStr(p.flags),
      priorityProposed: String(p.priorityProposed !== false),
      datesProposed: String(p.datesProposed !== false)
    });
    openForm(isNew ? 'New project' : 'Edit project', f, vals, o => {
      if (isNew && P(o.id)) { $('#ferr').textContent = 'Project ID already exists.'; return false; }
      const np = Object.assign({}, p, o, {
        metrics: lineList(o.metrics),
        dependencies: lineList(o.dependencies),
        risks: lineList(o.risks),
        assumptions: lineList(o.assumptions),
        flags: strToList(o.flags),
        priorityProposed: o.priorityProposed === 'true',
        datesProposed: o.datesProposed === 'true',
        program: o.program || null
      });
      if (isNew) {
        S.projects.push(np);
        UI.view = 'project';
        UI.ptab = 'summary';
        UI.projectId = np.id;
        commit('Created project ' + np.id + ' ' + np.name);
      } else {
        if (p.id !== np.id) {
          S.tasks.forEach(t => { if (t.projectId === p.id) t.projectId = np.id; });
          S.risks.forEach(r => { if (r.projectId === p.id) r.projectId = np.id; });
          S.dependencies.forEach(d => { if (d.projectId === p.id) d.projectId = np.id; });
          S.decisions.forEach(d => { if (d.projectId === p.id) d.projectId = np.id; });
          S.updates.forEach(u => { if (u.projectId === p.id) u.projectId = np.id; });
          UI.projectId = np.id;
        }
        const changes = ['status', 'priority', 'owner', 'accountable', 'due'].filter(k => p[k] !== np[k]).map(k => k + ': ' + (p[k] || '—') + ' → ' + (np[k] || '—'));
        Object.assign(p, np);
        if (np.status === 'Completed' && !p.completedAt) p.completedAt = todayStr();
        commit('Updated project ' + np.id + (changes.length ? ' (' + changes.join('; ') + ')' : ''));
      }
    });
  }

  function programForm(pg) {
    const isNew = !pg;
    pg = pg || { id: nextId('SI'), name: '', objective: '', children: [], note: '' };
    const f = [
      { k: 'name', label: 'Program', req: true, full: true },
      { k: 'objective', label: 'What is it for?', type: 'textarea', full: true },
      { k: 'children', label: 'Project IDs (comma separated)', full: true, hint: 'For example PRJ-06, PRJ-12, OPS-03' },
      { k: 'note', label: 'Note', type: 'textarea', full: true, more: true },
      { k: 'id', label: 'Program ID', req: true, more: true }
    ];
    const vals = Object.assign({}, pg, { children: (pg.children || []).join(', ') });

    openForm(isNew ? 'New program' : 'Program', f, vals, o => {
      if (isNew && S.programs.some(x => x.id === o.id)) {
        $('#ferr').textContent = 'Program ID already exists.';
        return false;
      }
      const children = strToList(o.children);
      const updated = Object.assign(pg, o, { children });

      if (isNew) {
        S.programs.push(updated);
      }
      // Sync children with projects
      S.projects.forEach(p => {
        if (children.includes(p.id)) {
          p.program = updated.id;
        } else if (p.program === updated.id) {
          p.program = null;
        }
      });
      commit((isNew ? 'Added program ' : 'Updated program ') + updated.id);
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-program" data-id="' + esc(pg.id) + '">Delete</button>');
  }

  function roleForm(r) {
    const isNew = !r;
    r = r || { name: '', kind: 'Confirmed', note: '' };
    const kinds = ['Confirmed', 'Confirmed (team)', 'External', 'Proposed role'];
    const f = [
      { k: 'name', label: 'Name or role', req: true, full: true },
      { k: 'kind', label: 'Kind', type: 'select', options: kinds, full: true },
      { k: 'note', label: 'What they look after', type: 'textarea', full: true }
    ];
    openForm(isNew ? 'Add a person' : 'Person', f, r, o => {
      const trimmed = o.name.trim();
      if (!trimmed) { $('#ferr').textContent = 'Name is required.'; return false; }
      if (isNew) {
        if (S.roles.some(x => x.name.toLowerCase() === trimmed.toLowerCase())) {
          $('#ferr').textContent = 'A person or role with this name already exists.';
          return false;
        }
        S.roles.push({ name: trimmed, kind: o.kind, note: o.note || '' });
        commit('Added person / role: ' + trimmed);
      } else {
        const oldName = r.name;
        r.kind = o.kind;
        r.note = o.note || '';
        if (oldName !== trimmed) {
          renamePerson(oldName, trimmed);
          commit('Renamed person / role from ' + oldName + ' to ' + trimmed);
        } else {
          commit('Updated person / role: ' + trimmed);
        }
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-role" data-id="' + esc(r.name) + '">Delete</button>');
  }

  function editCadence(cadenceKey) {
    const items = (S.governance && S.governance.cadence && S.governance.cadence[cadenceKey]) || [];
    openForm(cadenceKey + ' check-in', [
      { k: 'items', label: 'Items (one per line)', type: 'textarea', full: true, req: true, rows: 8 }
    ], { items: items.join('\n') }, o => {
      S.governance = S.governance || {};
      S.governance.cadence = S.governance.cadence || {};
      S.governance.cadence[cadenceKey] = lineList(o.items);
      commit('Updated ' + cadenceKey + ' cadence');
    });
  }

  function editRag() {
    const rags = (S.governance && S.governance.rag) || {};
    openForm('What each health colour means', [
      { k: 'Green', label: 'On track', type: 'textarea', full: true, req: true },
      { k: 'Amber', label: 'At risk', type: 'textarea', full: true, req: true },
      { k: 'Red', label: 'Delayed', type: 'textarea', full: true, req: true },
      { k: 'Grey', label: 'Not started', type: 'textarea', full: true, req: true }
    ], rags, o => {
      S.governance = S.governance || {};
      S.governance.rag = o;
      commit('Updated RAG health framework definitions');
    });
  }

  function classificationForm(c, idx) {
    const isNew = idx == null;
    c = c || { initiative: '', mapped: '', note: '' };
    openForm(isNew ? 'Add a row' : 'Edit row', [
      { k: 'initiative', label: 'Initiative', req: true, full: true },
      { k: 'mapped', label: 'Mapped to', req: true, full: true },
      { k: 'note', label: 'Note', type: 'textarea', full: true }
    ], c, o => {
      S.governance = S.governance || {};
      S.governance.classification = S.governance.classification || [];
      if (isNew) {
        S.governance.classification.push(o);
        commit('Added initiative classification: ' + o.initiative);
      } else {
        S.governance.classification[idx] = o;
        commit('Updated initiative classification: ' + o.initiative);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-classification" data-i="' + idx + '">Delete</button>');
  }

  function editOptionList(optKey) {
    const currentList = opt(optKey);
    const labelMap = {
      priorities: 'Priorities', projectStatuses: 'Project Statuses', taskStatuses: 'Task Statuses',
      taskKinds: 'Task Kinds', milestoneStatuses: 'Milestone Statuses', categories: 'Portfolio Categories',
      projectTypes: 'Project Types', valueClasses: 'Value Classes', riskLevels: 'Risk Levels',
      riskStatuses: 'Risk Statuses', dependencyStatuses: 'Dependency Statuses', decisionStatuses: 'Decision Statuses',
      actionKinds: 'Action Kinds', actionBuckets: 'Action Buckets', updateRag: 'Update RAG Statuses'
    };

    openForm(labelMap[optKey] || optKey, [
      { k: 'values', label: 'Choices (one per line)', type: 'textarea', full: true, req: true, rows: 8, hint: 'Choices still in use cannot be removed.' }
    ], { values: currentList.join('\n') }, o => {
      const newItems = lineList(o.values);
      if (!newItems.length) { $('#ferr').textContent = 'The list cannot be empty.'; return false; }

      // Check if any removed value is still in use
      const removed = currentList.filter(v => !newItems.includes(v));
      if (removed.length > 0) {
        const usageErrors = [];
        removed.forEach(val => {
          const usages = checkOptionUsage(optKey, val);
          if (usages.length > 0) {
            usageErrors.push('"' + val + '" is in use by ' + usages.join(', '));
          }
        });
        if (usageErrors.length > 0) {
          $('#ferr').textContent = 'Cannot delete options in active use: ' + usageErrors.join('; ');
          return false;
        }
      }

      S.options = S.options || {};
      S.options[optKey] = newItems;
      commit('Updated option list: ' + optKey);
    });
  }

  function taskForm(t, pid, parent) {
    const isNew = !t;
    const base = {
      id: nextId('T'), projectId: pid || (UI.view === 'project' ? UI.projectId : (S.projects[0] || {}).id),
      ws: '', ms: '', owner: 'TBD', accountable: 'TBD', priority: 'P2', status: 'Not Started',
      progress: 0, kind: parent ? 'Subtask' : 'Task', parent: parent || '', datesProposed: true
    };
    t = t || base; const proj = P(t.projectId) || {};
    const f = [
      { k: 'name', label: 'Task', req: true, full: true },
      { k: 'projectId', label: 'Project', type: 'select', req: true, full: true, options: S.projects.map(p => [p.id, p.name]) },
      { k: 'owner', label: 'Owner', type: 'datalist', options: people(), tbd: true },
      { k: 'due', label: 'Due date', type: 'date' },
      { k: 'priority', label: 'Priority', type: 'select', options: opt('priorities') },
      { k: 'status', label: 'Status', type: 'select', options: opt('taskStatuses') },
      { k: 'deliverable', label: 'What gets delivered', full: true },
      { k: 'desc', label: 'Details', type: 'textarea', full: true, more: true },
      { k: 'criteria', label: 'Done when', full: true, more: true },
      { k: 'ms', label: 'Milestone', type: 'select', allowBlank: true, full: true, options: (proj.milestones || []).map(m => [m.id, m.name]), more: true },
      { k: 'ws', label: 'Workstream', type: 'select', allowBlank: true, full: true, options: (proj.workstreams || []).map(w => [w.id, w.name]), more: true },
      { k: 'accountable', label: 'Answerable', type: 'datalist', options: people(), tbd: true, more: true },
      { k: 'start', label: 'Start date', type: 'date', more: true },
      { k: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100, more: true },
      { k: 'kind', label: 'Kind', type: 'select', options: opt('taskKinds'), more: true },
      { k: 'dependency', label: 'Depends on', more: true },
      { k: 'parent', label: 'Parent task ID', type: 'datalist', options: S.tasks.map(x => x.id), more: true },
      { k: 'id', label: 'Task ID', req: true, more: true }
    ];
    const extra = isNew ? '' : '<button class="btn danger ghost" data-act="del-task" data-id="' + esc(t.id) + '">Delete</button><button class="btn ghost" data-act="add-subtask" data-id="' + esc(t.id) + '">Add subtask</button>';
    openForm(isNew ? (parent ? 'New subtask' : 'New task') : 'Task', f, t, o => {
      if (isNew && S.tasks.some(x => x.id === o.id)) { $('#ferr').textContent = 'Task ID already exists.'; return false; }
      if (o.parent && o.parent === o.id) { $('#ferr').textContent = 'A task cannot be its own parent.'; return false; }
      if (o.progress < 0 || o.progress > 100) { $('#ferr').textContent = 'Progress must be 0–100.'; return false; }
      if (o.status === 'Completed') o.progress = 100;
      if (isNew) {
        const nt = Object.assign({}, base, o);
        if (nt.status === 'Completed') nt.completedAt = todayStr();
        S.tasks.push(nt);
        commit('Added task ' + nt.id + ' "' + nt.name + '" to ' + nt.projectId);
      } else {
        const ch = ['status', 'owner', 'due', 'priority', 'progress'].filter(k => String(t[k]) !== String(o[k])).map(k => k + ': ' + (t[k] || '—') + ' → ' + (o[k] || '—'));
        if (o.status === 'Completed' && t.status !== 'Completed') o.completedAt = todayStr();
        if (o.id !== t.id) S.tasks.forEach(x => { if (x.parent === t.id) x.parent = o.id; });
        Object.assign(t, o);
        commit('Updated task ' + t.id + (ch.length ? ' (' + ch.join('; ') + ')' : ''));
      }
    }, extra);
  }

  function msForm(p, m) {
    const isNew = !m;
    m = m || { id: 'MS-' + p.id.replace(/^[A-Z]+-/, '') + '-' + ((p.milestones || []).length + 1), status: 'Pending', ws: (p.workstreams[0] || {}).id || '' };
    openForm(isNew ? 'New milestone' : 'Milestone', [
      { k: 'name', label: 'Milestone', req: true, full: true },
      { k: 'due', label: 'Date', type: 'date', req: true },
      { k: 'status', label: 'Status', type: 'select', options: opt('milestoneStatuses') },
      { k: 'ws', label: 'Workstream', type: 'select', allowBlank: true, full: true, options: (p.workstreams || []).map(w => [w.id, w.name]) },
      { k: 'id', label: 'Milestone ID', req: true, more: true }
    ], m, o => {
      if (isNew) {
        if (ms(p, o.id)) { $('#ferr').textContent = 'Milestone ID exists.'; return false; }
        p.milestones.push(o);
        commit('Added milestone "' + o.name + '" to ' + p.id);
      } else {
        Object.assign(m, o);
        commit('Updated milestone ' + m.id + ' in ' + p.id);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-ms" data-id="' + esc(p.id) + '" data-ms="' + esc(m.id) + '">Delete</button>');
  }

  function wsForm(p, w) {
    const isNew = !w;
    w = w || { id: 'WS-' + p.id.replace(/^[A-Z]+-/, '') + String.fromCharCode(65 + (p.workstreams || []).length) };
    openForm(isNew ? 'New workstream' : 'Workstream', [
      { k: 'name', label: 'Workstream', req: true, full: true },
      { k: 'id', label: 'Workstream ID', req: true, more: true }
    ], w, o => {
      if (isNew) {
        if (ws(p, o.id)) { $('#ferr').textContent = 'Workstream ID exists.'; return false; }
        p.workstreams.push(o);
        commit('Added workstream "' + o.name + '" to ' + p.id);
      } else {
        Object.assign(w, o);
        commit('Updated workstream ' + w.id);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-ws" data-id="' + esc(p.id) + '" data-ws="' + esc(w.id) + '">Delete</button>');
  }

  function raciForm(p, i) {
    const r = i != null ? p.raci[i] : { item: '', R: [], A: 'TBD', C: [], I: [] };
    openForm(i != null ? 'Who does what' : 'Add a row', [
      { k: 'item', label: 'Item', req: true, full: true },
      { k: 'R', label: 'Does the work (comma separated)', type: 'datalist', full: true, options: people() },
      { k: 'A', label: 'Answerable (one person)', type: 'datalist', full: true, options: people(), tbd: true },
      { k: 'C', label: 'Consulted (comma separated)', type: 'datalist', options: people() },
      { k: 'I', label: 'Kept informed (comma separated)', type: 'datalist', options: people() }
    ], { item: r.item, R: listToStr(r.R), A: r.A, C: listToStr(r.C), I: listToStr(r.I) }, o => {
      if (/,/.test(o.A) && !/^tbd/i.test(o.A)) {
        $('#ferr').textContent = 'Only one person can be answerable.';
        return false;
      }
      const n = { item: o.item, R: strToList(o.R), A: o.A, C: strToList(o.C), I: strToList(o.I) };
      if (i != null) p.raci[i] = n; else p.raci.push(n);
      commit('RACI updated for ' + p.id + ' — ' + n.item);
    }, i != null ? '<button class="btn danger ghost" data-act="del-raci" data-id="' + esc(p.id) + '" data-i="' + i + '">Delete</button>' : '');
  }

  function riskForm(r, pid) {
    const isNew = !r;
    r = r || { id: nextId('R'), projectId: pid || (UI.view === 'project' && UI.projectId) || S.projects[0].id, impact: 'Medium', probability: 'Medium', status: 'Open', owner: 'TBD', source: 'Logged by user' };
    openForm(isNew ? 'New risk' : 'Risk', [
      { k: 'desc', label: 'What could go wrong?', type: 'textarea', full: true, req: true, rows: 2 },
      { k: 'projectId', label: 'Project', type: 'select', full: true, options: S.projects.map(p => [p.id, p.name]) },
      { k: 'impact', label: 'Impact', type: 'select', options: opt('riskLevels') },
      { k: 'probability', label: 'Likelihood', type: 'select', options: opt('riskLevels') },
      { k: 'mitigation', label: 'What we are doing about it', type: 'textarea', full: true, rows: 2 },
      { k: 'owner', label: 'Owner', type: 'datalist', options: people(), tbd: true },
      { k: 'deadline', label: 'Resolve by', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: opt('riskStatuses') },
      { k: 'id', label: 'Risk ID', req: true, more: true }
    ], r, o => {
      if (isNew) {
        S.risks.push(Object.assign(r, o));
        commit('Logged risk ' + r.id + ' on ' + r.projectId);
      } else {
        Object.assign(r, o);
        commit('Updated risk ' + r.id);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-risk" data-id="' + esc(r.id) + '">Delete</button>');
  }

  function depForm(d, pid) {
    const isNew = !d;
    d = d || { id: nextId('DP'), projectId: pid || (UI.view === 'project' && UI.projectId) || S.projects[0].id, status: 'Open', responsible: 'TBD', externalOwner: 'TBD', escalation: 'No' };
    openForm(isNew ? 'New dependency' : 'Waiting on', [
      { k: 'desc', label: 'What are we waiting for?', type: 'textarea', full: true, req: true, rows: 2 },
      { k: 'projectId', label: 'Project', type: 'select', full: true, options: S.projects.map(p => [p.id, p.name]) },
      { k: 'externalOwner', label: 'Waiting on', type: 'datalist', options: people(), tbd: true },
      { k: 'requiredBy', label: 'Needed by', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: opt('dependencyStatuses') },
      { k: 'responsible', label: 'Chased by', type: 'datalist', options: people(), tbd: true },
      { k: 'escalation', label: 'When to escalate', full: true, more: true },
      { k: 'id', label: 'Dependency ID', req: true, more: true }
    ], d, o => {
      if (isNew) {
        S.dependencies.push(Object.assign(d, o));
        commit('Logged dependency ' + d.id + ' for ' + d.projectId);
      } else {
        Object.assign(d, o);
        commit('Updated dependency ' + d.id);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-dep" data-id="' + esc(d.id) + '">Delete</button>');
  }

  function decisionForm(d) {
    const isNew = !d;
    d = d || { id: nextId('DEC'), projectId: UI.view === 'project' ? UI.projectId : '', owner: UI.me || 'Head of Sales', raised: todayStr(), status: 'Open', source: 'Logged by user' };
    const projOpts = S.projects.map(p => [p.id, p.name]);
    const deciding = !isNew && openDec(d);
    const fields = isNew ? [
      { k: 'decision', label: 'What needs deciding?', type: 'textarea', full: true, req: true, rows: 2 },
      { k: 'projectId', label: 'Project', type: 'select', allowBlank: true, full: true, options: projOpts },
      { k: 'owner', label: 'Who decides', type: 'datalist', options: people(), tbd: true },
      { k: 'requiredBy', label: 'Needed by', type: 'date' },
      { k: 'impact', label: 'What happens if it waits', type: 'textarea', full: true, rows: 2, more: true },
      { k: 'raised', label: 'Date raised', type: 'date', req: true, more: true },
      { k: 'status', label: 'Status', type: 'select', options: opt('decisionStatuses'), more: true },
      { k: 'final', label: 'Decision made', type: 'textarea', full: true, more: true },
      { k: 'id', label: 'Decision ID', req: true, more: true }
    ] : [
      { k: '_q', type: 'static', label: 'The question', text: d.decision },
      { k: '_i', type: 'static', label: 'If it waits', text: d.impact || 'Not recorded' },
      { k: 'final', label: deciding ? 'What did you decide?' : 'Decision made', type: 'textarea', full: true, rows: 3, hint: deciding ? 'Writing your decision here closes it.' : '' },
      { k: 'owner', label: 'Who decides', type: 'datalist', options: people(), tbd: true },
      { k: 'requiredBy', label: 'Needed by', type: 'date' },
      { k: 'status', label: 'Status', type: 'select', options: opt('decisionStatuses'), more: true },
      { k: 'decision', label: 'Reword the question', type: 'textarea', full: true, more: true },
      { k: 'impact', label: 'What happens if it waits', type: 'textarea', full: true, more: true },
      { k: 'projectId', label: 'Project', type: 'select', allowBlank: true, full: true, options: projOpts, more: true },
      { k: 'raised', label: 'Date raised', type: 'date', req: true, more: true },
      { k: 'id', label: 'Decision ID', req: true, more: true }
    ];
    openForm(isNew ? 'New decision' : 'Decision', fields, d, o => {
      if (isNew) {
        S.decisions.push(Object.assign(d, o));
        commit('Logged decision ' + d.id);
      } else {
        const wasOpen = openDec(d);
        if (wasOpen && o.final && o.status === d.status) o.status = closedDecStatus();
        Object.assign(d, o);
        if (wasOpen && !openDec(d)) d.decidedAt = todayStr();
        commit('Decision ' + d.id + ' → ' + d.status);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-decision" data-id="' + esc(d.id) + '">Delete</button>', deciding ? 'Save decision' : 'Save');
  }

  function updateForm(u, pid) {
    const isNew = !u;
    u = u || { id: uid('U'), projectId: pid || (UI.view === 'project' ? UI.projectId : (S.projects[0] || {}).id), week: weekStart(), rag: 'Green', author: UI.me || '' };
    openForm(isNew ? 'Weekly update' : 'Edit weekly update', [
      { k: 'projectId', label: 'Project', type: 'select', full: true, options: S.projects.map(p => [p.id, p.name]) },
      { k: 'rag', label: 'How is it going?', type: 'select', full: true, options: opt('updateRag').map(r => [r, RAG_WORD[r] || r]) },
      { k: 'progress', label: 'What got done last week?', type: 'textarea', full: true, req: true },
      { k: 'next', label: 'What will get done next week?', type: 'textarea', full: true, req: true },
      { k: 'blockers', label: 'What is in the way?', type: 'textarea', full: true, rows: 2 },
      { k: 'completed', label: 'Deliverables finished', type: 'textarea', full: true, more: true },
      { k: 'missed', label: 'Commitments missed', type: 'textarea', full: true, more: true },
      { k: 'decisions', label: 'Decisions needed from leadership', type: 'textarea', full: true, more: true },
      { k: 'author', label: 'Added by', type: 'datalist', options: people(), more: true },
      { k: 'week', label: 'Week starting', type: 'date', req: true, more: true }
    ], u, o => {
      if (isNew) {
        S.updates.push(Object.assign(u, o, { ts: nowIso() }));
        commit('Weekly update submitted for ' + u.projectId + ' by ' + u.author);
      } else {
        Object.assign(u, o);
        commit('Weekly update edited for ' + u.projectId);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-update" data-id="' + esc(u.id) + '">Delete</button>');
  }

  function actionForm(a) {
    const isNew = !a;
    a = a || { id: nextId('A'), kind: 'Recommendation', priority: 'P1', bucket: opt('actionBuckets')[0] || 'Implement immediately' };
    openForm(isNew ? 'New action' : 'Action', [
      { k: 'action', label: 'Action', full: true, req: true },
      { k: 'why', label: 'Why it matters', type: 'textarea', full: true, rows: 2 },
      { k: 'ownerRole', label: 'Suggested owner' },
      { k: 'timeline', label: 'When' },
      { k: 'priority', label: 'Priority', type: 'select', options: opt('priorities') },
      { k: 'bucket', label: 'What it needs', type: 'select', options: opt('actionBuckets') },
      { k: 'output', label: 'Expected result', full: true, more: true },
      { k: 'dependency', label: 'Depends on', full: true, more: true },
      { k: 'kind', label: 'Kind', type: 'select', options: opt('actionKinds'), more: true },
      { k: 'projectId', label: 'Project', type: 'select', allowBlank: true, options: S.projects.map(p => [p.id, p.name]), more: true },
      { k: 'taskId', label: 'Task ID', more: true },
      { k: 'id', label: 'Action ID', req: true, more: true }
    ], a, o => {
      if (isNew) {
        S.actions.push(Object.assign(a, o));
        commit('Added action ' + a.id);
      } else {
        Object.assign(a, o);
        commit('Updated action ' + a.id);
      }
    }, isNew ? '' : '<button class="btn danger ghost" data-act="del-action" data-id="' + esc(a.id) + '">Delete</button>');
  }

  // ---------- export / import / print ----------
  function download(name, content, type) {
    const b = new Blob([content], { type: type || 'text/plain' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }

  function csv(rows, cols) {
    const q = v => {
      v = v == null ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return cols.join(',') + '\n' + rows.map(r => cols.map(c => q(typeof c === 'function' ? c(r) : r[c])).join(',')).join('\n');
  }

  function exportCsv(what) {
    const stamp = todayStr();
    if (what === 'projects') download('projects_' + stamp + '.csv', csv(S.projects.map(p => Object.assign({}, p, { health: health(p).rag, progress: projectProgress(p.id), nextMilestone: (nextMilestone(p) || {}).name || '', nextMilestoneDue: (nextMilestone(p) || {}).due || '' })), ['id', 'name', 'category', 'type', 'program', 'priority', 'priorityProposed', 'owner', 'accountable', 'sponsor', 'status', 'health', 'progress', 'start', 'due', 'nextMilestone', 'nextMilestoneDue', 'objective', 'outcome', 'impact', 'metrics', 'dependencies', 'risks', 'nextAction', 'flags']), 'text/csv');
    if (what === 'tasks') download('tasks_' + stamp + '.csv', csv(S.tasks, ['id', 'projectId', 'ws', 'ms', 'name', 'desc', 'owner', 'accountable', 'start', 'due', 'priority', 'status', 'progress', 'kind', 'parent', 'dependency', 'deliverable', 'criteria', r => taskOverdue(r) ? 'OVERDUE' : '']), 'text/csv');
    if (what === 'risks') download('risks_' + stamp + '.csv', csv(S.risks, ['id', 'projectId', 'desc', 'impact', 'probability', 'mitigation', 'owner', 'deadline', 'status', 'source']), 'text/csv');
    if (what === 'dependencies') download('dependencies_' + stamp + '.csv', csv(S.dependencies, ['id', 'projectId', 'desc', 'responsible', 'externalOwner', 'status', 'requiredBy', 'escalation']), 'text/csv');
    if (what === 'decisions') download('decisions_' + stamp + '.csv', csv(S.decisions, ['id', 'projectId', 'decision', 'owner', 'raised', 'requiredBy', 'impact', 'status', 'final', 'source']), 'text/csv');
    toast('CSV exported');
  }

  function importJson(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.projects) || !Array.isArray(d.tasks) || !d.meta) throw new Error('File is not a Control Tower export (missing projects/tasks/meta).');
        ['risks', 'dependencies', 'decisions', 'updates', 'actions', 'activity', 'roles', 'programs'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
        if (!d.governance) d.governance = buildSeed().governance;
        if (!d.options) d.options = buildSeed().options;
        if (!confirm('Replace current data with "' + file.name + '" (' + d.projects.length + ' projects, ' + d.tasks.length + ' tasks)? Current local data will be overwritten.')) return;
        S = d;
        log('Imported data from ' + file.name);
        save(true);
        render();
        toast('Import complete');
      } catch (e) { toast('Import failed: ' + e.message, true); }
    };
    rd.readAsText(file);
  }

  function printProject(p) {
    const h = health(p);
    const ts = pTasks(p.id);
    const w = window.open('', '_blank');
    if (!w) { toast('Pop-up blocked — allow pop-ups to print.', true); return; }
    w.document.write('<html><head><title>' + esc(p.id + ' ' + p.name) + '</title><style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:12px;color:#14213d;padding:24px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}table{border-collapse:collapse;width:100%;margin-top:6px}th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f4f6}dl{display:grid;grid-template-columns:160px 1fr;gap:3px 10px}dt{color:#666}dd{margin:0}.m{color:#666;font-size:11px}</style></head><body>' +
      '<h1>' + esc(p.name) + '</h1><div class="m">' + esc(p.id) + ' · ' + esc(p.category) + ' · ' + esc(p.type) + ' · Printed ' + new Date().toLocaleString() + '</div>' +
      '<h2>Charter</h2><dl><dt>Objective</dt><dd>' + esc(p.objective) + '</dd><dt>Problem</dt><dd>' + esc(p.problem) + '</dd><dt>Expected outcome</dt><dd>' + esc(p.outcome) + '</dd><dt>Impact</dt><dd>' + esc(p.impact) + '</dd><dt>Success metrics</dt><dd>' + (p.metrics || []).map(esc).join('; ') + '</dd><dt>Owner / Accountable / Sponsor</dt><dd>' + esc(p.owner) + ' / ' + esc(p.accountable) + ' / ' + esc(p.sponsor) + '</dd><dt>Dates</dt><dd>' + esc(p.start || 'TBD') + ' → ' + esc(p.due || 'ongoing') + (p.datesProposed ? ' (proposed)' : '') + '</dd><dt>Status / Health / Priority</dt><dd>' + esc(p.status) + ' / ' + h.rag + ' (' + esc(h.reasons.join('; ')) + ') / ' + esc(p.priority) + (p.priorityProposed ? ' (proposed)' : '') + '</dd><dt>Progress</dt><dd>' + projectProgress(p.id) + '%</dd><dt>Next action</dt><dd>' + esc(p.nextAction) + '</dd><dt>Dependencies</dt><dd>' + (p.dependencies || []).map(esc).join('; ') + '</dd><dt>Risks / assumptions</dt><dd>' + (p.risks || []).map(esc).join('; ') + ' | ' + (p.assumptions || []).map(esc).join('; ') + '</dd></dl>' +
      '<h2>RACI</h2><table><tr><th>Item</th><th>R</th><th>A</th><th>C</th><th>I</th></tr>' + (p.raci || []).map(r => '<tr><td>' + esc(r.item) + '</td><td>' + esc(listToStr(r.R)) + '</td><td>' + esc(r.A) + '</td><td>' + esc(listToStr(r.C)) + '</td><td>' + esc(listToStr(r.I)) + '</td></tr>').join('') + '</table>' +
      '<h2>Workstreams & milestones</h2><table><tr><th>Workstream</th><th>Milestone</th><th>Date</th><th>Status</th></tr>' + (p.milestones || []).map(m => '<tr><td>' + esc((ws(p, m.ws) || {}).name || '') + '</td><td>' + esc(m.name) + '</td><td>' + esc(m.due) + '</td><td>' + esc(m.status) + '</td></tr>').join('') + '</table>' +
      '<h2>Tasks (' + ts.length + ')</h2><table><tr><th>ID</th><th>Task</th><th>Owner</th><th>A</th><th>Due</th><th>Prio</th><th>Status</th><th>%</th><th>Deliverable</th></tr>' + ts.map(t => '<tr><td>' + esc(t.id) + '</td><td>' + (t.parent ? '↳ ' : '') + esc(t.name) + '</td><td>' + esc(t.owner) + '</td><td>' + esc(t.accountable) + '</td><td>' + esc(t.due || 'TBD') + '</td><td>' + esc(t.priority) + '</td><td>' + esc(t.status) + '</td><td>' + (t.status === 'Completed' ? 100 : +t.progress || 0) + '</td><td>' + esc(t.deliverable) + '</td></tr>').join('') + '</table>' +
      '<h2>Risks</h2><table><tr><th>ID</th><th>Risk</th><th>Impact</th><th>Prob.</th><th>Mitigation</th><th>Owner</th><th>Status</th></tr>' + S.risks.filter(r => r.projectId === p.id).map(r => '<tr><td>' + esc(r.id) + '</td><td>' + esc(r.desc) + '</td><td>' + esc(r.impact) + '</td><td>' + esc(r.probability) + '</td><td>' + esc(r.mitigation) + '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.status) + '</td></tr>').join('') + '</table>' +
      '<h2>Dependencies</h2><table><tr><th>ID</th><th>Dependency</th><th>External owner</th><th>Required by</th><th>Status</th></tr>' + S.dependencies.filter(d => d.projectId === p.id).map(d => '<tr><td>' + esc(d.id) + '</td><td>' + esc(d.desc) + '</td><td>' + esc(d.externalOwner) + '</td><td>' + esc(d.requiredBy) + '</td><td>' + esc(d.status) + '</td></tr>').join('') + '</table>' +
      '<h2>Latest weekly update</h2>' + (lastUpdate(p.id) ? (u => '<dl><dt>Week</dt><dd>' + esc(u.week) + '</dd><dt>Progress</dt><dd>' + esc(u.progress) + '</dd><dt>Completed</dt><dd>' + esc(u.completed) + '</dd><dt>Blockers</dt><dd>' + esc(u.blockers) + '</dd><dt>Missed</dt><dd>' + esc(u.missed) + '</dd><dt>Next week</dt><dd>' + esc(u.next) + '</dd><dt>Decisions</dt><dd>' + esc(u.decisions) + '</dd></dl>')(lastUpdate(p.id)) : '<div class="m">None submitted.</div>') +
      '<script>window.onload=function(){window.print()}<\/script></body></html>'); w.document.close();
  }

  // ---------- TWO-WAY GOOGLE SHEETS SYNC MODULE ----------
  const SYNC = {
    _timer: null,
    _pollTimer: null,

    get config() {
      if (!S.meta.sync) {
        S.meta.sync = { url: '', enabled: false, autoSync: true, lastSync: null, status: 'idle', error: null, baseVersion: 1 };
      }
      return S.meta.sync;
    },

    init() {
      // Poll every 60 seconds
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(() => {
        if (this.config.enabled && this.config.url && this.config.status !== 'syncing') {
          this.checkRemoteVersion();
        }
      }, 60000);

      // Check when window gains focus
      window.addEventListener('focus', () => {
        if (this.config.enabled && this.config.url && this.config.status !== 'syncing') {
          this.checkRemoteVersion();
        }
      });
    },

    // On opening the site, get the Sheet's data before anyone can edit a stale copy.
    async boot() {
      if (!this.config.enabled || !this.config.url) return;
      this.checking = true;
      this.config.status = 'syncing';
      this.updateUI();
      await this.checkRemoteVersion(true);
      this.checking = false;
      this.updateUI();
    },

    onLocalChange() {
      if (!this.config.enabled || !this.config.url) return;
      if (!this.config.autoSync) return;

      this.config.status = 'syncing';
      this.updateUI();

      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this.push();
      }, 1500);
    },

    async push() {
      if (!this.config.url) {
        toast('Google Sheet sync URL is not configured.', true);
        this.config.status = 'idle';
        this.updateUI();
        return;
      }
      this.config.status = 'syncing';
      this.updateUI();

      try {
        const payload = { action: 'push', state: S };
        const res = await fetch(this.config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        this.config.status = 'connected';
        this.config.error = null;
        this.config.lastSync = nowIso();
        this.config.baseVersion = data.version || ((this.config.baseVersion || 1) + 1);
        this.unsent = false;
        save(false);
        this.updateUI();
      } catch (err) {
        console.error('Sheet push error:', err);
        this.unsent = true;
        this.config.status = 'error';
        this.config.error = 'Could not save to the Google Sheet (' + err.message + '). Your changes are safe in this browser and will be retried.';
        this.updateUI();
        toast('Could not save to the Google Sheet', true);
      }
    },

    async pull(silent) {
      if (!this.config.url) {
        toast('Google Sheet sync URL is not configured.', true);
        return;
      }
      this.config.status = 'syncing';
      this.updateUI();

      try {
        const sep = this.config.url.includes('?') ? '&' : '?';
        const res = await fetch(this.config.url + sep + 'action=pull&_=' + Date.now());
        const data = await res.json();
        if (data.error && !data.ok) throw new Error(data.error);

        const receivedState = data.state || data;
        if (!receivedState.projects || !receivedState.tasks) {
          if (data.empty || (Array.isArray(receivedState.projects) && receivedState.projects.length === 0)) {
            console.log('Sheet is empty, pushing local state...');
            await this.push();
            return;
          }
          throw new Error('Invalid state received from Sheet.');
        }

        const currentSync = Object.assign({}, this.config, {
          status: 'connected',
          error: null,
          lastSync: nowIso(),
          baseVersion: data.version !== undefined ? data.version : ((receivedState.meta && receivedState.meta.version) || 1)
        });

        const prevOptions = S.options;
        S = receivedState;
        S.meta = S.meta || {};
        S.meta.sync = currentSync;
        S.options = S.options || prevOptions;
        ['projects', 'tasks', 'risks', 'dependencies', 'decisions', 'updates', 'actions', 'programs', 'roles', 'activity'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });
        save(false);
        render();
        if (!silent) toast('Got the latest from the Google Sheet');
      } catch (err) {
        console.error('Sheet pull error:', err);
        this.config.status = 'error';
        this.config.error = 'Could not get the latest from the Google Sheet (' + err.message + ').';
        this.updateUI();
        if (!silent) toast('Could not get the latest from the Google Sheet', true);
      }
    },

    async checkRemoteVersion(boot) {
      if (!this.config.url) return;
      try {
        const sep = this.config.url.includes('?') ? '&' : '?';
        const res = await fetch(this.config.url + sep + '_=' + Date.now());
        const data = await res.json();
        const ver = data.version !== undefined ? data.version : (data.meta && data.meta.version);
        if (ver !== undefined && ver > (this.config.baseVersion || 0)) {
          await this.pull(true);
        } else if (this.unsent) {
          await this.push();
        } else if (boot || this.config.status === 'error') {
          this.config.status = 'connected';
          this.config.error = null;
          this.config.lastSync = nowIso();
          this.updateUI();
        }
      } catch (e) {
        this.config.status = 'error';
        this.config.error = 'Could not reach the Google Sheet. Changes stay in this browser until it is back.';
        this.updateUI();
      }
    },

    updateUI() {
      const el = $('#sync-indicator');
      if (!el) return;
      const c = this.config;
      const last = c.lastSync ? ' Last synced ' + new Date(c.lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '.' : '';
      const v = !c.url || !c.enabled ? ['grey', 'This browser only', 'Not connected to the Google Sheet.']
        : this.checking ? ['blue', 'Checking', 'Getting the latest from the Google Sheet.']
          : c.status === 'syncing' ? ['blue', 'Saving', 'Saving to the Google Sheet.']
            : c.status === 'error' ? ['red', 'Not saved', c.error || 'Could not reach the Google Sheet.']
              : ['green', 'Saved', 'Saved to the Google Sheet.' + last];
      el.innerHTML = '<button class="sync ' + v[0] + '" data-act="open-sync" title="' + esc(v[2]) + '" aria-label="Sheet status: ' + esc(v[1]) + '. ' + esc(v[2]) + '"><i></i><span>' + esc(v[1]) + '</span></button>';
    }
  };
  window.SYNC = SYNC;

  // ---------- find anything ----------
  function findItems(raw) {
    const q = raw.toLowerCase().trim();
    if (!q) return [];
    const out = [];
    const add = (kind, title, sub, act, attrs, hay) => {
      const t = title.toLowerCase();
      if (!(hay + ' ' + t).toLowerCase().includes(q)) return;
      out.push({ kind, title, sub, act, attrs, score: t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2 });
    };
    S.projects.forEach(p => add('Project', p.name, '', 'open', 'data-id="' + esc(p.id) + '"', p.id + ' ' + p.owner + ' ' + p.category + ' ' + p.objective));
    S.tasks.forEach(t => add('Task', t.name, pName(t.projectId), 'edit-task', 'data-id="' + esc(t.id) + '"', t.id + ' ' + t.owner + ' ' + (t.desc || '') + ' ' + (t.deliverable || '')));
    S.decisions.forEach(d => add('Decision', d.decision, d.projectId ? pName(d.projectId) : '', 'edit-decision', 'data-id="' + esc(d.id) + '"', d.id + ' ' + d.owner));
    S.risks.forEach(r => add('Risk', r.desc, pName(r.projectId), 'edit-risk', 'data-id="' + esc(r.id) + '"', r.id + ' ' + r.owner));
    S.dependencies.forEach(d => add('Waiting on', d.desc, pName(d.projectId), 'edit-dep', 'data-id="' + esc(d.id) + '"', d.id + ' ' + d.externalOwner));
    const rank = { Project: 0, Decision: 1, Task: 2, Risk: 3, 'Waiting on': 4 };
    return out.sort((a, b) => a.score - b.score || rank[a.kind] - rank[b.kind]);
  }

  function showFind() {
    const box = $('#find-results');
    const input = $('#q');
    const v = input.value;
    if (!v.trim()) { box.hidden = true; box.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); return; }
    const all = findItems(v);
    const items = all.slice(0, 8);
    UI.findSel = Math.min(UI.findSel || 0, Math.max(items.length - 1, 0));
    box.innerHTML = items.length ? items.map((it, i) => '<button class="fr' + (i === UI.findSel ? ' sel' : '') + '" role="option" aria-selected="' + (i === UI.findSel) + '" data-act="' + it.act + '" ' + it.attrs + '><span class="fr-t">' + esc(it.title) + '</span><span class="fr-s">' + esc(it.sub ? it.kind + ' in ' + it.sub : it.kind) + '</span></button>').join('') + (all.length > 8 ? '<p class="quiet">' + (all.length - 8) + ' more. Keep typing to narrow it down.</p>' : '')
      : '<p class="quiet">Nothing found for "' + esc(v.trim()) + '".</p>';
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function clearFind() {
    const input = $('#q');
    input.value = '';
    UI.findSel = 0;
    showFind();
  }

  function closeMenus() {
    document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('[data-act="menu"][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  // ---------- events ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    const act = el ? el.dataset.act : '';
    if (act !== 'menu' && !e.target.closest('.menu.keep')) closeMenus();
    if (!e.target.closest('.find')) { const box = $('#find-results'); if (box) box.hidden = true; }
    if (!el) return;
    const id = el.dataset.id;
    const D = {
      nav: () => go(el.dataset.v),
      open: () => go('project', { id, tab: el.dataset.tab }),
      go: () => { const g = JSON.parse(el.dataset.go); go(g.v, g); },
      'go-portfolio': () => go('portfolio', { chip: 'all' }),
      'go-attention': () => go('portfolio', { chip: 'attention' }),
      'go-chip': () => go('portfolio', { chip: el.dataset.chip }),
      'go-week': () => go('tasks', { tab: 'week' }),
      'go-unassigned': () => go('tasks', { tab: 'unassigned' }),
      'go-decisions': () => go('decisions'),
      menu: () => {
        const m = $('#menu-' + el.dataset.m);
        const was = m && m.classList.contains('open');
        closeMenus();
        if (m && !was) { m.classList.add('open'); el.setAttribute('aria-expanded', 'true'); }
      },
      group: () => { UI.open[el.dataset.k] = el.getAttribute('aria-expanded') !== 'true'; render(); },
      ptab: () => { UI.ptab = el.dataset.tab; render(); },
      tfilter: () => { UI.taskFilter = el.dataset.f; render(); },
      rtab: () => { UI.riskTab = el.dataset.tab; render(); },
      atab: () => { UI.actionTab = el.dataset.tab; render(); },
      rctab: () => { UI.raciTab = el.dataset.tab; render(); },
      wtab: () => { UI.weekTab = el.dataset.tab; render(); },
      pmode: () => { UI.pmode = el.dataset.tab; render(); },
      pchip: () => { UI.pchip = el.dataset.h; render(); },
      'toggle-filters': () => { UI.showFilters = !UI.showFilters; render(); },
      'toggle-charts': () => { UI.showCharts = !UI.showCharts; render(); },
      'clear-filters': () => { UI.filters = {}; render(); },
      'gantt-toggle': () => { UI.ganttOpen[id] = !UI.ganttOpen[id]; render(); },
      'gantt-all': () => { S.projects.forEach(p => UI.ganttOpen[p.id] = el.dataset.open === '1'); render(); },
      'close-modal': tryCloseModal,
      'save-modal': () => $('#modal-root')._onSave(),
      'toast-undo': () => { const u = toast._undo; toast._undo = null; $('#toast').className = 'toast'; if (u) u(); },

      // Projects
      'add-project': () => projectForm(null),
      'edit-project': () => projectForm(P(id)),
      'del-project': () => {
        const p = P(id); const n = pTasks(id).length;
        if (!confirm('Delete project ' + p.id + ' "' + p.name + '" and its ' + n + ' tasks, risks, dependencies, decisions and updates? This cannot be undone.')) return;
        S.projects = S.projects.filter(x => x.id !== id);
        S.tasks = S.tasks.filter(t => t.projectId !== id);
        S.risks = S.risks.filter(r => r.projectId !== id);
        S.dependencies = S.dependencies.filter(d => d.projectId !== id);
        S.decisions = S.decisions.filter(d => d.projectId !== id);
        S.updates = S.updates.filter(u => u.projectId !== id);
        (S.programs || []).forEach(pg => pg.children = (pg.children || []).filter(c => c !== id));
        log('Deleted project ' + p.id + ' ' + p.name);
        save(true);
        closeModal();
        go('portfolio');
        toast('Project deleted');
      },

      // Programs
      'add-program': () => programForm(null),
      'edit-program': () => programForm(S.programs.find(x => x.id === id)),
      'del-program': () => {
        const pg = S.programs.find(x => x.id === id);
        if (!pg) return;
        if (!confirm('Delete program ' + pg.id + ' "' + pg.name + '"? Child projects will be unlinked.')) return;
        S.programs = S.programs.filter(x => x.id !== id);
        S.projects.forEach(p => { if (p.program === id) p.program = null; });
        commit('Deleted program ' + id);
      },

      // People & Roles
      'add-role': () => roleForm(null),
      'edit-role': () => roleForm(S.roles.find(r => r.name === id)),
      'del-role': () => deletePerson(id),

      // Tasks
      'task-done': () => {
        const t = S.tasks.find(x => x.id === id);
        const before = { status: t.status, progress: t.progress, completedAt: t.completedAt };
        const undo = () => { Object.assign(t, before); log('Task ' + t.id + ' restored to ' + t.status); save(true); render(); };
        if (t.status === 'Completed') {
          t.status = 'In Progress';
          t.completedAt = '';
          if (+t.progress === 100) t.progress = 0;
          log('Task ' + t.id + ' reopened');
          save(true); render();
          toast('Task reopened', false, undo);
        } else {
          t.status = 'Completed';
          t.progress = 100;
          t.completedAt = todayStr();
          log('Task ' + t.id + ' status: ' + before.status + ' → Completed');
          save(true); render();
          toast('Task done', false, undo);
        }
      },
      'add-task': () => taskForm(null, el.dataset.pid),
      'edit-task': () => taskForm(S.tasks.find(t => t.id === id)),
      'add-subtask': () => { const t = S.tasks.find(x => x.id === id); taskForm(null, t.projectId, t.id); },
      'del-task': () => {
        const t = S.tasks.find(x => x.id === id); const subs = S.tasks.filter(x => x.parent === id).length;
        if (!confirm('Delete task ' + t.id + ' "' + t.name + '"' + (subs ? ' and its ' + subs + ' subtask(s)' : '') + '?')) return;
        S.tasks = S.tasks.filter(x => x.id !== id && x.parent !== id);
        commit('Deleted task ' + t.id + ' from ' + t.projectId);
      },

      // Milestones & Workstreams
      'add-ms': () => msForm(P(id)),
      'edit-ms': () => msForm(P(id), ms(P(id), el.dataset.ms)),
      'del-ms': () => {
        const p = P(id); const m = ms(p, el.dataset.ms);
        if (!confirm('Delete milestone "' + m.name + '"?')) return;
        p.milestones = p.milestones.filter(x => x !== m);
        pTasks(p.id).forEach(t => { if (t.ms === m.id) t.ms = ''; });
        commit('Deleted milestone ' + m.id + ' from ' + p.id);
      },
      'add-ws': () => wsForm(P(id)),
      'edit-ws': () => wsForm(P(id), ws(P(id), el.dataset.ws)),
      'del-ws': () => {
        const p = P(id); const w = ws(p, el.dataset.ws);
        if (!confirm('Delete workstream "' + w.name + '"? Its milestones and tasks are kept but unlinked.')) return;
        p.workstreams = p.workstreams.filter(x => x !== w);
        p.milestones.forEach(m => { if (m.ws === w.id) m.ws = ''; });
        pTasks(p.id).forEach(t => { if (t.ws === w.id) t.ws = ''; });
        commit('Deleted workstream ' + w.id + ' from ' + p.id);
      },

      // RACI
      'add-raci': () => raciForm(P(id)),
      'edit-raci': () => raciForm(P(id), +el.dataset.i),
      'del-raci': () => {
        const p = P(id); const r = p.raci[+el.dataset.i];
        if (!confirm('Delete RACI entry "' + r.item + '"?')) return;
        p.raci.splice(+el.dataset.i, 1);
        commit('Deleted RACI entry from ' + p.id);
      },

      // Risks & Dependencies
      'add-risk': () => riskForm(null, el.dataset.pid),
      'edit-risk': () => riskForm(S.risks.find(r => r.id === id)),
      'del-risk': () => {
        if (!confirm('Delete risk ' + id + '?')) return;
        S.risks = S.risks.filter(r => r.id !== id);
        commit('Deleted risk ' + id);
      },
      'add-dep': () => depForm(null, el.dataset.pid),
      'edit-dep': () => depForm(S.dependencies.find(d => d.id === id)),
      'del-dep': () => {
        if (!confirm('Delete dependency ' + id + '?')) return;
        S.dependencies = S.dependencies.filter(d => d.id !== id);
        commit('Deleted dependency ' + id);
      },

      // Decisions
      'add-decision': () => decisionForm(null),
      'edit-decision': () => decisionForm(S.decisions.find(d => d.id === id)),
      'del-decision': () => {
        if (!confirm('Delete decision ' + id + '?')) return;
        S.decisions = S.decisions.filter(d => d.id !== id);
        commit('Deleted decision ' + id);
      },

      // Updates
      'add-update': () => updateForm(null, el.dataset.pid),
      'edit-update': () => updateForm(S.updates.find(u => u.id === id)),
      'del-update': () => {
        if (!confirm('Delete this weekly update?')) return;
        S.updates = S.updates.filter(u => u.id !== id);
        commit('Deleted a weekly update');
      },

      // Actions
      'add-action': () => actionForm(null),
      'edit-action': () => actionForm(S.actions.find(a => a.id === id)),
      'del-action': () => {
        if (!confirm('Delete action ' + id + '?')) return;
        S.actions = S.actions.filter(a => a.id !== id);
        commit('Deleted action ' + id);
      },

      // Governance
      'edit-cadence': () => editCadence(el.dataset.cadence),
      'edit-rag': () => editRag(),
      'add-classification': () => classificationForm(null, null),
      'edit-classification': () => classificationForm(S.governance.classification[+el.dataset.i], +el.dataset.i),
      'del-classification': () => {
        if (!confirm('Delete classification row?')) return;
        S.governance.classification.splice(+el.dataset.i, 1);
        commit('Deleted classification row');
      },

      // Option lists
      'edit-option-list': () => editOptionList(el.dataset.opt),

      // Comments
      'edit-comment': () => {
        const p = P(el.dataset.pid);
        const idx = +el.dataset.i;
        const c = p.comments[idx];
        openForm('Edit comment', [
          { k: 'text', label: 'Comment', type: 'textarea', full: true, req: true }
        ], { text: c.text }, o => {
          c.text = o.text;
          c.editedAt = nowIso();
          commit('Comment updated on ' + p.id);
        });
      },
      'del-comment': () => {
        const p = P(el.dataset.pid);
        const idx = +el.dataset.i;
        if (!confirm('Delete this comment?')) return;
        p.comments.splice(idx, 1);
        commit('Comment deleted from ' + p.id);
      },

      // Google Sheet Sync Actions
      'open-sync': () => {
        go('data');
        setTimeout(() => {
          const card = $('#sync-card');
          if (card) card.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      'save-sync-config': () => {
        const urlInput = $('#sync-url-input');
        const autoInput = $('#sync-auto-input');
        const url = (urlInput ? urlInput.value.trim() : '');
        const auto = autoInput ? autoInput.checked : true;
        S.meta.sync = S.meta.sync || {};
        S.meta.sync.url = url;
        S.meta.sync.enabled = !!url;
        S.meta.sync.autoSync = auto;
        S.meta.sync.status = url ? 'connected' : 'idle';
        S.meta.sync.error = null;
        save(false);
        render();
        toast('Sync configuration saved!');
      },
      'sync-pull': () => SYNC.pull(false),
      'sync-push': () => SYNC.push(),
      'sync-test': async () => {
        const url = ($('#sync-url-input') ? $('#sync-url-input').value.trim() : (S.meta.sync && S.meta.sync.url)) || '';
        if (!url) { toast('Please enter a Web App URL first.', true); return; }
        toast('Testing connection to Google Sheet...');
        try {
          const sep = url.includes('?') ? '&' : '?';
          const res = await fetch(url + sep + '_=' + Date.now());
          const d = await res.json();
          if (d.error && !d.ok) throw new Error(d.error);
          toast('Connection successful! Google Sheet: ' + (d.sheet || 'Connected') + ' (v' + (d.version !== undefined ? d.version : 1) + ')');
        } catch (err) {
          toast('Connection failed: ' + err.message, true);
        }
      },

      // General
      'export-json': () => { download('suraasa_control_tower_' + todayStr() + '.json', JSON.stringify(S, null, 2), 'application/json'); toast('JSON exported'); },
      'export-csv': () => exportCsv(el.dataset.what),
      'print-project': () => printProject(P(id)),
      'print-portfolio': () => { go('portfolio'); setTimeout(() => window.print(), 200); },
      reset: () => {
        if (!confirm('Reset ALL data to the initial seed? Every local change (tasks, updates, decisions, RACI edits) will be lost.')) return;
        if (!confirm('Are you sure? This cannot be undone unless you exported a JSON first.')) return;
        S = buildSeed();
        save(false);
        UI.filters = {};
        go('overview');
        toast('Reset to seed data');
      }
    };
    const fromFind = !!el.closest('#find-results');
    if (D[act]) { e.preventDefault(); D[act](); }
    if (fromFind) clearFind();
  });

  document.addEventListener('change', e => {
    const el = e.target.closest('[data-act]'); if (!el) return; const act = el.dataset.act; const id = el.dataset.id;
    if (act === 'filter') { UI.filters[el.dataset.k] = el.value; render(); }
    else if (act === 'sort-sel') { UI.sort[el.dataset.t] = el.value; render(); }
    else if (act === 'tgroup') { UI.tgroup = el.value; render(); }
    else if (act === 'set-me') {
      UI.me = el.value;
      try { localStorage.setItem('sct_me', UI.me); } catch (err) { /* private window */ }
      render();
    }
    else if (act === 'task-status') {
      const t = S.tasks.find(x => x.id === id);
      const was = t.status;
      t.status = el.value;
      if (t.status === 'Completed') { t.progress = 100; t.completedAt = todayStr(); }
      commit('Task ' + t.id + ' status: ' + was + ' → ' + t.status);
    }
  });

  // Keep the milestone and workstream choices in step with the chosen project.
  document.addEventListener('change', e => {
    if (e.target.name !== 'projectId' || !e.target.closest('#mform')) return;
    const p = P(e.target.value) || {};
    const fill = (name, items) => {
      const sel = $('#mform [name="' + name + '"]');
      if (sel) sel.innerHTML = '<option value="">None</option>' + items.map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>').join('');
    };
    fill('ms', p.milestones || []);
    fill('ws', p.workstreams || []);
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-act="add-comment"]');
    if (!f) return;
    e.preventDefault();
    const p = P(f.dataset.pid);
    const c = f.c.value.trim();
    if (!c) return;
    p.comments = p.comments || [];
    p.comments.push({ text: c, who: f.who.value.trim() || UI.me || 'Someone', ts: nowIso() });
    commit('Comment added on ' + p.id);
  });

  document.addEventListener('keydown', e => {
    if (e.target.id === 'q') {
      const opts = [...document.querySelectorAll('#find-results .fr')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (opts.length) { UI.findSel = (UI.findSel + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; showFind(); }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); if (opts[UI.findSel]) opts[UI.findSel].click(); return; }
      if (e.key === 'Escape') { clearFind(); e.target.blur(); return; }
    }
    if (e.key === 'Escape') {
      if (document.querySelector('.menu.open')) closeMenus();
      else if ($('#modal')) tryCloseModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && $('#modal')) $('#modal-root')._onSave();
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !$('#modal')) {
      e.preventDefault();
      const q = $('#q');
      if (q) { q.focus(); q.select(); }
    }
  });

  document.addEventListener('click', e => {
    if (e.target.id === 'modal') tryCloseModal();
    if (e.target.closest('#theme-toggle')) toggleTheme();
  });

  // ---------- theme ----------
  function themeLabel() {
    const b = $('#theme-toggle');
    if (b) b.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Use light theme' : 'Use dark theme';
  }
  function initTheme() {
    let saved = '';
    try { saved = localStorage.getItem('sct_theme') || ''; } catch (e) { /* private window */ }
    if (!saved) saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', saved);
    themeLabel();
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('sct_theme', next); } catch (e) { /* private window */ }
    themeLabel();
  }
  document.addEventListener('change', e => {
    if (e.target.id === 'importFile' && e.target.files[0]) { importJson(e.target.files[0]); e.target.value = ''; }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'q') { UI.findSel = 0; showFind(); }
  });
  document.addEventListener('focusin', e => {
    if (e.target.id === 'q' && e.target.value.trim()) showFind();
  });

  // ---------- boot ----------
  initTheme();
  load();
  try { UI.me = localStorage.getItem('sct_me') || ''; } catch (e) { /* private window */ }
  SYNC.init();
  render();
  SYNC.boot();
  window.SCT = { get state() { return S; }, health, stats, actionQueue, raciIssues, renamePerson, deletePerson };
})();
