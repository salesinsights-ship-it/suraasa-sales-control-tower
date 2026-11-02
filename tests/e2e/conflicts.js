// Two browsers at once: nothing may be lost, and nothing silently overwritten.
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
const wait = (p, ms) => p.waitForTimeout(ms || 300);
const srv = b => b.post({ action: 'pull' }).state;
const settle = async p => { await wait(p, 120); await p.evaluate(() => SYNC.flush()); await wait(p, 200); };
(async () => {
  const br = await chromium.launch();
  // A sits on an open form while B saves the same field, then A saves
  {
    const b = backend(false); const t = srv(b).tasks.find(x => x.status === 'Not Started');
    const A = await page(br, b), B = await page(br, b);
    await A.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, t.id); await wait(A);
    await B.evaluate(id => { SCT.state.tasks.find(x => x.id === id).priority = 'P3'; SYNC.flush(); }, t.id); await wait(B, 400);
    await A.evaluate(() => SYNC.pull(true)); await wait(A);
    ok('pull waits while a form is open', await A.evaluate(() => !!SYNC.deferred));
    await A.evaluate(id => { SCT.state.tasks.find(x => x.id === id).priority = 'P0'; }, t.id);
    await A.click('[data-act="close-modal"]'); await wait(A, 700); await settle(A);
    const r = srv(b).tasks.find(x => x.id === t.id);
    ok('the newer value is not overwritten', r.priority === 'P3', r.priority);
    ok('the person is told', /was changed by|not saved/i.test(await A.textContent('#toast')), await A.textContent('#toast'));
    await A.context().close(); await B.context().close();
  }
  // offline edits meet a newer Sheet, but an unrelated field still goes through
  {
    const b = backend(false); const t = srv(b).tasks.find(x => x.status === 'Not Started');
    const A = await page(br, b);
    A.net.down = true;
    await A.evaluate(id => { const x = SCT.state.tasks.find(k => k.id === id); x.priority = 'P0'; x.desc = 'offline text'; SYNC.onLocalChange(); }, t.id); await wait(A, 500);
    b.post({ action: 'apply', ops: [{ c: 'tasks', id: t.id, set: { priority: 'P3' }, base: { priority: t.priority } }] });
    A.net.down = false;
    await A.evaluate(() => SYNC.pull(true)); await wait(A, 500); await settle(A);
    const r = srv(b).tasks.find(x => x.id === t.id);
    ok('offline change does not beat a newer save', r.priority === 'P3', r.priority);
    ok('the rest of the offline work is kept', r.desc === 'offline text', r.desc);
    await A.context().close();
  }
  // both create the next task number
  {
    const b = backend(false);
    const A = await page(br, b), B = await page(br, b);
    const add = (p, name) => p.evaluate(async n => { const s = SCT.state; const id = 'T-999'; s.tasks.push({ id, name: n, projectId: s.projects[0].id, status: 'Not Started', owner: 'TBD', priority: 'P2' }); await SYNC.flush(); }, name);
    await add(A, 'From A'); await wait(A); await add(B, 'From B'); await wait(B, 700); await settle(B);
    const names = srv(b).tasks.filter(x => /^From [AB]$/.test(x.name));
    ok('two people taking the same ID both keep their task', names.length === 2 && new Set(names.map(x => x.id)).size === 2, names.map(x => x.id + ' ' + x.name).join(', '));
    await A.context().close(); await B.context().close();
  }
  // comment delete through the page
  {
    const b = backend(false); const pj = srv(b).projects[0];
    b.post({ action: 'apply', ops: [{ c: 'projects', id: pj.id, set: { comments: [{ who: 'A', text: 'first', ts: '2026-01-01T00:00:00Z' }, { who: 'B', text: 'second', ts: '2026-01-02T00:00:00Z' }] }, base: { comments: pj.comments || [] } }] });
    const A = await page(br, b);
    const v0 = srv(b) && b.post({ action: 'pull' }).version;
    await A.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, pj.id); await wait(A);
    await A.click('[data-act="ptab"][data-tab="updates"]'); await wait(A);
    await A.locator('[data-act="del-comment"]').first().click(); await wait(A, 900); await settle(A);
    const r = srv(b).projects.find(x => x.id === pj.id);
    ok('comment deleted on the Sheet', r.comments.length === 1, String(r.comments.length));
    const v1 = b.post({ action: 'pull' }).version; await wait(A, 1500);
    ok('no endless resending', b.post({ action: 'pull' }).version === v1 && v1 - v0 <= 2, v0 + ' to ' + v1);
    await A.context().close();
  }
  // importing an old file cannot delete live data
  {
    const b = backend(false); const n = srv(b).tasks.length;
    const A = await page(br, b); await A.click('#nav [data-v="admin"]'); await wait(A);
    await A.click('[data-act="atab"][data-tab="data"], [data-tab="data"]'); await wait(A);
    const file = { name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ meta: {}, projects: [], tasks: [] })) };
    const input = A.locator('#importFile');
    if (await input.count()) {
      await input.setInputFiles(file); await wait(A, 600); await settle(A);
      ok('import refused while connected', srv(b).tasks.length === n && /empty Sheet/.test(await A.textContent('#toast')), await A.textContent('#toast'));
    } else ok('import control present', false);
    await A.context().close();
  }
  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 800)); process.exit(1); });
