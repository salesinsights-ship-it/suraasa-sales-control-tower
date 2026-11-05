// The site and an older script: nothing is read from it and nothing is sent to it.
const { chromium } = require('playwright');
const path = require('path');
const { page } = require('./harness');
const { createBackend } = require('../mock-gas');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
(async () => {
  const br = await chromium.launch();
  const b = createBackend({ code: path.join(__dirname, 'old-deployed-Code.gs') });
  const calls = []; const post = b.post; b.post = o => { calls.push(o.action); return post(o); };
  const p = await page(br, b, { person: null });
  ok('the site says the server needs updating', /server needs updating/i.test(await p.textContent('#signin')), await p.textContent('#signin'));
  ok('the site sends nothing to an old script', calls.length === 0, calls.join());
  ok('no data on screen', await p.evaluate(() => !SCT.state.tasks.length && !SCT.SYNC.session));
  await br.close();
  results.forEach(r => console.log(r[0], r[1]));
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
