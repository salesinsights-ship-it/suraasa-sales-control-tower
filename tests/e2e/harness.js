// Runs the site in a real browser against the real Code.gs on a simulated Sheet loaded with live data.
const fs = require('fs');
const path = require('path');
const { createBackend } = require('../mock-gas');
const ROOT = path.join(__dirname, '..', '..');
// FIXTURE points to a saved copy of real data; without it the built-in starting data is used.
const live = process.env.FIXTURE
  ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')).state
  : new Function(fs.readFileSync(path.join(ROOT, 'src', 'seed.js'), 'utf8') + ';return buildSeed();')();
const CLIENT = 'test.apps.googleusercontent.com';
function backend(secure, code) {
  const b = createBackend({ code, props: { AUTH_CLIENT_ID: CLIENT, AUTH_DOMAIN: 'suraasa.com', AUTH_REQUIRED: 'false' } });
  if (code) b.ctx.push_({ state: JSON.parse(JSON.stringify(live)), force: true }); else b.load(JSON.parse(JSON.stringify(live)));
  if (secure) {
    b.addUser({ email: 'admin@suraasa.com', name: 'Admin', role: 'Administrator' });
    b.addUser({ email: 'hos@suraasa.com', name: 'Head of Sales', role: 'Project Owner' });
    b.addUser({ email: 'ak@suraasa.com', name: 'AK', role: 'Task Owner' });
    b.addUser({ email: 'view@suraasa.com', name: 'Viewer One', role: 'Viewer' });
    b.props.set('AUTH_REQUIRED', 'true');
  }
  return b;
}
async function page(browser, b, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  p.errs = []; p.net = { down: false };
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load|ERR_|Sheet (save|pull) error/.test(m.text())) p.errs.push(m.text()); });
  p.on('dialog', d => { p.lastDialog = d.message(); return p.decline ? d.dismiss() : d.accept(); });
  await p.route(/script\.google\.com/, async r => {
    if (p.net.down) return r.abort();
    const q = r.request();
    const out = q.method() === 'POST' ? b.post(JSON.parse(q.postData())) : b.get(Object.fromEntries(new URL(q.url()).searchParams));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await p.route(/fonts\.(googleapis|gstatic)/, r => opts.fonts ? r.continue() : r.abort());
  await p.route(/accounts\.google\.com/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.google={accounts:{id:{initialize(c){window.__gsi=c},renderButton(el){el.textContent="Sign in with Google"},disableAutoSelect(){}}}}' }));
  if (opts.session) await p.addInitScript(s => { try { if (!sessionStorage.getItem('x')) { localStorage.setItem('sct_session', s); sessionStorage.setItem('x', '1'); } } catch (e) {} }, opts.session);
  if (opts.me) await p.addInitScript(m => localStorage.setItem('sct_me', m), opts.me);
  if (!opts.session && opts.person !== null) await p.addInitScript(e => { if (!sessionStorage.getItem('out')) localStorage.setItem('sct_person', e); }, opts.person || 'divya@suraasa.com');
  await p.goto(opts.url || 'file://' + path.join(ROOT, 'dist', 'index.html'));
  await p.waitForTimeout(opts.fonts ? 1500 : 450);
  if (!opts.session && !opts.person && opts.person !== null) await p.evaluate(n => SCT.actAs(n), opts.me || '');
  return p;
}
module.exports = { backend, page, CLIENT };
