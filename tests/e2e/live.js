// A change made in the Sheet reaches an open page by itself.
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
(async () => {
  const br = await chromium.launch();
  const b = backend(true); b.ctx.pwStore_('admin@suraasa.com', 'a long enough password', false);
  const s = b.post({ action: 'password_login', email: 'admin@suraasa.com', password: 'a long enough password' }).session;
  const p = await page(br, b, { session: s }); await p.waitForTimeout(700);
  const edit = (name, id) => { const sh = b.ss.getSheetByName('Tasks'), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues(), row = rows.findIndex(r => r[0] === id) + 2, r = sh.getRange(row, head.indexOf('name') + 1); r.setValue(name); b.ctx.onEdit({ range: r, oldValue: 'x', value: name }); };
  const t = await p.evaluate(() => SCT.state.tasks[0].id);
  const shows = n => p.evaluate(([i, x]) => SCT.state.tasks.find(k => k.id === i).name === x, [t, n]);
  ok('the page is open and signed in', await p.evaluate(() => document.querySelector('#signin').hidden && SCT.state.tasks.length > 0));
  const start = Date.now(); edit('Edited in the Sheet', t);
  let seen = false; while (!seen && Date.now() - start < 9000) { await p.waitForTimeout(250); seen = await shows('Edited in the Sheet'); }
  ok('an edit in the Sheet appears by itself', seen, (Date.now() - start) + ' ms');
  ok('within about 5 seconds', Date.now() - start < 7000);
  ok('nothing was sent back to the Sheet', !(await p.evaluate(() => SCT.pending && SCT.pending())));
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'typing'; document.querySelector('#main').prepend(i); i.focus(); i.value = 'half a sentence'; });
  edit('Second edit', t); await p.waitForTimeout(6500);
  ok('someone typing keeps what they typed', await p.evaluate(() => { const i = document.querySelector('#typing'); return !!i && i.value === 'half a sentence'; }));
  await p.evaluate(() => document.querySelector('#typing').blur());
  let got = false; const w = Date.now(); while (!got && Date.now() - w < 7000) { await p.waitForTimeout(250); got = await shows('Second edit'); }
  ok('the change comes in once they leave the box', got);
  ok('no page errors', !p.errs.length, p.errs.join('|'));
  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 700)); process.exit(1); });
