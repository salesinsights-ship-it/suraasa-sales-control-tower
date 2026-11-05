/* ============================================================
   Business rules: task lifecycle, progress, health, dependencies
   and notifications. Pure functions with no page access, so they
   can be tested on their own.
   ============================================================ */
const ENGINE = (function () {
  const TASK_STATUSES = ['Backlog', 'Not Started', 'In Progress', 'Blocked', 'On Hold', 'In Review', 'Awaiting Approval', 'Changes Requested', 'Completed', 'Cancelled'];
  const TRANSITIONS = {
    'Backlog': ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    'Not Started': ['Backlog', 'In Progress', 'Blocked', 'On Hold', 'Completed', 'Cancelled'],
    'In Progress': ['Not Started', 'Blocked', 'On Hold', 'In Review', 'Completed', 'Cancelled'],
    'Blocked': ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    'On Hold': ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Cancelled'],
    'In Review': ['Not Started', 'In Progress', 'On Hold', 'Changes Requested', 'Completed', 'Cancelled'],
    'Awaiting Approval': ['Not Started', 'In Progress', 'On Hold', 'In Review', 'Changes Requested', 'Completed', 'Cancelled'],
    'Changes Requested': ['Not Started', 'In Progress', 'On Hold', 'In Review', 'Blocked', 'Completed', 'Cancelled'],
    'Completed': ['In Progress', 'Not Started', 'On Hold', 'In Review', 'Awaiting Approval', 'Cancelled'],
    'Cancelled': ['Not Started', 'In Progress', 'On Hold', 'Completed']
  };
  // The simple view of a task. Each stage is a way of setting the status, so the two can never disagree.
  const STAGE_STATUS = { 'Not yet started': 'Not Started', 'Moved ahead': 'In Progress', 'Completed': 'Completed', 'Parked': 'On Hold', 'Dropped': 'Cancelled' };
  const STAGES = Object.keys(STAGE_STATUS);
  const stageOf = status => (status === 'Backlog' || status === 'Not Started' || !status ? 'Not yet started' : status === 'Completed' ? 'Completed' : status === 'On Hold' ? 'Parked' : status === 'Cancelled' ? 'Dropped' : 'Moved ahead');
  const DEFAULT_RULES = { overdueShareAtRisk: 10, overdueShareDelayed: 25, stagnantDays: 14, soonDays: 7 };

  const dayNum = s => Math.floor(new Date(s + 'T00:00:00').getTime() / 86400000);
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const isDone = t => t.status === 'Completed';
  const isCancelled = t => t.status === 'Cancelled';
  const isOpen = t => !isDone(t) && !isCancelled(t);
  const nextStatuses = from => TRANSITIONS[from] || TASK_STATUSES;

  /** Why a status move is not allowed, or '' when it is. */
  function moveProblem(t, to, extra) {
    extra = extra || {};
    if (t.status === to) return '';
    if (TRANSITIONS[t.status] && !TRANSITIONS[t.status].includes(to)) return 'A task cannot move from ' + t.status + ' to ' + to + '.';
    if (to === 'Cancelled' && !String(extra.cancelReason || t.cancelReason || '').trim()) return 'Give a reason for cancelling.';
    if (to === 'Blocked' && !String(extra.blockerText || (t.blocker && t.blocker.text) || '').trim()) return 'Say what is blocking this task.';
    if (to === 'Completed' && t.requiresReview && !['In Review', 'Awaiting Approval'].includes(t.status) && !extra.admin) return 'This task must go through review first.';
    return '';
  }

  const subtasksOf = (tasks, id) => tasks.filter(t => t.parent === id);
  const weightOf = t => { const w = Number(t.weight); return w > 0 ? w : 1; };
  const progressMode = (t, tasks) => subtasksOf(tasks, t.id).filter(x => !isCancelled(x)).length ? 'Subtasks' : (t.checklist || []).length ? 'Checklist' : 'Manual';

  /** A task's completion. Finished only when it is really Completed: at most 99 before that. */
  function taskPct(t, tasks) {
    if (isDone(t)) return 100;
    if (isCancelled(t)) return 0;
    const subs = subtasksOf(tasks, t.id).filter(x => !isCancelled(x));
    let v;
    if (subs.length) {
      const total = subs.reduce((a, x) => a + weightOf(x), 0);
      v = subs.reduce((a, x) => a + weightOf(x) * taskPct(x, tasks), 0) / total;
    } else if ((t.checklist || []).length) {
      v = t.checklist.filter(c => c.done).length / t.checklist.length * 100;
    } else {
      v = Number(t.progress) || 0;
    }
    return Math.min(99, Math.round(Math.max(0, v)));
  }

  /** Top-level, non-recurring, non-cancelled tasks count. Subtasks count through their parent. */
  const countedTasks = tasks => tasks.filter(t => !t.parent && !isCancelled(t) && t.kind !== 'Recurring');

  function projectPct(tasksOfProject) {
    const list = countedTasks(tasksOfProject);
    if (!list.length) return 0;
    const total = list.reduce((a, t) => a + weightOf(t), 0);
    return Math.round(list.reduce((a, t) => a + weightOf(t) * taskPct(t, tasksOfProject), 0) / total);
  }

  function milestonePct(m, tasksOfProject) {
    const list = countedTasks(tasksOfProject).filter(t => t.ms === m.id);
    if (!list.length) return m.status === 'Completed' ? 100 : 0;
    const total = list.reduce((a, t) => a + weightOf(t), 0);
    return Math.round(list.reduce((a, t) => a + weightOf(t) * taskPct(t, tasksOfProject), 0) / total);
  }

  function projectCounts(tasksOfProject, today) {
    const all = tasksOfProject.filter(t => !isCancelled(t));
    const open = all.filter(isOpen);
    const overdue = open.filter(t => isDate(t.due) && dayNum(t.due) < today);
    return { total: all.length, done: all.filter(isDone).length, open: open.length, overdue: overdue.length, blocked: open.filter(t => t.status === 'Blocked').length, review: open.filter(t => t.status === 'In Review' || t.status === 'Awaiting Approval').length };
  }

  const readyForClosure = (p, tasksOfProject) => {
    if (p.status === 'Completed' || p.archivedAt) return false;
    const list = tasksOfProject.filter(t => !isCancelled(t));
    if (!list.length) return false;
    return list.every(isDone) && (p.milestones || []).every(m => m.status === 'Completed' || list.filter(t => t.ms === m.id).every(isDone));
  };

  /**
   * Health, always with its reasons.
   * d = { tasks, milestones, deps, lastUpdateTs, today, now, rules, progressAgo }
   */
  function health(p, d) {
    const r = Object.assign({}, DEFAULT_RULES, d.rules || {});
    const today = d.today;
    const daysTo = s => isDate(s) ? dayNum(s) - today : null;
    if (p.status === 'Completed') return { rag: 'Green', level: 'Completed', reasons: ['Completed'] };
    const ts = d.tasks.filter(t => !isCancelled(t));
    const open = ts.filter(isOpen);
    const overdue = open.filter(t => isDate(t.due) && daysTo(t.due) < 0);
    const high = overdue.filter(t => t.priority === 'P0' || t.priority === 'P1');
    const share = open.length ? Math.round(overdue.length / open.length * 100) : 0;
    const lateMs = (p.milestones || []).filter(m => m.status !== 'Completed' && isDate(m.due) && daysTo(m.due) < 0);
    const lateDeps = d.deps.filter(x => isDate(x.requiredBy) && daysTo(x.requiredBy) < 0);
    const blocked = open.filter(t => t.status === 'Blocked');

    if (p.status === 'Blocked' || blocked.some(t => t.priority === 'P0')) {
      const why = [];
      if (p.status === 'Blocked') why.push('Project status is Blocked');
      if (blocked.length) why.push(blocked.length + ' blocked task' + (blocked.length > 1 ? 's' : ''));
      return { rag: 'Red', level: 'Blocked', reasons: why };
    }
    const red = [];
    if (lateMs.length) red.push(lateMs.length + ' overdue milestone' + (lateMs.length > 1 ? 's' : ''));
    if (lateDeps.length) red.push(lateDeps.length + ' dependency past its needed-by date');
    if (high.length) red.push(high.length + ' high-priority task' + (high.length > 1 ? 's' : '') + ' overdue');
    if (overdue.length >= 2 && share >= r.overdueShareDelayed) red.push(overdue.length + ' of ' + open.length + ' open tasks overdue');
    if (red.length) return { rag: 'Red', level: 'Delayed', reasons: red };

    const started = p.status !== 'Not Started' || ts.some(t => t.status !== 'Not Started' && t.status !== 'Backlog');
    if (!started && !overdue.length) return { rag: 'Grey', level: 'Not started', reasons: ['Not started'] };

    const amber = [];
    if (overdue.length) amber.push(overdue.length + ' of ' + open.length + ' open tasks overdue');
    if (blocked.length) amber.push(blocked.length + ' blocked task' + (blocked.length > 1 ? 's' : ''));
    (p.milestones || []).filter(m => m.status !== 'Completed' && isDate(m.due) && daysTo(m.due) <= r.soonDays).forEach(m => {
      const pct = milestonePct(m, d.tasks);
      if (pct < 50) amber.push('Milestone "' + m.name + '" is due in ' + daysTo(m.due) + 'd at ' + pct + '%');
    });
    const soon = open.filter(t => isDate(t.due) && daysTo(t.due) <= r.soonDays && (Number(t.progress) || 0) < 50 && (t.priority === 'P0' || t.priority === 'P1'));
    if (soon.length) amber.push(soon.length + ' high-priority task' + (soon.length > 1 ? 's' : '') + ' due within ' + r.soonDays + ' days and under 50%');
    const soonDeps = d.deps.filter(x => isDate(x.requiredBy) && daysTo(x.requiredBy) <= r.soonDays * 2);
    if (soonDeps.length) amber.push(soonDeps.length + ' open dependency due soon');
    if (p.status === 'In Progress') {
      const age = d.lastUpdateTs ? (d.now - new Date(d.lastUpdateTs).getTime()) / 86400000 : null;
      if (age == null) amber.push('No weekly update yet');
      else if (age > r.stagnantDays) amber.push('No update for ' + Math.round(age) + ' days');
    }
    if (d.progressAgo != null && p.status === 'In Progress' && open.length && d.progressAgo >= d.progressNow) amber.push('No progress in the last ' + r.stagnantDays + ' days');
    if (/^\s*tbd/i.test(p.accountable || 'tbd')) amber.push('No confirmed answerable person');
    if (p.status === 'On Hold') amber.push('On hold');
    if (amber.length) return { rag: 'Amber', level: 'At risk', reasons: amber };
    return { rag: 'Green', level: 'On track', reasons: ['On track'] };
  }

  // ---------- dependencies ----------
  function wouldLoop(tasks, id, deps) {
    const map = {};
    tasks.forEach(t => { map[t.id] = t.dependsOn || []; });
    map[id] = deps || [];
    const seen = new Set(), stack = (deps || []).slice();
    while (stack.length) {
      const x = stack.pop();
      if (x === id) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      (map[x] || []).forEach(y => stack.push(y));
    }
    return false;
  }
  /** Every task that waits, directly or not, on this one. */
  function downstream(tasks, id) {
    const out = [], seen = new Set([id]);
    let frontier = [id];
    while (frontier.length) {
      const next = [];
      tasks.forEach(t => { if (!seen.has(t.id) && (t.dependsOn || []).some(d => frontier.includes(d))) { seen.add(t.id); out.push(t); next.push(t.id); } });
      frontier = next;
    }
    return out;
  }
  const waitingOn = (tasks, t) => (t.dependsOn || []).map(id => tasks.find(x => x.id === id)).filter(x => x && !isDone(x) && !isCancelled(x));

  // ---------- notifications ----------
  /**
   * Built from the data and the audit log, so each one has a stable id and
   * can never appear twice. d = { me, tasks, projects, audit, today, mine, ownsProject }
   */
  function notifications(d) {
    const out = [];
    const add = (id, kind, text, go, ts, level) => out.push({ id, kind, text, go, ts: ts || '', level: level || 'info' });
    const name = d.me;
    if (!name) return out;
    const todayStr = d.todayStr;
    d.tasks.forEach(t => {
      if (!isOpen(t) || !isDate(t.due)) return;
      const left = dayNum(t.due) - d.today;
      if (d.mine(t.owner)) {
        if (left < 0) add('overdue:' + t.id + ':' + todayStr, 'Overdue', '"' + t.name + '" is ' + Math.abs(left) + (left === -1 ? ' day' : ' days') + ' late', { task: t.id }, '', 'red');
        else if (left === 0) add('due0:' + t.id, 'Due today', '"' + t.name + '" is due today', { task: t.id }, '', 'amber');
        else if (left === 1) add('due1:' + t.id, 'Due tomorrow', '"' + t.name + '" is due tomorrow', { task: t.id }, '', 'amber');
        else if (left === 3) add('due3:' + t.id, 'Due soon', '"' + t.name + '" is due in 3 days', { task: t.id });
      }
    });
    d.tasks.forEach(t => {
      const p = d.projects.find(x => x.id === t.projectId);
      if (t.status === 'Blocked' && p && d.ownsProject(p)) add('blocked:' + t.id + ':' + (t.blocker && t.blocker.ts || ''), 'Blocked', '"' + t.name + '" is blocked' + (t.blocker && t.blocker.text ? ': ' + t.blocker.text : ''), { task: t.id }, t.blocker && t.blocker.ts, 'red');
      if ((t.status === 'In Review' || t.status === 'Awaiting Approval') && p && d.ownsProject(p)) add('review:' + t.id, 'Review requested', '"' + t.name + '" is waiting for your review', { task: t.id }, t.updatedAt, 'amber');
      if (t.extensionRequest && p && d.ownsProject(p)) add('ext:' + t.id + ':' + t.extensionRequest.ts, 'More time requested', '"' + t.name + '": ' + t.extensionRequest.by + ' asked for more time', { task: t.id }, t.extensionRequest.ts, 'amber');
      const last = (t.notes || [])[(t.notes || []).length - 1];
      if (last && last.type === 'question' && last.author !== name && p && d.ownsProject(p)) add('ask:' + last.id, 'Question', last.author + ' asked about "' + t.name + '": ' + last.text, { task: t.id }, last.ts, 'amber');
      if (isOpen(t) && d.mine(t.owner)) {
        const late = waitingOn(d.tasks, t).filter(x => isOpen(x) && isDate(x.due) && dayNum(x.due) < d.today);
        if (late.length) add('wait:' + t.id + ':' + late[0].id, 'Waiting on a late task', '"' + t.name + '" is waiting on "' + late[0].name + '", which is late', { task: t.id }, '', 'amber');
      }
      if (t.status === 'Changes Requested' && d.mine(t.owner)) add('changes:' + t.id + ':' + (t.updatedAt || ''), 'Changes requested', '"' + t.name + '" needs changes', { task: t.id }, t.updatedAt, 'amber');
    });
    d.projects.forEach(p => {
      if (!d.ownsProject(p)) return;
      (p.milestones || []).forEach(m => {
        if (m.status === 'Completed' || !isDate(m.due)) return;
        const left = dayNum(m.due) - d.today;
        if (left < 0) add('mslate:' + m.id, 'Milestone late', '"' + m.name + '" on ' + p.name + ' is overdue', { project: p.id }, '', 'red');
        else if (left <= 3) add('mssoon:' + m.id, 'Milestone soon', '"' + m.name + '" on ' + p.name + ' is due in ' + left + (left === 1 ? ' day' : ' days'), { project: p.id });
      });
      if (readyForClosure(p, d.tasks.filter(t => t.projectId === p.id))) add('close:' + p.id, 'Ready to close', p.name + ' has all its work done and can be closed', { project: p.id }, '', 'info');
    });
    (d.audit || []).forEach(a => {
      if (a.actorName === name) return;
      const go = a.taskId ? { task: a.taskId } : a.projectId ? { project: a.projectId } : {};
      if ((a.action === 'owner_changed' || a.action === 'task_assigned') && a.field === 'owner' && d.mine(a.newValue)) add('a:' + a.activityId, 'Assigned to you', a.text, go, a.ts);
      if (a.action === 'owner_changed' && a.field === 'owner' && d.mine(a.oldValue)) add('a:' + a.activityId, 'Reassigned', a.text, go, a.ts);
      const tk = a.taskId ? d.tasks.find(t => t.id === a.taskId) : null;
      if (tk && d.mine(tk.owner)) {
        if (a.action === 'deadline_changed') add('a:' + a.activityId, 'Deadline changed', a.text, go, a.ts, 'amber');
        if (/^(comment|question|decision)_added$/.test(a.action)) add('a:' + a.activityId, 'New comment', a.text, go, a.ts);
      }
      if (/_added$/.test(a.action) && new RegExp('@' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(a.newValue || '')) add('a:' + a.activityId, 'Mentioned', a.actorName + ' mentioned you: ' + a.newValue, go, a.ts);
    });
    // One line instead of a long run when many tasks are late on the same day.
    const late = out.filter(n => n.kind === 'Overdue');
    if (late.length > 5) {
      const rest = out.filter(n => n.kind !== 'Overdue');
      rest.push({ id: 'overdue-all:' + todayStr, kind: 'Overdue', text: late.length + ' of your tasks are late', go: { view: 'tasks', filter: 'overdue' }, ts: '', level: 'red' });
      out.length = 0; rest.forEach(n => out.push(n));
    }
    const seen = new Set();
    return out.filter(n => (seen.has(n.id) ? false : seen.add(n.id))).sort((a, b) => ({ red: 0, amber: 1, info: 2 }[a.level] - { red: 0, amber: 1, info: 2 }[b.level]) || String(b.ts).localeCompare(String(a.ts)));
  }

  // ---------- one-line task commands ----------
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const realDate = (y, m, d) => { const x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? iso(x) : ''; };
  /** Finds a date in the text. Dates are read day first, as in India. Returns { date, text } or null. */
  function findDate(text, today) {
    const base = new Date(today + 'T00:00:00Z'), add = n => iso(new Date(base.getTime() + n * 86400000));
    const mon = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    const month = w => MONTHS.findIndex(m => m.startsWith(w.toLowerCase().slice(0, 3))) + 1;
    const year = (d, m) => { const y = base.getUTCFullYear(), c = realDate(y, m, d); return c && c >= today ? y : y + 1; };
    let m;
    if ((m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return { date: realDate(+m[1], +m[2], +m[3]), text: m[0] };
    if ((m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/))) return { date: realDate(+m[3], +m[2], +m[1]), text: m[0] };
    if ((m = text.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + mon + '\\b,?(?:\\s+(\\d{4}))?', 'i')))) return { date: realDate(m[3] ? +m[3] : year(+m[1], month(m[2])), month(m[2]), +m[1]), text: m[0] };
    if ((m = text.match(new RegExp('\\b' + mon + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:\\s+(\\d{4}))?', 'i')))) return { date: realDate(m[3] ? +m[3] : year(+m[2], month(m[1])), month(m[1]), +m[2]), text: m[0] };
    if ((m = text.match(/\btoday\b/i))) return { date: today, text: m[0] };
    if ((m = text.match(/\btomorrow\b/i))) return { date: add(1), text: m[0] };
    if ((m = text.match(/\bin\s+(\d{1,3})\s+days?\b/i))) return { date: add(+m[1]), text: m[0] };
    // A bare weekday can be part of a title, like "Monday report". It counts only after a word that means a date.
    if ((m = text.match(new RegExp('\\b(?:by|due|on|before|deadline(?:\\s+is)?|until)\\s+(next\\s+|this\\s+)?(' + DAYS.join('|') + ')\\b|\\b(next\\s+|this\\s+)(' + DAYS.join('|') + ')\\b', 'i')))) {
      m = [m[0], m[1] || m[3], m[2] || m[4]];
      const want = DAYS.indexOf(m[2].toLowerCase()), now = base.getUTCDay();
      let gap = (want - now + 7) % 7 || 7;
      if (/^next/i.test(m[1] || '') && gap < 7 && want > now) gap += 7;
      return { date: add(gap), text: m[0] };
    }
    return null;
  }
  /**
   * Reads a sentence into a task. It only fills in what it can prove: a person must match an email
   * exactly, a project must match one project, and anything else is left blank and listed in problems.
   * Whatever it returns still goes through the confirmation step and every check on the server.
   * d = { today, projects, employees }
   */
  function parseCommand(text, d) {
    const task = { name: '', desc: '', projectId: '', ownerEmail: '', priority: '', due: '' }, problems = [];
    let rest = String(text || '').trim().slice(0, 1000);
    const take = m => { rest = rest.replace(m, ' '); };
    const words = { critical: 'P0', urgent: 'P0', high: 'P1', medium: 'P2', normal: 'P2', low: 'P3' };
    let m = rest.match(/(?:description|details)\s*[:\-]\s*(.+)$/i);
    if (m) { task.desc = m[1].trim(); take(m[0]); }
    m = rest.match(/[^\s@<>(),;"']+@[^\s@<>(),;"']+\.[a-z]{2,}/i);
    if (m) {
      const mail = m[0].toLowerCase().replace(/[.,;]+$/, ''), hit = (d.employees || []).find(u => String(u.email).toLowerCase() === mail);
      task.ownerEmail = mail;
      take(new RegExp('(?:\\bto\\s+)?' + m[0].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'), 'i'));
      if (!hit) problems.push(mail + ' is not a registered employee.');
    } else problems.push('Add the employee\'s email.');
    m = rest.match(/\b(critical|urgent|high|medium|normal|low)[\s-]*priority\b/i) || rest.match(/\bpriority\s*(?:is|of|:|-)?\s*(critical|urgent|high|medium|normal|low)\b/i);
    if (m) { task.priority = words[m[1].toLowerCase()]; take(m[0]); }
    else if ((m = rest.match(/\b(P[0-3])\b/))) { task.priority = m[1]; take(m[0]); }
    else problems.push('Choose a priority.');
    // Two different dates in one sentence: asking is better than picking one.
    const dates = []; let scan = rest, hit = findDate(scan, d.today);
    while (hit && dates.length < 5) { if (hit.date && !dates.some(x => x.date === hit.date)) dates.push(hit); scan = scan.replace(hit.text, ' '); hit = findDate(scan, d.today); }
    if (dates.length === 1) {
      task.due = dates[0].date;
      take(new RegExp('(?:\\b(?:with\\s+a\\s+)?(?:deadline(?:\\s+is|\\s+of|:)?|due(?:\\s+on|\\s+by|:)?|by|before|on)\\s+)?' + dates[0].text.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'), 'i'));
    } else if (dates.length > 1) problems.push('This mentions more than one date. Choose the deadline.');
    else problems.push('Choose a deadline.');
    if (task.due && task.due < d.today) problems.push('The deadline is in the past.');
    // The preposition nearest to the word "project" counts: "report for teachers task under the CRM project" means CRM.
    const near1 = rest.match(/^(.*)\b(?:under|for|in|on)\s+(?:the\s+)?([^.,;]+?)\s+project\b/i), near2 = near1 ? null : rest.match(/\bproject\s*(?::|-|called|named)\s*["']?([^.,;"']+)["']?/i);
    const want = (near1 ? near1[2] : near2 ? near2[1] : '').trim();
    const named = near1 ? [near1[0].slice(near1[1].length)] : near2;
    if (want && !/^(the|a|an|this|that|our|my)$/i.test(want)) {
      const low = want.toLowerCase(), list = d.projects || [];
      const exact = list.filter(p => String(p.name).toLowerCase() === low || String(p.id).toLowerCase() === low);
      const word = new RegExp('(^|[^a-z0-9])' + low.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '($|[^a-z0-9])', 'i');
      const near = exact.length ? exact : low.length < 3 ? [] : list.filter(p => word.test(String(p.name)));
      if (near.length === 1) task.projectId = near[0].id;
      else if (near.length) problems.push('"' + want + '" could be ' + near.slice(0, 3).map(p => p.name).join(' or ') + '. Choose one.');
      else problems.push('No project you manage is called "' + want + '".');
      take(named[0]);
    } else problems.push('Choose a project.');
    m = rest.match(/["\u201c]([^"\u201d]{2,})["\u201d]/) || rest.match(/\b(?:assign|create|add|give)\s+(?:the|a|an)?\s*(.+?)\s+task\b/i) || rest.match(/\b(?:task|title)\s*[:\-]\s*([^.;]+)/i);
    if (m) task.name = m[1].replace(/\s+/g, ' ').trim();
    if (!task.name || /^(new|a|an|the)$/i.test(task.name)) { task.name = ''; problems.push('Add a task title.'); }
    return { task, problems };
  }

  return { parseCommand, TASK_STATUSES, TRANSITIONS, STAGES, STAGE_STATUS, stageOf, DEFAULT_RULES, dayNum, isDate, isDone, isCancelled, isOpen, nextStatuses, moveProblem, subtasksOf, weightOf, progressMode, taskPct, countedTasks, projectPct, milestonePct, projectCounts, readyForClosure, health, wouldLoop, downstream, waitingOn, notifications };
})();
if (typeof module !== 'undefined') module.exports = ENGINE;
