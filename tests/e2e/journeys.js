// Journeys A-J from the brief. Browser = real Chromium, site = the built dist/index.html,
// backend = the real Code.gs running on a simulated Sheet loaded with the live data.
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, extra) => { results.push([c ? 'PASS' : 'FAIL', n + (extra ? ' :: ' + extra : '')]); };
const wait = (p, ms) => p.waitForTimeout(ms || 400);
const settle = async p => { await wait(p, 120); await p.waitForFunction(() => !SYNC.busy, null, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => SYNC.flush()); await wait(p, 120); };
const fill = async (p, k, v) => { const el = p.locator('#modal [name="' + k + '"]').first(); const tag = await el.evaluate(e => e.tagName); if (tag === 'SELECT') await el.selectOption(v); else await el.fill(v); };
const saveForm = p => p.click('#modal .mf .btn.primary');
const nav = async (p, v) => { await p.click('#nav [data-v="' + v + '"]'); await wait(p, 120); };
const me = async (p, name) => { await p.evaluate(n => SCT.actAs(n), name); await wait(p, 120); };
const srv = (b, s) => b.post(Object.assign({ action: 'pull' }, s ? { session: s } : {})).state;

(async () => {
  const br = await chromium.launch();

  // A: project owner creates project, milestone, tasks, assigns, monitors
  {
    const b = backend(false); const p = await page(br, b); await me(p, 'Head of Sales');
    await p.click('[data-m="new"]'); await p.click('#menu-new [data-act="add-project"]'); await wait(p);
    await fill(p, 'name', 'Journey project'); await fill(p, 'owner', 'Head of Sales'); await fill(p, 'start', '2026-11-02'); await fill(p, 'due', '2026-12-31');
    await saveForm(p); await settle(p);
    let st = srv(b); const pj = st.projects.find(x => x.name === 'Journey project');
    ok('A1 project created and saved to the Sheet', !!pj, pj && pj.id);
    ok('A2 ID, creator and original date recorded', pj && /^PRJ-/.test(pj.id) && pj.createdAt && pj.originalDue === '2026-12-31', JSON.stringify(pj && { c: pj.createdBy, o: pj.originalDue }));
    await p.evaluate(id => { SCT; document.querySelector('#nav [data-v="portfolio"]').click(); }, pj.id); await wait(p);
    await p.click('[data-act="open"][data-id="' + pj.id + '"]'); await wait(p);
    await p.click('[data-act="ptab"][data-tab="plan"]'); await wait(p);
    await p.click('[data-act="add-ms"]'); await wait(p);
    await fill(p, 'name', 'First milestone'); await fill(p, 'due', '2026-11-20'); await saveForm(p); await settle(p);
    await p.click('[data-act="add-task"][data-pid="' + pj.id + '"]'); await wait(p);
    await fill(p, 'name', 'Journey task one'); await fill(p, 'owner', 'AK'); await fill(p, 'due', '2026-11-15'); await saveForm(p); await settle(p);
    st = srv(b); const t = st.tasks.find(x => x.name === 'Journey task one');
    ok('A3 milestone and assigned task saved', t && t.owner === 'AK' && st.projects.find(x => x.id === pj.id).milestones.length >= 1);
    ok('A4 audit records creation', st.audit.some(a => a.action === 'created' && a.entityId === t.id));
    ok('A5 no page errors', !p.errs.length, p.errs.join('|'));
    await p.context().close();
  }

  // B, C: owner works and submits; project owner reviews, requests changes, approves
  {
    const b = backend(true); b.post({});
    const ak = b.sessionFor('ak@suraasa.com').session, hos = b.sessionFor('hos@suraasa.com').session;
    let st = srv(b, b.sessionFor('admin@suraasa.com').session);
    const task = st.tasks.find(x => x.owner === 'AK' && x.status === 'Not Started' && st.projects.find(y => y.id === x.projectId));
    const proj = st.projects.find(x => x.id === task.projectId);
    b.post({ action: 'apply', session: b.sessionFor('admin@suraasa.com').session, ops: [{ c: 'projects', id: proj.id, set: { owner: 'Head of Sales' }, base: { owner: proj.owner } }] });
    const p = await page(br, b, { session: ak });
    ok('B1 signed in as task owner, not administrator', await p.evaluate(() => SCT.ME.role === "Task Owner" && !SCT.ME.open), await p.evaluate(() => SCT.ME.role));
    await nav(p, 'tasks');
    await p.evaluate(id => { window.__id = id; }, task.id);
    await p.evaluate(id => document.querySelector('[data-act="open-task"][data-id="' + id + '"] .r-t, .r-t[data-id="' + id + '"]') ? 0 : 1, task.id);
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, task.id); await wait(p);
    await p.fill('#tu-text', 'Started the first draft'); await p.selectOption('#tu-status', 'In Progress');
    await p.click('[data-act="tu-save"]'); await settle(p);
    st = srv(b, ak); let t = st.tasks.find(x => x.id === task.id);
    ok('B2 update, note and status saved', t.status === 'In Progress' && t.notes.some(n => n.text === 'Started the first draft' && n.author === 'AK'));
    ok('B3 note has author and timestamp', t.notes.every(n => n.author && n.ts));
    ok('B4 task owner has no edit-details or delete', !(await p.$('[data-act="edit-task"]')) && !(await p.$('[data-act="del-task"]')));
    await p.selectOption('#tu-status', 'Blocked'); await p.click('[data-act="tu-save"]'); await wait(p);
    ok('B5 blocked needs a reason', (await p.textContent('#tu-err')).includes('blocking'));
    await p.fill('#tu-text', 'Waiting for pricing sign-off'); await p.click('[data-act="tu-save"]'); await settle(p);
    t = srv(b, ak).tasks.find(x => x.id === task.id);
    ok('B6 blocker recorded with text and note', t.status === 'Blocked' && t.blocker.text === 'Waiting for pricing sign-off' && t.notes.some(n => n.type === 'blocker'));
    await p.selectOption('#tu-status', 'In Progress'); await p.fill('#tu-text', 'Sign-off received'); await p.click('[data-act="tu-save"]'); await settle(p);
    await p.click('[data-act="tk-review"]'); await settle(p);
    t = srv(b, ak).tasks.find(x => x.id === task.id);
    ok('B7 submitted for review', t.status === 'In Review' && !t.blocker);
    ok('B8 no page errors', !p.errs.length, p.errs.join('|'));

    const q = await page(br, b, { session: hos });
    ok('C1 project owner told about the review', await q.evaluate(() => { const n = document.querySelector('#bell .count'); return !!n; }));
    await q.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, task.id); await wait(q);
    await q.click('[data-act="tk-changes"]'); await wait(q);
    if (await q.$('#modal form')) { await q.fill('#modal textarea', 'Add the regional numbers'); await saveForm(q); }
    await settle(q);
    t = srv(b, hos).tasks.find(x => x.id === task.id);
    ok('C2 changes requested with comment', t.status === 'Changes Requested' && t.notes.some(n => /regional/.test(n.text)), t.status);
    await p.reload(); await wait(p, 500);
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, task.id); await wait(p);
    await p.click('[data-act="tk-review"]'); await settle(p);
    await q.reload(); await wait(q, 500);
    await q.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, task.id); await wait(q);
    await q.click('[data-act="tk-approve"]'); await settle(q);
    t = srv(b, hos).tasks.find(x => x.id === task.id);
    ok('C3 approved: completed at 100%', t.status === 'Completed' && +t.progress === 100 && !!t.completedAt, JSON.stringify({ s: t.status, pr: t.progress, q: await q.evaluate(() => document.querySelector('#toast').innerText + '|' + SYNC.config.status + '|' + SYNC.config.error) }));
    const au = srv(b, b.sessionFor('admin@suraasa.com').session).audit.filter(a => a.taskId === task.id);
    ok('C4 every status change traceable with who and when', ['In Review', 'Changes Requested', 'Completed'].every(s => au.some(a => a.action === 'status_changed' && a.newValue === s && a.actorName && a.ts)), String(au.length));
    ok('C5 no page errors', !q.errs.length, q.errs.join('|'));
    await p.context().close(); await q.context().close();
  }

  // D: overdue -> event, health, notification
  {
    const b = backend(false); const st0 = srv(b);
    const t = st0.tasks.find(x => x.owner === 'AK' && x.status !== 'Completed');
    const r = b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { due: '2026-10-20', priority: 'P0' }, base: { due: t.due, priority: t.priority } }] });
    ok('D0 set up an overdue task', r.ok);
    const made = b.ctx.dailyChecks();
    const st = srv(b);
    ok('D1 overdue event in the log', st.audit.some(a => a.action === 'task_overdue' && a.entityId === t.id), 'added ' + made.added);
    const p = await page(br, b); await me(p, 'AK');
    const h = await p.evaluate(id => SCT.health(SCT.state.projects.find(x => x.id === id)), t.projectId);
    ok('D2 health moves and says why', ['Amber', 'Red'].includes(h.rag) && h.reasons.some(x => /late|overdue/i.test(x)), h.level + ': ' + h.reasons.join('; '));
    await nav(p, 'notifications');
    const txt = await p.textContent('#main');
    ok('D3 owner gets a notification', txt.includes(t.name) && /late/.test(txt));
    const c1 = await p.$$eval('.r-note', x => x.length);
    await p.reload(); await wait(p, 500); await me(p, 'AK'); await nav(p, 'notifications');
    const c2 = await p.$$eval('.r-note', x => x.length);
    ok('D4 no duplicates after reload', c1 === c2, c1 + ' ' + c2);
    await p.context().close();
  }

  // E: admin changes permissions, restricted action blocked
  {
    const b = backend(true); const ad = b.sessionFor('admin@suraasa.com').session, ak = b.sessionFor('ak@suraasa.com').session, v = b.sessionFor('view@suraasa.com').session;
    const p = await page(br, b, { session: ad }); await nav(p, 'admin');
    const row = '[data-act="edit-user"][data-id="ak@suraasa.com"]';
    await p.click('button' + row); await wait(p);
    await fill(p, 'role', 'Viewer'); await saveForm(p); await settle(p);
    ok('E1 role changed in Administration', b.post({ action: 'pull', session: ad }).state.users.find(u => u.email === 'ak@suraasa.com').role === 'Viewer');
    const t = b.post({ action: 'pull', session: ak }).state.tasks.find(x => x.owner === 'AK');
    const res = b.post({ action: 'apply', session: ak, ops: [{ c: 'tasks', id: t.id, set: { progress: 10 }, base: { progress: t.progress } }] });
    ok('E2 server refuses the former owner', !res.ok && res.rejected[0].code === 'denied', JSON.stringify(res.rejected));
    const q = await page(br, b, { session: v });
    ok('E3 viewer sees no write controls', await q.evaluate(() => getComputedStyle(document.querySelector('.needs-write')).display === 'none'));
    await q.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'nav'; el.dataset.v = 'admin'; document.body.appendChild(el); el.click(); el.remove(); }); await wait(q);
    ok('E4 viewer cannot open Administration', /for administrators/.test(await q.textContent('#main')));
    const bad = b.post({ action: 'apply', session: v, ops: [{ c: 'users', id: 'view@suraasa.com', rec: { role: 'Administrator', active: true } }] });
    ok('E5 viewer cannot make themselves admin through the API', !bad.ok);
    await p.context().close(); await q.context().close();
  }

  // F: two users update the same task
  {
    const b = backend(false); const t0 = srv(b).tasks.find(x => x.status === 'Not Started');
    const p1 = await page(br, b); const p2 = await page(br, b);
    await p1.evaluate(id => { const t = SCT.state.tasks.find(x => x.id === id); t.priority = 'P3'; SYNC.flush(); }, t0.id); await settle(p1);
    await p2.evaluate(id => { const t = SCT.state.tasks.find(x => x.id === id); t.priority = 'P0'; SYNC.flush(); }, t0.id); await wait(p2, 700);
    const final = srv(b).tasks.find(x => x.id === t0.id).priority;
    ok('F1 second writer does not silently overwrite', final === 'P3', final);
    ok('F2 second user is told', /changed|someone|conflict/i.test(await p2.evaluate(() => (document.querySelector('#modal') ? document.querySelector('#modal').innerText : '') + document.querySelector('#toast').innerText)), await p2.evaluate(() => document.querySelector('#toast').innerText));
    const t1 = srv(b).tasks.find(x => x.status === 'Not Started' && x.id !== t0.id);
    await p1.reload(); await p2.reload(); await wait(p2, 500);
    await p1.evaluate(id => { const t = SCT.state.tasks.find(x => x.id === id); t.notes = (t.notes || []).concat([{ id: 'N1', type: 'comment', text: 'one', author: 'A', ts: 't' }]); SYNC.flush(); }, t1.id);
    await p2.evaluate(id => { const t = SCT.state.tasks.find(x => x.id === id); t.notes = (t.notes || []).concat([{ id: 'N2', type: 'comment', text: 'two', author: 'B', ts: 't' }]); SYNC.flush(); }, t1.id);
    await wait(p2, 800);
    const ns = srv(b).tasks.find(x => x.id === t1.id).notes.map(n => n.text).sort();
    ok('F3 notes from both people are kept', ns.join() === 'one,two', ns.join());
    await p1.context().close(); await p2.context().close();
  }

  // G: network loss keeps input
  {
    const b = backend(false); const t0 = srv(b).tasks.find(x => x.status === 'Not Started');
    const p = await page(br, b);
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, t0.id); await wait(p);
    p.net.down = true;
    await p.fill('#tu-text', 'Typed while offline'); await p.selectOption('#tu-status', 'In Progress');
    await p.click('[data-act="tu-save"]'); await wait(p, 900);
    ok('G1 failure is shown, not hidden', await p.evaluate(() => ['error', 'offline'].includes(SYNC.config.status) || /could not|retry|not saved/i.test(document.querySelector('#sync-indicator').innerText)), await p.evaluate(() => SYNC.config.status));
    ok('G2 change kept in the browser', await p.evaluate(id => SCT.state.tasks.find(x => x.id === id).notes.some(n => n.text === 'Typed while offline'), t0.id));
    await p.reload().catch(() => {}); await wait(p, 500);
    ok('G3 survives a reload while offline', await p.evaluate(id => SCT.state.tasks.find(x => x.id === id).status === 'In Progress', t0.id));
    p.net.down = false;
    await p.evaluate(() => SYNC.boot()); await wait(p, 600); await p.evaluate(() => SYNC.flush()); await settle(p);
    const t = srv(b).tasks.find(x => x.id === t0.id);
    ok('G4 reaches the Sheet when back online', t.status === 'In Progress' && (t.notes || []).some(n => n.text === 'Typed while offline'), t.status);
    await p.context().close();
    const b2 = backend(false); const q = await page(br, b2);
    await p.context().close().catch(() => {});
    q.net.down = true; await q.evaluate(() => { localStorage.clear(); }); await q.reload().catch(() => {}); await wait(q, 700);
    ok('G5 a new browser with no connection shows an error, not old sample data', /Could not load the data/.test(await q.textContent('#main')), (await q.textContent('#main')).slice(0, 60));
    await q.context().close();
  }

  // H: archive and restore keep history
  {
    const b = backend(false); const st = srv(b); const pj = st.projects[1]; const count = st.tasks.filter(t => t.projectId === pj.id).length;
    const p = await page(br, b); await me(p, 'Head of Sales');
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, pj.id); await wait(p);
    await p.click('[data-m="proj"]'); await p.click('[data-act="archive-project"]'); await settle(p);
    let s2 = srv(b);
    ok('H1 archived, tasks untouched', !!s2.projects.find(x => x.id === pj.id).archivedAt && s2.tasks.filter(t => t.projectId === pj.id).length === count);
    await nav(p, 'portfolio');
    ok('H2 gone from the active list', !(await p.$('[data-act="open"][data-id="' + pj.id + '"]')));
    await p.evaluate(() => document.querySelector('#nav [data-v="overview"]').click()); await wait(p);
    const shown = await p.evaluate(() => +(document.querySelector('#main').innerText.match(/Total Tasks\s+(\d+)/) || [])[1]);
    const left = st.tasks.filter(t => t.projectId !== pj.id && t.status !== 'Cancelled').length;
    ok('H3 not counted on the dashboard', shown === left, shown + ' of ' + left);
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, pj.id); await wait(p);
    await p.click('.flag [data-act="restore-project"]'); await settle(p);
    s2 = srv(b);
    ok('H4 restored with history', !s2.projects.find(x => x.id === pj.id).archivedAt && s2.audit.filter(a => a.entityId === pj.id && a.action === 'archive_changed').length === 2);
    await p.context().close();
  }

  // I: restricted project via URL and API
  {
    const b = backend(true); const ad = b.sessionFor('admin@suraasa.com').session, ak = b.sessionFor('ak@suraasa.com').session;
    const st = srv(b, ad); const pj = st.projects.find(x => !st.tasks.some(t => t.projectId === x.id && t.owner === 'AK') && x.owner !== 'AK' && x.accountable !== 'AK');
    b.post({ action: 'apply', session: ad, ops: [{ c: 'projects', id: pj.id, set: { restricted: true }, base: {} }] });
    const s3 = srv(b, ak);
    ok('I1 API gives a non-member nothing about it', !s3.projects.some(x => x.id === pj.id) && !s3.tasks.some(t => t.projectId === pj.id) && !s3.audit.some(a => a.projectId === pj.id));
    const t = st.tasks.find(x => x.projectId === pj.id);
    const res = b.post({ action: 'apply', session: ak, ops: [{ c: 'tasks', id: t.id, set: { progress: 5 }, base: { progress: t.progress } }] });
    ok('I2 writes refused too', !res.ok, JSON.stringify(res.rejected || res.error));
    const p = await page(br, b, { session: ak });
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, pj.id); await wait(p);
    ok('I3 site shows nothing', /no longer exists/.test(await p.textContent('#main')));
    await p.context().close();
    const none = b.post({ action: 'pull' });
    ok('I4 no session, no data', !none.state && none.auth === true);
    ok('I5 no data over GET either', !b.get({ action: 'pull' }).state);
    ok('I6 forged session refused', !b.post({ action: 'pull', session: 'nope' }).state);
  }

  // J: all done -> ready for closure -> formal close
  {
    const b = backend(false); let st = srv(b);
    const pj = st.projects.find(x => st.tasks.filter(t => t.projectId === x.id).length >= 2 && st.tasks.filter(t => t.projectId === x.id).length < 8);
    const open = st.tasks.filter(t => t.projectId === pj.id && t.status !== 'Completed');
    const p = await page(br, b); await me(p, 'Head of Sales');
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, pj.id); await wait(p);
    await p.click('[data-m="proj"]'); await p.click('[data-act="close-project"]'); await wait(p);
    ok('J1 cannot close with open tasks', !(await p.$('#modal')) && /still open/.test(await p.textContent('#toast')));
    await p.evaluate(ids => { ids.forEach(id => { const t = SCT.state.tasks.find(x => x.id === id); t.status = 'Completed'; t.progress = 100; t.completedAt = '2026-11-02'; }); SYNC.flush(); }, open.map(t => t.id)); await settle(p);
    await p.evaluate(() => { const el = document.createElement('button'); el.dataset.act = 'nav'; el.dataset.v = 'overview'; document.body.appendChild(el); el.click(); el.remove(); }); await wait(p);
    await p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, pj.id); await wait(p);
    ok('J2 progress is 100% and project shows Ready for closure', /Ready for closure/.test(await p.textContent('#main')));
    ok('J3 not closed automatically', srv(b).projects.find(x => x.id === pj.id).status !== 'Completed');
    await p.click('.flag [data-act="close-project"]'); await wait(p);
    await fill(p, 'note', 'All delivered'); await saveForm(p); await settle(p);
    const f = srv(b).projects.find(x => x.id === pj.id);
    ok('J4 formally closed with note and who', f.status === 'Completed' && f.closure && f.closure.note === 'All delivered', JSON.stringify(f.closure));
    ok('J5 no page errors', !p.errs.length, p.errs.join('|'));
    await p.context().close();
  }

  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(e); process.exit(1); });
