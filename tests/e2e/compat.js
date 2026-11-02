// Deployment order: the new site must work with the old Apps Script, and the
// old site's save format must still work with the new Apps Script.
const path = require('path');
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
(async () => {
  const br = await chromium.launch();
  const b = backend(false, path.join(__dirname, 'old-deployed-Code.gs'));
  const p = await page(br, b);
  ok('new site reads data from the old script', await p.evaluate(() => SCT.state.projects.length > 0 && SYNC.api < 3), String(await p.evaluate(() => SYNC.api)));
  await p.click('#nav [data-v="tasks"]'); await p.waitForTimeout(200);
  await p.locator('[data-act="task-done"]:not(:checked):visible').first().click();
  await p.waitForTimeout(200); await p.evaluate(() => SYNC.flush()); await p.waitForTimeout(400);
  const st = b.ctx.pull_().state;
  ok('new site saves through the old script', st.tasks.filter(t => t.status === 'Completed').length > await p.evaluate(() => 0), String(st.tasks.filter(t => t.status === 'Completed').length));
  ok('no data lost in that save', st.projects.length === await p.evaluate(() => SCT.state.projects.length) && st.tasks.length === await p.evaluate(() => SCT.state.tasks.length));
  ok('no page errors', !p.errs.length, p.errs.join('|'));
  await br.close();
  const n = backend(false); const s = n.post({ action: 'pull' }).state;
  s.tasks[0].progress = 5;
  const r = n.post({ action: 'push', state: s, updatedBy: 'old site' });
  ok('old site can still save through the new script until it is replaced', r.ok !== false, JSON.stringify(r).slice(0, 120));
  for (const x of results) console.log(x[0], x[1]);
  console.log(results.filter(x => x[0] === 'PASS').length + ' of ' + results.length + ' passed');
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 700)); process.exit(1); });
