// Deleting tasks: from a row, the panel and a selection, with undo, rights and clean links.
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
const wait = (p, ms) => p.waitForTimeout(ms || 250);
const srv = (b, s) => b.post(Object.assign({ action: 'pull' }, s ? { session: s } : {})).state;
const settle = async p => { await wait(p, 6400); await p.evaluate(() => SYNC.flush()); await wait(p, 300); };
const openTask = (p, id) => p.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, id);
const firstRow = async p => { const r = p.locator('.task-del-btn:visible').first(); return { btn: r, id: await r.getAttribute('data-id') }; };
(async () => {
  const br = await chromium.launch();
  {
    const b = backend(false); const n = srv(b).tasks.length;
    const p = await page(br, b); await p.click('#nav [data-v="tasks"]'); await wait(p);
    let { btn, id } = await firstRow(p);
    p.decline = true; await btn.click(); await wait(p); p.decline = false;
    ok('cancel leaves the task alone', await p.evaluate(i => SCT.state.tasks.some(t => t.id === i), id));
    ok('the question names the task', /^Delete task /.test(p.lastDialog), p.lastDialog);
    await btn.click(); await wait(p);
    ok('the panel does not open and the row goes', !(await p.$('#modal')) && !(await p.evaluate(i => !!document.querySelector('.task-del-btn[data-id="' + i + '"]'), id)));
    ok('nothing reaches the Sheet during the Undo window', srv(b).tasks.length === n);
    await p.click('#toast [data-act="toast-undo"]'); await settle(p);
    const t = srv(b).tasks.find(x => x.id === id);
    ok('undo brings it back, untouched', !!t && srv(b).tasks.length === n && !srv(b).audit.some(a => a.action === 'deleted'));
    ({ btn, id } = await firstRow(p));
    await btn.click(); await settle(p);
    const st = srv(b);
    ok('after the Undo window it leaves the Sheet', !st.tasks.some(x => x.id === id) && st.tasks.length === n - 1);
    ok('recorded in the audit log', st.audit.some(a => a.action === 'deleted' && a.entityId === id));
    ok('kept in Deleted items', st.trash.some(x => x.recordId === id));
    await p.reload(); await wait(p, 500); await p.click('#nav [data-v="admin"]'); await wait(p);
    await p.click('[data-tab="trash"]'); await wait(p);
    await p.click('[data-act="restore-trash"]'); await wait(p, 500); await p.evaluate(() => SYNC.flush()); await wait(p, 300);
    ok('can be restored from Deleted items', srv(b).tasks.some(x => x.id === id));
    ok('no page errors', !p.errs.length, p.errs.join('|'));
    await p.context().close();
  }
  {
    const b = backend(false); const st = srv(b); const pid = st.projects[0].id; const base = { projectId: pid, status: 'Not Started', owner: 'TBD', priority: 'P2', progress: 0 };
    const r = b.post({ action: 'apply', ops: [
      { c: 'tasks', id: 'Z1', create: true, rec: Object.assign({ id: 'Z1', name: 'Parent' }, base) },
      { c: 'tasks', id: 'Z2', create: true, rec: Object.assign({ id: 'Z2', name: 'Child', parent: 'Z1' }, base) },
      { c: 'tasks', id: 'Z3', create: true, rec: Object.assign({ id: 'Z3', name: 'Grandchild', parent: 'Z2' }, base) },
      { c: 'tasks', id: 'Z4', create: true, rec: Object.assign({ id: 'Z4', name: 'Waits on parent', dependsOn: ['Z1'] }, base) },
      { c: 'tasks', id: 'Z5', create: true, rec: Object.assign({ id: 'Z5', name: 'Waits on grandchild', dependsOn: ['Z3', 'Z4'] }, base) }
    ] });
    ok('test tasks set up', r.ok, JSON.stringify(r.rejected));
    const p = await page(br, b);
    await openTask(p, 'Z1'); await wait(p);
    await p.click('#modal [data-act="del-task"]'); await wait(p);
    ok('the question mentions subtasks and waiting tasks', /2 subtasks/.test(p.lastDialog) && /2 other tasks wait/.test(p.lastDialog), p.lastDialog.replace(/\n/g, ' '));
    ok('the panel closes with no error', !(await p.$('#modal')) && !(await p.textContent('#toast')).includes('no longer'));
    await p.click('#toast [data-act="toast-undo"]'); await wait(p, 300);
    ok('undo restores subtasks and links', await p.evaluate(() => ['Z1', 'Z2', 'Z3'].every(i => SCT.state.tasks.some(t => t.id === i)) && SCT.state.tasks.find(t => t.id === 'Z4').dependsOn[0] === 'Z1'));
    await openTask(p, 'Z1'); await wait(p);
    await p.click('#modal [data-act="del-task"]'); await settle(p);
    const s2 = srv(b);
    ok('subtasks at every level go too', !s2.tasks.some(t => ['Z1', 'Z2', 'Z3'].includes(t.id)));
    ok('waiting tasks lose only the deleted link', canon(s2, 'Z4') === '' && canon(s2, 'Z5') === 'Z4', canon(s2, 'Z5'));
    const z4 = s2.tasks.find(t => t.id === 'Z4');
    const u = b.post({ action: 'apply', ops: [{ c: 'tasks', id: 'Z4', set: { progress: 10 }, base: { progress: z4.progress } }] });
    ok('a task that waited on it can still be saved', u.ok, JSON.stringify(u.rejected));
    ok('no page errors', !p.errs.length, p.errs.join('|'));
    await p.context().close();
  }
  {
    const b = backend(false); const n = srv(b).tasks.length;
    const p = await page(br, b); await p.click('#nav [data-v="tasks"]'); await wait(p);
    await p.click('[data-act="bulk-toggle"]'); await wait(p);
    ok('no row buttons while selecting', !(await p.$('.task-del-btn')));
    ok('Delete selected starts disabled', await p.locator('[data-act="bulk-del"]').isDisabled());
    await p.locator('[data-act="bulk-pick"]').nth(0).click(); await wait(p, 80);
    await p.locator('[data-act="bulk-pick"]').nth(1).click(); await wait(p, 80);
    await p.click('[data-act="bulk-del"]'); await settle(p);
    ok('two selected tasks deleted', srv(b).tasks.length === n - 2, n + ' to ' + srv(b).tasks.length);
    ok('selection is cleared', /0<\/b> selected/.test(await p.innerHTML('.bulk-bar')));
    await p.click('[data-act="bulk-all"]'); await wait(p);
    await p.click('[data-act="bulk-del"]'); await wait(p);
    ok('more than 25 at once is refused', /25/.test(await p.textContent('#toast')) && (await p.evaluate(() => SCT.state.tasks.length)) === n - 2, await p.textContent('#toast'));
    await p.context().close();
  }
  {
    const b = backend(true); const ad = b.sessionFor('admin@suraasa.com').session, ak = b.sessionFor('ak@suraasa.com').session, v = b.sessionFor('view@suraasa.com').session;
    const st = srv(b, ad); const t = st.tasks.find(x => x.owner === 'AK');
    const pj = st.projects.find(x => x.id === t.projectId);
    if (pj.owner === 'AK' || pj.accountable === 'AK') b.post({ action: 'apply', session: ad, ops: [{ c: 'projects', id: pj.id, set: { owner: 'Head of Sales', accountable: 'Head of Sales' }, base: { owner: pj.owner, accountable: pj.accountable } }] });
    const p = await page(br, b, { session: ak }); await p.click('#nav [data-v="tasks"]'); await wait(p);
    ok('a task owner sees no delete on rows', !(await p.$('.task-del-btn[data-id="' + t.id + '"]')));
    await openTask(p, t.id); await wait(p);
    ok('or in the panel', !(await p.$('#modal [data-act="del-task"]')));
    const r = b.post({ action: 'apply', session: ak, ops: [{ c: 'tasks', id: t.id, del: true }] });
    ok('the server refuses a task owner', !r.ok && r.rejected[0].code === 'denied');
    const q = await page(br, b, { session: v }); await q.click('#nav [data-v="tasks"]'); await wait(q);
    ok('a viewer sees no delete', !(await q.$('.task-del-btn')));
    ok('the server refuses a viewer', !b.post({ action: 'apply', session: v, ops: [{ c: 'tasks', id: t.id, del: true }] }).ok);
    await p.context().close(); await q.context().close();
  }
  {
    const b = backend(false);
    const p = await page(br, b, { viewport: { width: 390, height: 800 }, touch: true }); await p.click('#tabbar [data-v="tasks"]'); await wait(p);
    ok('phone: no tiny row button', !(await p.locator('.task-del-btn:visible').count()));
    await p.locator('.r-task .r-t').first().click(); await wait(p);
    ok('phone: delete is in the panel', await p.locator('#modal [data-act="del-task"]').isVisible());
    await p.context().close();
  }
  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 900)); process.exit(1); });
function canon(st, id) { return (st.tasks.find(t => t.id === id).dependsOn || []).join(','); }
