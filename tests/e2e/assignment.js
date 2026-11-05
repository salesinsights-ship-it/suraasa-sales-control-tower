// The whole flow in a real browser: assign by email, the employee works on it, the manager hears back.
const { chromium } = require('playwright');
const path = require('path');
const { backend, page, CLIENT } = require('./harness');
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n + (x ? ' :: ' + x : '')]);
const wait = (p, ms) => p.waitForTimeout(ms || 350);
const shots = process.env.SHOTS;
const shot = async (p, n) => { if (shots) await p.screenshot({ path: path.join(shots, n + '.png'), fullPage: n.startsWith('full') }); };
const future = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const srv = (b, s) => b.post({ action: 'pull', session: s }).state;
function company() {
  const b = backend(true);
  b.addUser({ email: 'rahul@suraasa.com', name: 'Rahul Verma', role: 'Employee' });
  b.addUser({ email: 'priya@suraasa.com', name: 'Priya Nair', role: 'Employee' });
  b.ctx.backfillEmployeeIds_();
  const sh = b.ss.getSheetByName('Users'), at = b.ctx.userColumns_(sh);
  sh.getRange(b.ctx.users_().findIndex(u => u.email === 'rahul@suraasa.com') + 2, at.designation + 1).setValue('Senior Setter');
  sh.getRange(b.ctx.users_().findIndex(u => u.email === 'rahul@suraasa.com') + 2, at.department + 1).setValue('Sales');
  return b;
}
(async () => {
  const br = await chromium.launch();
  const b = company();
  const ad = b.sessionFor('admin@suraasa.com').session, emp = b.sessionFor('rahul@suraasa.com').session, other = b.sessionFor('priya@suraasa.com').session;
  const a = await page(br, b, { session: ad, viewport: { width: 1440, height: 1000 } });
  await shot(a, 'full-admin-home');
  const before = srv(b, ad).tasks.length;
  const proj = srv(b, ad).projects[1];

  // the form
  await a.click('.cmd [data-act="assign-task"]'); await wait(a);
  ok('the form opens with every field the brief lists', (await a.$$eval('#mform [name]', x => x.map(e => e.name).join())) === 'name,desc,projectId,ownerEmail,priority,due');
  await a.fill('#mform [name="name"]', 'Website redesign'); await a.fill('#mform [name="desc"]', 'Rebuild the landing page');
  await a.selectOption('#mform [name="projectId"]', proj.id); await a.selectOption('#mform [name="priority"]', 'P1'); await a.fill('#mform [name="due"]', future(7));
  await a.fill('#mform [name="ownerEmail"]', 'rahul@suraasa'); await wait(a, 100);
  ok('a partial email finds nobody', /No registered employee/.test(await a.textContent('#emp-match')));
  await a.click('[data-act="save-modal"]'); await wait(a);
  ok('an unregistered email cannot go further', /not a registered employee/.test(await a.textContent('#ferr')) && !!(await a.$('#mform')));
  await a.fill('#mform [name="ownerEmail"]', 'Rahul Verma'); await wait(a, 100);
  ok('a name is not accepted in place of an email', /No registered employee/.test(await a.textContent('#emp-match')));
  await a.fill('#mform [name="ownerEmail"]', 'RAHUL@suraasa.com'); await wait(a, 100);
  const card = await a.textContent('#emp-match');
  ok('the exact email shows the employee', /Rahul Verma/.test(card) && /Senior Setter/.test(card) && /EMP-/.test(card), card);
  await shot(a, 'assign-form');
  await a.click('[data-act="save-modal"]'); await wait(a);
  ok('nothing is saved before confirming', srv(b, ad).tasks.length === before);
  ok('the preview shows the task and the person', /Confirm this assignment/.test(await a.textContent('#modal')) && /Rahul Verma/.test(await a.textContent('#modal')) && /High \(P1\)/.test(await a.textContent('#modal')));
  await shot(a, 'assign-confirm');
  await a.click('[data-act="assign-back"]'); await wait(a);
  ok('Back keeps what was typed', (await a.inputValue('#mform [name="name"]')) === 'Website redesign');
  await a.click('[data-act="save-modal"]'); await wait(a);
  // a double click is one task
  await a.evaluate(() => { const b = document.querySelector('#assign-go'); b.click(); b.click(); }); await wait(a, 800);
  await shot(a, 'assign-done');
  const after = srv(b, ad), made = after.tasks.filter(t => t.name === 'Website redesign');
  ok('a double click makes one task', made.length === 1 && after.tasks.length === before + 1, made.length + '');
  const t = made[0];
  ok('the task is in the Sheet with its email and ID', /^T-\d+$/.test(t.id) && t.ownerEmail === 'rahul@suraasa.com' && t.owner === 'Rahul Verma' && t.assignedBy === 'Admin');
  ok('one email to the employee', b.mails.length === 1 && b.mails[0].to === 'rahul@suraasa.com', b.mails.map(m => m.to).join());
  const done = await a.textContent('#modal');
  ok('the result says what really happened', /Saved/.test(done) && /Email accepted/.test(done) && /cannot confirm/.test(done), done.slice(0, 200));
  await a.click('#modal .mf [data-act="close-modal"]'); await wait(a);
  ok('the task is on the site straight away', await a.evaluate(id => SCT.state.tasks.some(x => x.id === id), t.id));

  // one-line command
  await a.fill('#cmd-text', 'Assign the high priority banner refresh task to rahul@suraasa.com under the ' + proj.name + ' project with a deadline of ' + new Date(Date.now() + 9 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  await a.press('#cmd-text', 'Enter'); await wait(a);
  ok('a complete command goes to the preview, not straight to saving', /Confirm this assignment/.test(await a.textContent('#modal')) && srv(b, ad).tasks.length === before + 1);
  ok('the command was read correctly', /banner refresh/.test(await a.textContent('#modal')) && /High \(P1\)/.test(await a.textContent('#modal')));
  await a.click('[data-act="close-modal"]'); await wait(a);
  await a.fill('#cmd-text', 'Assign the logo task to nobody@suraasa.com under the Unknown thing project'); await a.press('#cmd-text', 'Enter'); await wait(a);
  const prob = await a.textContent('#ferr');
  ok('a bad command guesses nothing and says what is missing', /not a registered employee/.test(prob) && /Unknown thing/.test(prob) && /deadline/.test(prob) && (await a.inputValue('#mform [name="projectId"]')) === '', prob);
  await a.click('[data-act="close-modal"]').catch(() => {}); await wait(a); if (await a.$('#modal')) await a.evaluate(() => document.querySelector('[data-act="close-modal"]').click()); await wait(a);

  // the employee
  const e = await page(br, b, { session: emp, url: 'file://' + path.join(__dirname, '..', '..', 'dist', 'index.html') + '#task=' + t.id }); await wait(e, 500);
  ok('a link from the email opens the task', /Website redesign/.test(await e.textContent('#modal')));
  await shot(e, 'employee-task');
  await e.evaluate(() => document.querySelector('#modal [data-act="close-modal"]').click()); await wait(e);
  ok('the employee sees it on their dashboard', /Website redesign/.test(await e.textContent('#main')));
  await shot(e, 'full-employee-home');
  ok('they are told it was assigned', await e.evaluate(() => SCT.state.audit.some(a => a.action === 'task_assigned')));
  await e.click('#nav [data-v="notifications"]'); await wait(e);
  ok('an in-app notification is waiting', /Assigned to you/.test(await e.textContent('#main')), (await e.textContent('#main')).slice(0, 140));
  await e.click('#nav [data-v="overview"]'); await wait(e);
  await e.click('.dash-quick-btn[data-to="In Progress"][data-id="' + t.id + '"]'); await wait(e, 1400);
  const row = () => { const sh = b.ss.getSheetByName('Tasks'); return { status: sh.getRange(b.ctx.rowOfId_(sh, 1, t.id), 12).getValues()[0][0] }; };
  ok('their status change reaches the Sheet', row().status === 'In Progress', JSON.stringify(row()));
  b.mails.length = 0;
  await e.click('.dash-quick-btn[data-to="Completed"][data-id="' + t.id + '"]'); await wait(e, 1400);
  ok('completing it reaches the Sheet', row().status === 'Completed');
  ok('the person who assigned it is told', b.mails.some(m => m.to === 'admin@suraasa.com' && /^Task Completed/.test(m.subject)), b.mails.map(m => m.to + ':' + m.subject).join());

  // someone else
  const o = await page(br, b, { session: other, url: 'file://' + path.join(__dirname, '..', '..', 'dist', 'index.html') + '#task=' + t.id }); await wait(o, 500);
  ok('another employee\'s link opens nothing', !(await o.$('#modal')) && /not available to you/.test(await o.textContent('#toast')), await o.textContent('#toast'));
  ok('nothing about it is in their browser', await o.evaluate(() => !JSON.stringify(SCT.state).includes('Website redesign')));
  await o.context().close();

  // reassign
  await a.reload(); await wait(a, 700);
  const t2 = (await a.evaluate(() => 1)) && b.post({ action: 'assign', session: ad, requestId: 'r2', task: { name: 'Reassign me', projectId: proj.id, ownerEmail: 'rahul@suraasa.com', priority: 'P2', due: future(4) } }).task;
  await a.reload(); await wait(a, 700); b.mails.length = 0;
  await a.evaluate(id => { location.hash = '#task=' + id; }, t2.id); await wait(a, 500);
  await a.click('#modal [data-act="reassign-task"]'); await wait(a);
  await a.fill('#mform [name="ownerEmail"]', 'priya@suraasa.com'); await a.fill('#mform [name="reason"]', 'Rahul is on leave'); await a.click('[data-act="save-modal"]'); await wait(a, 1400);
  const r2 = srv(b, ad).tasks.find(x => x.id === t2.id);
  ok('reassigning by email updates the Sheet', r2.ownerEmail === 'priya@suraasa.com' && r2.owner === 'Priya Nair');
  ok('the new owner is emailed', b.mails.length === 1 && b.mails[0].to === 'priya@suraasa.com' && /Reassigned/.test(b.mails[0].subject), b.mails.map(m => m.to).join());
  await a.evaluate(() => { const c = document.querySelector('#modal [data-act="close-modal"]'); if (c) c.click(); }); await wait(a);

  // administration
  await a.click('#nav [data-v="admin"]'); await wait(a);
  const emps = await a.textContent('#main');
  ok('the employee directory lists IDs, roles and status', /EMP-/.test(emps) && /Super Admin/.test(emps) && /Manager/.test(emps) && /Senior Setter/.test(emps));
  await shot(a, 'full-admin-employees');
  await a.click('[data-act="admintab"][data-tab="integrations"]'); await wait(a, 500);
  const integ = await a.textContent('#main');
  ok('integrations shows each connection and no secrets', /Google Sheet/.test(integ) && /Email/.test(integ) && /Protected/.test(integ) && !/AUTH_|apps\.googleusercontent/.test(integ), integ.slice(0, 120));
  await shot(a, 'full-admin-integrations');
  await a.click('[data-act="admintab"][data-tab="log"]'); await wait(a, 500);
  const log = await a.textContent('#main');
  ok('the notification log shows recipient, event and status', /rahul@suraasa\.com/.test(log) && /Task assigned/.test(log) && /Accepted by mail service/.test(log));
  await shot(a, 'full-admin-log');

  // dashboards use real numbers
  await a.click('#nav [data-v="overview"]'); await wait(a);
  const total = await a.evaluate(() => SCT.state.projects.filter(p => !p.archivedAt).map(p => p.id));
  const real = srv(b, ad).tasks.filter(x => total.includes(x.projectId) && x.status !== 'Cancelled');
  const num = async n => a.evaluate(l => +([...document.querySelectorAll('.stat')].find(s => s.querySelector('.stat-l').textContent === l).querySelector('b').textContent.replace('%', '')), n);
  ok('total, completed and overdue match the data', (await num('Total Tasks')) === real.length && (await num('Completed Tasks')) === real.filter(x => x.status === 'Completed').length, (await num('Total Tasks')) + ' / ' + real.length);
  ok('the pieces add up', (await num('Pending Tasks')) + (await num('In-Progress Tasks')) + (await num('Completed Tasks')) === (await num('Total Tasks')));
  await a.selectOption('#mgmt-proj-filter', proj.id); await wait(a);
  ok('the project filter changes the numbers', (await num('Total Tasks')) === real.filter(x => x.projectId === proj.id).length);
  await a.selectOption('#mgmt-proj-filter', ''); await wait(a);
  await shot(a, 'full-admin-home-after');

  // phone
  const m = await page(br, b, { session: ad, viewport: { width: 390, height: 844 }, touch: true });
  await wait(m, 400);
  ok('phone: no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await m.evaluate(() => document.documentElement.scrollWidth + ''));
  await shot(m, 'full-phone-home');
  await m.evaluate(() => document.querySelector('.cmd [data-act="assign-task"]').click()); await wait(m);
  ok('phone: the assign form fits', await m.evaluate(() => document.querySelector('#modal .modal').getBoundingClientRect().width <= window.innerWidth));
  await shot(m, 'phone-assign');
  await m.context().close();

  ok('no script errors', !a.errs.length && !e.errs.length, a.errs.concat(e.errs).join(' | ').slice(0, 300));
  await br.close();
  results.forEach(r => console.log(r[0], r[1]));
  console.log(results.filter(r => r[0] === 'PASS').length + ' of ' + results.length + ' passed');
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
})().catch(e => { results.forEach(r => console.log(r[0], r[1])); console.error(String(e).slice(0, 900)); process.exit(1); });
