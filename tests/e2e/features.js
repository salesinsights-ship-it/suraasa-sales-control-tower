const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
const wait = (p, ms) => p.waitForTimeout(ms || 300);
const settle = async p => { await wait(p, 120); await p.waitForFunction(() => !SYNC.busy, null, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => SYNC.flush()); await wait(p, 120); };
const openT = (p, id) => p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, id);
const srv = (b, s) => b.post(Object.assign({ action: 'pull' }, s ? { session: s } : {})).state;
const fill = async (p, k, v) => { const el = p.locator('#modal [name="' + k + '"]').first(); const tag = await el.evaluate(e => e.tagName); if (tag === 'SELECT') await el.selectOption(v); else await el.fill(v); };
(async () => {
  const br = await chromium.launch();
  // extension
  {
    const b = backend(true); const ad = b.sessionFor('admin@suraasa.com').session, ak = b.sessionFor('ak@suraasa.com').session, hos = b.sessionFor('hos@suraasa.com').session;
    const st = srv(b, ad); const t = st.tasks.find(x => x.owner === 'AK' && x.status === 'Not Started' && x.due); const pr = st.projects.find(x => x.id === t.projectId);
    b.post({ action: 'apply', session: ad, ops: [{ c: 'projects', id: pr.id, set: { owner: 'Head of Sales' }, base: { owner: pr.owner } }] });
    const p = await page(br, b, { session: ak });
    await openT(p, t.id); await wait(p);
    await p.click('[data-act="tk-ext-ask"]'); await wait(p);
    await fill(p, 'to', '2020-01-01'); await fill(p, 'reason', 'waiting on legal'); await p.click('#modal .mf .btn.primary'); await wait(p);
    ok('earlier date refused for an extension', /after the current/.test(await p.textContent('#ferr')));
    await fill(p, 'to', '2027-03-01'); await p.click('#modal .mf .btn.primary'); await settle(p);
    let r = srv(b, ak).tasks.find(x => x.id === t.id);
    ok('extension request stored, date unchanged', r.extensionRequest && r.extensionRequest.to === '2027-03-01' && r.due === t.due);
    ok('panel shows request', /More time requested/.test(await p.textContent('#modal')));
    const q = await page(br, b, { session: hos });
    await q.click('#nav [data-v="notifications"]'); await wait(q);
    ok('project owner is notified', /asked for more time/.test(await q.textContent('#main')), (await q.textContent('#main')).slice(0, 120));
    await openT(q, t.id); await wait(q);
    await q.click('[data-act="tk-ext-yes"]'); await settle(q);
    r = srv(b, hos).tasks.find(x => x.id === t.id);
    ok('approval moves the date and keeps the original', r.due === '2027-03-01' && r.originalDue === t.due && !r.extensionRequest, JSON.stringify({ d: r.due, o: r.originalDue }));
    const au = srv(b, ad).audit.filter(a => a.taskId === t.id && a.action === 'deadline_changed');
    ok('date change in the audit log', au.length === 1 && au[0].actorName === 'Head of Sales');
    ok('timeline updates straight after saving', /Due date changed/.test(await q.textContent('#modal')));
    ok('no page errors', !p.errs.length && !q.errs.length, p.errs.concat(q.errs).join('|'));
    await p.context().close(); await q.context().close();
  }
  // saved views, bulk
  {
    const b = backend(false); const p = await page(br, b); const ctx = p.context();
    await p.evaluate(() => SCT.actAs('Head of Sales'));
    await p.click('#nav [data-v="tasks"]'); await wait(p);
    await p.click('[data-act="tfilter"][data-f="unassigned"]'); await wait(p);
    await p.click('[data-act="view-save"]'); await wait(p);
    await fill(p, 'name', 'Unowned work'); await p.click('#modal .mf .btn.primary'); await wait(p);
    await p.click('[data-act="tfilter"][data-f="pending"]'); await wait(p);
    await p.selectOption('[data-act="view-load"]', 'Unowned work'); await wait(p);
    ok('saved view restores its filter', await p.evaluate(() => document.querySelector('[data-act="tfilter"].on').dataset.f === 'unassigned'));
    await p.click('[data-act="bulk-toggle"]'); await wait(p);
    const picks = await p.$$('[data-act="bulk-pick"]');
    await picks[0].click(); await wait(p, 100); await (await p.$$('[data-act="bulk-pick"]'))[1].click(); await wait(p, 100);
    ok('selection does not open the task', !(await p.$('#modal')));
    ok('count shown', /2 selected/.test(await p.textContent('.bulk-bar')));
    const ids = await p.$$eval('[data-act="bulk-pick"]:checked', x => x.map(e => e.dataset.id));
    await p.click('[data-act="bulk-edit"]'); await wait(p);
    await p.click('#modal .mf .btn.primary'); await wait(p);
    ok('empty bulk edit refused', /at least one/.test(await p.textContent('#ferr')));
    await fill(p, 'owner', 'AK'); await p.click('#modal .mf .btn.primary'); await wait(p);
    ok('owner change needs a reason', /reason/i.test(await p.textContent('#ferr')));
    await fill(p, 'reason', 'Assigning after review'); await p.click('#modal .mf .btn.primary'); await settle(p);
    const st = srv(b);
    ok('bulk owner change saved with note', ids.every(id => { const t = st.tasks.find(x => x.id === id); return t.owner === 'AK' && t.notes.some(n => /Assigning/.test(n.text)); }));
    ok('each change audited', ids.every(id => st.audit.some(a => a.entityId === id && a.action === 'owner_changed')));
    await p.reload(); await wait(p, 500);
    await p.click('#nav [data-v="tasks"]'); await wait(p);
    ok('saved view survives reload', await p.$$eval('[data-act="view-load"] option', x => x.some(e => e.value === 'Unowned work')));
    await p.click('#nav [data-v="notifications"]'); await wait(p);
    await p.click('.acc summary'); await p.click('[data-g="Milestones and closure"]'); await wait(p);
    ok('notification preference kept', await p.evaluate(() => !JSON.parse(localStorage.getItem('sct_notif_off')).includes('x') && JSON.parse(localStorage.getItem('sct_notif_off')).includes('Milestones and closure')));
    await p.click('#nav [data-v="reports"]'); await wait(p);
    const before = await p.textContent('.tbl');
    await p.fill('[data-act="report-range"][data-k="from"]', '2026-11-01'); await p.fill('[data-act="report-range"][data-k="to"]', '2026-11-30'); await wait(p);
    const after = await p.textContent('.tbl');
    ok('report dates change the measures', before !== after && /Measures below/.test(await p.textContent('#main')));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-what="report-tasks"]')]);
    ok('report CSV downloads', /tasks_report_/.test(dl.suggestedFilename()), dl.suggestedFilename());
    const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-what="activity"]')]);
    ok('activity CSV downloads', /activity_/.test(dl2.suggestedFilename()));
    await p.click('[data-act="open"]'); await wait(p);
    ok('breadcrumb on project', /Projects/.test(await p.textContent('.crumbs')));
    await p.click('[data-m="proj"]');
    const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('[data-what^="project:"]')]);
    ok('project report downloads', /_report_/.test(dl3.suggestedFilename()), dl3.suggestedFilename());
    await p.keyboard.press('/'); await wait(p, 100);
    await p.keyboard.type('Ambassador', { delay: 10 }); await wait(p, 300);
    ok('search finds projects and tasks', (await p.$$('#find-results [role="option"], #find-results button')).length > 1);
    ok('no page errors', !p.errs.length, p.errs.join('|'));
    await ctx.close();
  }
  // tick rules and undo
  {
    const b = backend(false);
    const p = await page(br, b); await p.click('#nav [data-v="tasks"]'); await wait(p);
    const box = p.locator('[data-act="task-done"]:not(:checked):visible').first();
    const id = await box.getAttribute('data-id'); const st0 = await p.evaluate(i => SCT.state.tasks.find(k => k.id === i).status, id);
    await box.click(); await wait(p, 200);
    const x = await p.evaluate(i => SCT.state.tasks.find(k => k.id === i).status, id);
    ok('tick completes the task', x === 'Completed', st0 + ' to ' + x);
    await settle(p);
    ok('tick reaches the Sheet', srv(b).tasks.find(k => k.id === id).status === 'Completed');
    await p.click('#toast button'); await settle(p);
    ok('undo restores it', srv(b).tasks.find(k => k.id === id).status === st0, srv(b).tasks.find(k => k.id === id).status);
    await p.context().close();
  }
  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 900)); process.exit(1); });
