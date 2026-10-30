const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','dist','Suraasa_Sales_Control_Tower.html'),'utf8');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.addEventListener('error', e => errors.push(e.message));
w.confirm = () => true; w.alert = () => {};
const S = w.SCT.state;
const st = w.SCT.stats();
console.log('projects', S.projects.length, 'tasks', S.tasks.length, 'risks', S.risks.length, 'deps', S.dependencies.length, 'decisions', S.decisions.length, 'actions', S.actions.length);
console.log('stats', JSON.stringify({...st, hs: undefined}));
console.log('health', S.projects.map(p => p.id + ':' + w.SCT.health(p).rag).join(' '));
console.log('queue', w.SCT.actionQueue().length, 'raci issues', w.SCT.raciIssues().length);
// walk every nav view
const doc = w.document;
const click = sel => { const el = doc.querySelector(sel); if (!el) throw new Error('missing ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
for (const v of ['overview','actions','portfolio','timeline','tasks','raci','risks','decisions','weekly','governance','data']) { click(`[data-act="nav"][data-v="${v}"]`); const len = doc.getElementById('main').innerHTML.length; if (len < 500) errors.push('view ' + v + ' too short'); console.log(v, len); }
// open each project + tabs
for (const p of S.projects) { click(`[data-act="nav"][data-v="portfolio"]`); click(`[data-act="open"][data-id="${p.id}"]`); for (const t of ['charter','plan','tasks','raci','risks','updates','history']) { click(`[data-act="ptab"][data-tab="${t}"]`); if (doc.getElementById('main').innerHTML.length < 300) errors.push(p.id + ' tab ' + t + ' short'); } }
console.log('all project tabs rendered');
// task filters
click(`[data-act="nav"][data-v="tasks"]`); for (const f of ['all','my','overdue','week','pending','completed','approval','unassigned']) click(`[data-act="tfilter"][data-f="${f}"]`);
// inline status change & persistence
click(`[data-act="tfilter"][data-f="all"]`);
const sel = doc.querySelector('select[data-act="task-status"][data-id="T-059"]'); sel.value = 'In Progress'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
const saved = JSON.parse(w.localStorage.getItem('suraasa_sales_control_tower_v1'));
console.log('persisted T-059 status:', saved.tasks.find(t => t.id === 'T-059').status, '| activity entries:', saved.activity.length);
// open task form, save via modal
click(`[data-act="add-task"]`); const form = doc.getElementById('mform'); form.querySelector('[name=name]').value = 'Smoke test task'; form.querySelector('[name=deliverable]').value = 'x'; form.querySelector('[name=owner]').value='AK'; form.querySelector('[name=accountable]').value='Head of Sales';
click('[data-act="save-modal"]'); console.log('tasks after add', w.SCT.state.tasks.length, 'modal closed', !doc.getElementById('modal'));
// add weekly update via form
click(`[data-act="nav"][data-v="weekly"]`); click('[data-act="add-update"]'); const f2 = doc.getElementById('mform'); f2.querySelector('[name=progress]').value='did things'; f2.querySelector('[name=next]').value='more'; f2.querySelector('[name=author]').value='AK'; click('[data-act="save-modal"]'); console.log('updates', w.SCT.state.updates.length);
// gantt expand all
click(`[data-act="nav"][data-v="timeline"]`); click('[data-act="gantt-all"][data-open="1"]'); console.log('gantt rows', doc.querySelectorAll('.gantt tbody tr').length);
// reset
click(`[data-act="nav"][data-v="data"]`); click('[data-act="reset"]'); console.log('after reset tasks', w.SCT.state.tasks.length);
console.log('ERRORS:', errors.length ? errors : 'none');
