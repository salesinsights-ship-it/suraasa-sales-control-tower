// Serves the built site with the headers from vercel.json, so a too-strict policy cannot break production unseen.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { backend } = require('./harness');
const ROOT = path.join(__dirname, '..', '..');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
(async () => {
  const headers = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers[0].headers;
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, 'dist', q.url === '/' ? 'index.html' : q.url.split('?')[0]);
    headers.forEach(h => r.setHeader(h.key, h.value));
    if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', f.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    r.end(fs.readFileSync(f));
  }).listen(0);
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = backend(true), session = b.sessionFor('admin@suraasa.com').session;
  const br = await chromium.launch(), ctx = await br.newContext(), p = await ctx.newPage();
  const bad = []; p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) bad.push(m.text()); });
  p.on('pageerror', e => bad.push(e.message));
  await p.route(/script\.google\.com/, r => { const q = r.request(); const out = q.method() === 'POST' ? b.post(JSON.parse(q.postData())) : b.get(Object.fromEntries(new URL(q.url()).searchParams)); return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); });
  await p.route(/script\.googleusercontent\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
  await p.route(/accounts\.google\.com\/gsi\/client/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.google={accounts:{id:{initialize(c){window.__gsi=c},renderButton(el){el.textContent="Sign in with Google"},disableAutoSelect(){}}}}' }));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.goto(url); await p.waitForTimeout(600);
  ok('the sign-in script loads under the policy', await p.evaluate(() => !!window.__gsi));
  await p.evaluate(s => { localStorage.setItem('sct_session', s); }, session); await p.reload(); await p.waitForTimeout(900);
  ok('the site loads and reaches the server under the policy', await p.evaluate(() => SCT.state.tasks.length > 0 && document.querySelector('#signin').hidden));
  ok('the logo, styles and charts show', await p.evaluate(() => { const i = document.querySelector('.brand img'); return i.naturalWidth > 0 && !!document.querySelector('.hbars'); }));
  // Apps Script answers by redirecting to this host, so the policy must allow it.
  ok('the host Apps Script redirects to is allowed', await p.evaluate(async () => { try { return (await (await fetch('https://script.googleusercontent.com/macros/echo')).json()).ok; } catch (e) { return false; } }));
  ok('nothing was blocked', !bad.length, bad.join(' | ').slice(0, 400));
  const res = await p.request.get(url);
  ok('the page cannot be framed, and types are not guessed', /frame-ancestors 'none'/.test(res.headers()['content-security-policy']) && res.headers()['x-content-type-options'] === 'nosniff');
  await br.close(); srv.close();
  results.forEach(r => console.log(r[0], r[1]));
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
