// What each role sees, with sign-in on, on a copy of the data. Also the home page numbers.
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
const wait = (p, ms) => p.waitForTimeout(ms || 250);
(async () => {
  const br = await chromium.launch();
  const b = backend(true);
  const ad = b.sessionFor('admin@suraasa.com').session, ak = b.sessionFor('ak@suraasa.com').session, hos = b.sessionFor('hos@suraasa.com').session, v = b.sessionFor('view@suraasa.com').session;
  const all = b.post({ action: 'pull', session: ad }).state;
  const live = all.tasks.filter(t => t.status !== 'Cancelled');
  const text = async p => (await p.innerText('#main')).replace(/\s+/g, ' ');
  const num = (s, l) => +(s.match(new RegExp(l + ' (\\d+)')) || [])[1];

  const a = await page(br, b, { session: ad });
  let t = await text(a);
  ok('Administrator: total tasks is right', num(t, 'Total Tasks') === live.length, num(t, 'Total Tasks') + ' of ' + live.length);
  ok('Administrator: the numbers add up', num(t, 'Pending Tasks') + num(t, 'In-Progress Tasks') + num(t, 'Completed Tasks') <= live.length);
  const names = await a.$$eval('#mgmt-emp-filter option', x => x.map(e => e.value).filter(Boolean));
  ok('Administrator: employees are single people', names.length > 0 && !names.some(n => /,/.test(n)) && num(t, 'Total Employees') === names.length, names.join(' | '));
  const pick = names.find(n => n === 'Divya') || names[0];
  await a.selectOption('#mgmt-emp-filter', pick); await wait(a);
  const expected = live.filter(x => String(x.owner || '').split(/\s*[,\/&]\s*|\s+or\s+/i).concat(String(x.accountable || '').split(/\s*[,\/&]\s*|\s+or\s+/i)).includes(pick)).length;
  const head = (await a.innerText('#main')).match(/Tasks \((\d+)/);
  ok('Administrator: the employee filter works and is exact', head && +head[1] === expected, pick + ' ' + (head && head[1]) + ' of ' + expected);
  await a.selectOption('#mgmt-emp-filter', ''); await wait(a);
  ok('Administrator: completion rate is right', num(await text(a), 'Completion Rate') === Math.round(live.filter(x => x.status === 'Completed').length / live.length * 100));
  ok('Administrator: has Administration', !!(await a.$('#nav [data-v="admin"]')));
  ok('Administrator: full New menu', (await a.$$eval('#menu-new button:not([hidden])', x => x.length)) === 7);
  await a.context().close();

  const e = await page(br, b, { session: ak });
  t = await text(e);
  const own = b.post({ action: 'pull', session: ak }).state.tasks;
  ok('Employee: home shows only their tasks', num(t, 'Total Assigned Tasks') === own.filter(x => x.status !== 'Cancelled').length && own.length < all.tasks.length, num(t, 'Total Assigned Tasks') + ' of ' + own.length);
  const nav = await e.$$eval('#nav button', x => x.map(n => n.dataset.v).join());
  ok('Employee: short menu', nav === 'overview,tasks,myprojects,notifications', nav);
  const nw = await e.$$eval('#menu-new button:not([hidden])', x => x.map(n => n.innerText.trim()).join());
  ok('Employee: New offers only what they can do', nw === 'Task,Weekly update', nw);
  ok('Employee: role shown is the server\'s', await e.evaluate(() => SCT.ME.role === 'Task Owner' && SCT.ME.email === 'ak@suraasa.com'));
  ok('Employee: quick buttons only on own tasks', (await e.$$('[data-act="quick-status"]')).length <= own.length * 2);
  await e.click('.page-h [data-act="add-task"], #main [data-act="add-task"]').catch(() => {});
  if (!(await e.$('#modal'))) { await e.click('#nav [data-v="tasks"]'); await wait(e); await e.click('.page-h [data-act="add-task"]'); await wait(e); }
  await e.fill('#modal [name="name"]', 'My own new task'); await e.click('#modal .mf .btn.primary'); await wait(e, 300); await e.evaluate(() => SYNC.flush()); await wait(e, 400);
  const nt = b.post({ action: 'pull', session: ad }).state.tasks.find(x => x.name === 'My own new task');
  ok('Employee: can add their own task', !!nt && nt.owner === 'AK', nt && nt.id + ' ' + nt.owner);
  await e.click('#nav [data-v="overview"]'); await wait(e);
  await e.click('#main [data-act="open-profile"]'); await wait(e);
  ok('Profile opens with no password fields', !!(await e.$('#modal')) && !(await e.$('#modal input[type="password"]')));
  await e.click('#modal [data-act="close-modal"]'); await wait(e);
  ok('Profile closes', !(await e.$('#modal')));
  ok('no page errors', !e.errs.length, e.errs.join('|'));
  await e.context().close();
  const ph = await page(br, b, { session: ak, viewport: { width: 390, height: 800 }, touch: true });
  ok('Employee on a phone: no extra menu', !(await ph.$('#tabbar [data-m="more-m"]')));
  await ph.context().close();
  const f = await page(br, b, { session: ak });
  await f.route(/script\.google/, r => r.abort()); await f.reload(); await wait(f, 500);
  ok('Script unreachable on return: the page is not blank', (await f.innerText('#main')).trim().length > 10 && (await f.$$('#nav button')).length > 0, (await f.innerText('#main')).replace(/\s+/g, ' ').slice(0, 80));
  await f.context().close();

  const o = await page(br, b, { session: hos });
  ok('Project Owner: sees projects', !!(await o.$('#nav [data-v="portfolio"]')));
  await o.click('#nav [data-v="admin"]'); await o.waitForTimeout(300);
  ok('Project Owner: Administration shows employees and the log only', (await o.$$eval('[data-act="admintab"]', x => x.map(e => e.dataset.tab).join())) === 'users,log');
  await o.click('#nav [data-v="overview"]'); await o.waitForTimeout(300);
  ok('Project Owner: can plan', (await o.$$eval('#menu-new button:not([hidden])', x => x.length)) === 7);
  await o.context().close();

  const w = await page(br, b, { session: v });
  ok('Viewer: no write controls', await w.evaluate(() => getComputedStyle(document.querySelector('.needs-write')).display === 'none'));
  await w.click('#nav [data-v="tasks"]'); await wait(w);
  ok('Viewer: no delete, no tick', !(await w.$('.task-del-btn')) && !(await w.$('[data-act="task-done"]:not([disabled])')));
  await w.context().close();

  // A session the server no longer knows must lead back to sign-in, not a frozen page.
  const q = await page(br, b, { session: ak });
  await q.evaluate(() => { SYNC.session = 'expired-session'; return SYNC.pull(true); }); await wait(q, 400);
  ok('An expired session goes back to sign-in', await q.evaluate(() => !document.querySelector('#signin').hidden), (await q.innerText('#signin')).replace(/\s+/g, ' ').slice(0, 90));
  await q.context().close();

  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 700)); process.exit(1); });
