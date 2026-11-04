// The sign-in on the page, with both scripts: the one running today and the new one.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
const OLD = path.join(__dirname, 'old-deployed-Code.gs');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x !== undefined && x !== '' ? ' :: ' + x : '')]);
const wait = (p, ms) => p.waitForTimeout(ms || 250);
const signIn = async (p, email, pw) => { await p.fill('#si-email', email); await p.fill('#si-pw', pw); await p.click('#form-signin .auth-btn'); await wait(p, 900); };
const settle = async p => { await wait(p, 500); await p.evaluate(() => SYNC.flush()); await wait(p, 700); };
const tasks = b => (b.ctx.fullPull_ ? b.post({ action: 'pull' }).state : b.ctx.pull_().state).tasks;
const addUsers = b => [['manish@suraasa.com', 'Manish Pandey (Head of Sales)', 'management'], ['akhand@suraasa.com', 'Akhand Mishra', 'employee']].forEach(([email, name, role]) => b.addUser({ email, name, role }));
(async () => {
  const br = await chromium.launch();
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'dist', 'index.html'), 'utf8');
  ok('no readable passwords in the page', !/cleanPw|legacyPw|Sur@[A-Z]|customPassword/.test(html));
  ok('no sign-up or reset left in the page', !/form-signup|data-auth-tab/.test(html));
  ok('the page holds the working link', html.includes('AKfycbxHM02G-') && !html.includes('AKfycbzkTjeuNLqYSZaSWIB11'));

  for (const [label, code] of [['old script', OLD], ['new script', undefined]]) {
    const b = backend(false, code);
    if (!code) addUsers(b);
    const before = tasks(b).length;
    const p = await page(br, b, { person: null });
    ok(label + ': sign-in shows first, with no data', await p.evaluate(() => !document.querySelector('#signin').hidden && !SCT.state.projects.length));
    await signIn(p, 'nobody@suraasa.com', 'x');
    ok(label + ': unknown email is refused', /No account found/.test(await p.innerText('#signin')));
    await signIn(p, 'divya@suraasa.com', 'wrong');
    ok(label + ': wrong password is refused and keeps the email', /Incorrect password/.test(await p.innerText('#signin')) && await p.inputValue('#si-email') === 'divya@suraasa.com');
    await signIn(p, 'MANISH@suraasa.com ', 'manish-2026');
    ok(label + ': sign-in loads the data', await p.evaluate(() => document.querySelector('#signin').hidden && SCT.state.tasks.length > 0 && SCT.ME.role === 'Administrator' && SCT.ME.name === 'Manish Pandey'));
    const navs = await p.$$eval('#nav button', x => x.map(n => n.dataset.v));
    ok(label + ': management has the full menu', navs.includes('admin') && navs.includes('portfolio'), navs.join());
    for (const v of navs) { await p.click('#nav [data-v="' + v + '"]'); await wait(p, 120); ok(label + ': management opens ' + v, (await p.innerText('#main')).trim().length > 10); }
    await p.click('#nav [data-v="tasks"]'); await wait(p);
    await p.click('.page-h [data-act="add-task"]'); await wait(p);
    await p.fill('#modal [name="name"]', 'Given to Akhand'); await p.fill('#modal [name="owner"]', 'Akhand Mishra');
    await p.click('#modal .mf .btn.primary'); await settle(p);
    ok(label + ': a new task reaches the Sheet', tasks(b).some(t => t.name === 'Given to Akhand'), tasks(b).length);
    if (!code) ok('new script: the assigned person is emailed, naming who assigned it', b.mails.length === 1 && b.mails[0].to === 'akhand@suraasa.com' && /^Manish Pandey assigned you a task/.test(b.mails[0].subject), JSON.stringify(b.mails.map(m => m.subject)));
    ok(label + ': no page errors for management', !p.errs.length, p.errs.join('|'));
    await p.reload(); await wait(p, 800);
    ok(label + ': stays signed in after a refresh', await p.evaluate(() => document.querySelector('#signin').hidden && SCT.ME.name === 'Manish Pandey'));
    await p.click('#me-btn'); await p.click('[data-act="sign-out"]'); await wait(p, 900);
    ok(label + ': sign out returns to sign-in and keeps no copy', await p.evaluate(() => !document.querySelector('#signin').hidden && !SCT.state.tasks.length && !localStorage.getItem('sct_person')));
    await p.context().close();

    const e = await page(br, b, { person: 'akhand@suraasa.com' });
    const all = tasks(b), own = all.filter(t => /Akhand Mishra/.test(t.owner || '') || /Akhand Mishra/.test(t.accountable || ''));
    ok(label + ': employee holds only their tasks', await e.evaluate(n => SCT.state.tasks.length === n && SCT.ME.role === 'Task Owner', own.length), await e.evaluate(() => SCT.state.tasks.length) + ' of ' + all.length);
    const enav = await e.$$eval('#nav button', x => x.map(n => n.dataset.v));
    ok(label + ': employee has the short menu', enav.join() === 'overview,tasks,notifications', enav.join());
    for (const v of enav) { await e.click('#nav [data-v="' + v + '"]'); await wait(e, 120); ok(label + ': employee opens ' + v, (await e.innerText('#main')).trim().length > 5); }
    await e.click('#nav [data-v="tasks"]'); await wait(e);
    const t = await e.evaluate(() => SCT.state.tasks.find(x => x.name === 'Given to Akhand').id);
    await e.evaluate(id => { const el = document.createElement('button'); el.dataset.act = 'open-task'; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }, t); await wait(e);
    await e.fill('#tu-text', 'Employee note'); await e.click('[data-act="tu-save"]'); await settle(e);
    const after = tasks(b);
    ok(label + ': employee note reaches the Sheet', (after.find(x => x.id === t).notes || []).some(n => n.text === 'Employee note'));
    ok(label + ': an employee save removes nobody else\'s tasks', after.length === before + 1, before + ' to ' + after.length);
    ok(label + ': no page errors for the employee', !e.errs.length, e.errs.join('|'));
    await e.context().close();

    const ph = await page(br, b, { person: 'manish@suraasa.com', viewport: { width: 390, height: 800 }, touch: true });
    ok(label + ': fits a phone', await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await ph.context().close();
  }

  // Going to the Sheet from the site: management only.
  {
    const o = backend(false);
    const m = await page(br, o, { person: 'manish@suraasa.com' });
    const link = m.locator('#nav a.nav-link');
    ok('the sidebar opens the Sheet in a new tab', await link.getAttribute('target') === '_blank' && /docs\.google\.com\/spreadsheets\/d\/1Di4qDz4_bpKm7DB2SpjZV2dtOKJBBxS6-dnm99fk3lc/.test(await link.getAttribute('href')));
    await m.route(/docs\.google\.com/, r => r.fulfill({ status: 200, contentType: 'text/html', body: 'sheet' }));
    const [tab] = await Promise.all([m.context().waitForEvent('page'), link.click()]);
    ok('clicking it opens the Sheet and keeps the site open', /docs\.google\.com/.test(tab.url()) && (await m.url()).startsWith('file:'), tab.url().slice(0, 40));
    await tab.close();
    await m.click('#me-btn'); await wait(m);
    ok('the profile menu has it too', await m.locator('#menu-me a').getAttribute('target') === '_blank');
    await m.context().close();
    const r = await page(br, o, { person: 'manish@suraasa.com', viewport: { width: 1100, height: 800 } });
    ok('it fits the narrow sidebar', await r.locator('#nav a.nav-link').isVisible());
    await r.context().close();
    const ph = await page(br, o, { person: 'manish@suraasa.com', viewport: { width: 390, height: 800 }, touch: true });
    await ph.click('#tabbar [data-m="more-m"]'); await wait(ph);
    ok('the phone More menu has it', await ph.locator('#menu-more-m a').isVisible());
    await ph.context().close();
    const e = await page(br, o, { person: 'aj@suraasa.com' });
    await e.click('#me-btn'); await wait(e);
    ok('employees do not get the Sheet link', !(await e.$('a[href*="docs.google.com"]')));
    await e.context().close();
  }

  // Saves that must never replace the Sheet with a partial or empty copy (old script).
  {
    const o = backend(false, OLD); const n = tasks(o).length;
    const s = await page(br, o, { person: null });
    await s.route(/script\.google/, r => r.abort()); await s.reload(); await wait(s, 500);
    await s.unroute(/script\.google/); await s.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); return SYNC.flush(); }); await wait(s, 700);
    ok('nothing is sent from the sign-in screen', tasks(o).length === n, n + ' to ' + tasks(o).length);
    await s.context().close();

    const e = await page(br, o, { person: 'aj@suraasa.com' });
    const id = await e.evaluate(() => SCT.state.tasks[0].id);
    let pulls = 0;
    await e.route(/script\.google/, r => { const q = r.request(); if (q.method() === 'POST' && /"action":"pull"/.test(q.postData() || '') && pulls++ === 0) return r.abort(); return r.fallback(); });
    await e.reload(); await wait(e, 900);
    await e.evaluate(i => { SCT.state.tasks.find(t => t.id === i).desc = 'Saved after a failed load'; SYNC.onLocalChange(); }, id); await settle(e); await e.evaluate(() => SYNC.flush()); await wait(e, 900);
    ok('an employee save after a failed load keeps everyone\'s tasks', tasks(o).length === n, n + ' to ' + tasks(o).length);
    await e.context().close();
  }

  // Browsers that saved the link that asks for Google sign-in move to the working one.
  const b = backend(false);
  const q = await page(br, b, { person: 'manish@suraasa.com' });
  await q.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('suraasa_sales')); const s = JSON.parse(localStorage.getItem(k)); s.meta.sync.url = 'https://script.google.com/macros/s/AKfycbzkTjeuNLqYSZaSWIB11wD54IcZ2FHfllp9Icn7wvlyDRlafxv14AbprzBNh8cIR7s_Rw/exec'; localStorage.setItem(k, JSON.stringify(s)); });
  await q.reload(); await wait(q, 900);
  ok('a browser with the blocked link moves to the working link', await q.evaluate(() => SCT.SYNC.config.url.includes('AKfycbxHM02G-')), await q.evaluate(() => SCT.SYNC.config.url.slice(-8)));
  await q.context().close();
  await br.close();
  for (const r of results) console.log(r[0], r[1]);
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { for (const r of results) console.log(r[0], r[1]); console.error(String(e).slice(0, 700)); process.exit(1); });
