// every page at phone, tablet, desktop, in light and dark: overflow, errors, screenshots
const { chromium } = require('playwright');
const { backend, page } = require('./harness');
(async () => {
  const br = await chromium.launch();
  const b = backend(false);
  const sizes = [['phone', 390, 800, true], ['tablet', 820, 1100, false], ['desktop', 1440, 900, false]];
  const views = ['overview', 'tasks', 'portfolio', 'decisions', 'weekly', 'notifications', 'reports', 'actions', 'raci', 'governance', 'admin'];
  let bad = 0, n = 0;
  for (const [nm, w, h, touch] of sizes) for (const dark of [false, true]) {
    const p = await page(br, b, { viewport: { width: w, height: h }, dark, touch, me: 'Head of Sales', fonts: false });
    await p.evaluate(d => { if (d) document.documentElement.setAttribute('data-theme', 'dark'); }, dark);
    for (const v of views.concat(['project'])) {
      await p.evaluate(v => {
        const el = document.createElement('button'); el.dataset.act = v === 'project' ? 'open' : 'nav'; if (v === 'project') el.dataset.id = SCT.state.projects[1].id; else el.dataset.v = v; document.body.appendChild(el); el.click(); el.remove();
      }, v);
      await p.waitForTimeout(60);
      const o = await p.evaluate(() => {
        const dw = document.documentElement.clientWidth;
        const over = document.documentElement.scrollWidth - dw;
        const wide = [...document.querySelectorAll('#main *')].filter(e => { if (e.closest('.tbl-wrap,.board,.acc:not([open]),.chips,.seg,.tabs')) return false; const r = e.getBoundingClientRect(); return r.width && r.right > dw + 1; }).slice(0, 3).map(e => e.tagName + '.' + e.className);
        return { over, wide };
      });
      n++;
      if (o.over > 0 || o.wide.length) { bad++; console.log('OVERFLOW', nm, dark ? 'dark' : 'light', v, o.over, o.wide.join(' ')); }
      if (!dark || v === 'overview') await p.screenshot({ path: require('path').join(process.env.SHOTS || require('os').tmpdir(), 'sw_' + nm + (dark ? '_d_' : '_') + v + '.png') });
    }
    if (p.errs.length) { bad++; console.log('ERR', nm, p.errs.slice(0, 3)); }
    await p.context().close();
  }
  console.log(n + ' page checks, ' + bad + ' problems');
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
