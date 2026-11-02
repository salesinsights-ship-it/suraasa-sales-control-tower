// Quick headless check of every page, tab and core edit. Run: node src/smoke-test.js (needs jsdom).
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'Suraasa_Sales_Control_Tower.html'), 'utf8');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.addEventListener('error', e => errors.push(e.message));
w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
const doc = w.document;
const S = () => w.SCT.state;
const click = sel => { const el = doc.querySelector(sel); if (!el) throw new Error('missing ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const main = () => doc.getElementById('main').innerHTML.length;
console.log('projects', S().projects.length, 'tasks', S().tasks.length, 'risks', S().risks.length, 'deps', S().dependencies.length, 'decisions', S().decisions.length, 'actions', S().actions.length);
console.log('health', S().projects.map(p => p.id + ':' + w.SCT.health(p).rag).join(' '));
console.log('queue', w.SCT.actionQueue().length, 'raci issues', w.SCT.raciIssues().length);

// every page
for (const v of ['overview', 'portfolio', 'tasks', 'decisions', 'weekly']) { click(`#nav [data-v="${v}"]`); if (main() < 500) errors.push('view ' + v + ' too short'); console.log(v, main()); }
for (const v of ['actions', 'raci', 'governance', 'data']) { click(`#menu-more [data-v="${v}"]`); if (main() < 500) errors.push('view ' + v + ' too short'); console.log(v, main()); }

// every project and tab
for (const p of S().projects) {
  click('#nav [data-v="portfolio"]');
  doc.querySelector(`[data-act="open"][data-id="${p.id}"]`) || click('[data-act="group"]');
  click(`[data-act="open"][data-id="${p.id}"]`);
  for (const t of ['summary', 'plan', 'risks', 'updates', 'people']) { click(`[data-act="ptab"][data-tab="${t}"]`); if (main() < 300) errors.push(p.id + ' tab ' + t + ' short'); }
}
console.log('all project tabs rendered');

// page tabs and filters
click('#nav [data-v="tasks"]');
for (const f of ['my', 'week', 'approval', 'unassigned', 'completed', 'pending']) click(`[data-act="tfilter"][data-f="${f}"]`);
click('#nav [data-v="decisions"]');
for (const t of ['risks', 'deps', 'decisions']) click(`[data-act="rtab"][data-tab="${t}"]`);

// tick a task done and keep it
click('#nav [data-v="tasks"]');
const id = doc.querySelector('.r-task').dataset.id;
click(`.tick[data-id="${id}"]`);
const saved = JSON.parse(w.localStorage.getItem('suraasa_sales_control_tower_v1'));
console.log('persisted', id, saved.tasks.find(t => t.id === id).status);

// new task from just a name
click('#menu-new [data-act="add-task"]');
doc.querySelector('#mform [name=name]').value = 'Smoke test task';
click('[data-act="save-modal"]');
console.log('tasks after add', S().tasks.length, 'panel closed', !doc.getElementById('modal'));

// weekly update
click('#menu-new [data-act="add-update"]');
doc.querySelector('#mform [name=progress]').value = 'did things';
doc.querySelector('#mform [name=next]').value = 'more';
click('[data-act="save-modal"]');
console.log('updates', S().updates.length);

// timeline
click('#nav [data-v="portfolio"]');
click('[data-act="pmode"][data-tab="timeline"]');
click('[data-act="gantt-all"]');
console.log('timeline rows', doc.querySelectorAll('.grow').length);

// reset
click('#menu-more [data-v="data"]');
click('[data-act="reset"]');
console.log('after reset tasks', S().tasks.length);
console.log('ERRORS:', errors.length ? errors : 'none');
process.exit(errors.length ? 1 : 0);
