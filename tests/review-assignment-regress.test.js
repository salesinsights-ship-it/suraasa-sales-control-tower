// Test suite for Review Finding 2: Unsaved work is never sent in next person's name,
// warning toasts, and older unsaved work kept to download.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createBackend } = require('./mock-gas');

function seedState() {
  const src = process.env.FIXTURE ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')).state : null;
  if (src) return JSON.parse(JSON.stringify(src));
  return new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8') + ';return buildSeed();')();
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ' :: ' + e.message]);
    process.exitCode = 1;
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ' :: ' + e.message]);
    process.exitCode = 1;
  }
}

const CLIENT = 'test.apps.googleusercontent.com';
function setupBackend() {
  const b = createBackend({ props: { AUTH_CLIENT_ID: CLIENT, AUTH_REQUIRED: 'true', AUTH_DOMAIN: 'suraasa.com' } });
  b.props.set('AUTH_REQUIRED', 'false');
  b.load(seedState());
  b.props.set('AUTH_REQUIRED', 'true');
  b.addUser({ email: 'admin@suraasa.com', name: 'Admin', role: 'Administrator' });
  b.addUser({ email: 'rahul@suraasa.com', name: 'Rahul Verma', role: 'Employee' });
  return b;
}

function createBrowserEnv(backend, initialStorage = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const toasts = [];
  const listeners = {};

  const fakeElement = (tag = 'div') => ({
    tagName: tag.toUpperCase(),
    hidden: false,
    innerHTML: '',
    textContent: '',
    disabled: false,
    dataset: {},
    focus() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    getAttribute: () => null,
    appendChild: ch => ch,
    remove() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0 })
  });

  const dom = {
    '#main': fakeElement('main'),
    '#signin': fakeElement('div'),
    '#toast': fakeElement('div'),
    '#modal': null,
    '#modal-root': fakeElement('div')
  };

  const windowObj = {
    addEventListener: (ev, fn) => { listeners[ev] = listeners[ev] || []; listeners[ev].push(fn); },
    removeEventListener: () => {},
    location: { hash: '', reload() {}, search: '', href: 'http://localhost/' },
    performance: { now: () => Date.now() },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id)
  };

  const documentObj = {
    hidden: false,
    activeElement: null,
    addEventListener: (ev, fn) => { listeners[ev] = listeners[ev] || []; listeners[ev].push(fn); },
    removeEventListener: () => {},
    querySelector: sel => dom[sel] || (dom[sel] = fakeElement(sel.replace(/^[#.]/, ''))),
    querySelectorAll: () => [],
    createElement: tag => fakeElement(tag),
    body: fakeElement('body'),
    head: fakeElement('head'),
    documentElement: Object.assign(fakeElement('html'), { scrollWidth: 1000 })
  };

  const localStorageObj = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
    clear: () => storage.clear()
  };

  const fetchFn = async (url, opts = {}) => {
    const isPost = opts && opts.method === 'POST';
    if (isPost) {
      const body = JSON.parse(opts.body || '{}');
      return { json: async () => backend.post(body) };
    } else {
      const u = new URL(url, 'http://localhost');
      const action = u.searchParams.get('action') || 'ping';
      return { json: async () => backend.get({ action }) };
    }
  };

  const sandbox = {
    window: windowObj,
    document: documentObj,
    localStorage: localStorageObj,
    sessionStorage: localStorageObj,
    fetch: fetchFn,
    console,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    setTimeout,
    clearTimeout,
    performance: windowObj.performance,
    location: windowObj.location
  };

  vm.createContext(sandbox);

  const engineCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8');
  const seedCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'seed.js'), 'utf8');
  let appCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
  appCode = appCode.replace(/\/\*CONFIG\*\/.*?\/\*END\*\//, JSON.stringify({ apiUrl: 'https://script.google.com/macros/s/test/exec' }));

  // Intercept toast calls to track messages
  appCode = appCode.replace('function toast(msg, err, undo) {', 'function toast(msg, err, undo) { window.__toasts.push({ msg, err }); ');
  sandbox.window.__toasts = toasts;

  vm.runInContext(engineCode, sandbox);
  vm.runInContext(seedCode, sandbox);
  vm.runInContext(appCode, sandbox);

  return { sandbox, storage, toasts, dom };
}

(async () => {
  console.log('\n====================================================');
  console.log('  REVIEW FIX 2: IDENTITY CONFIRMATION & UNSAVED WORK');
  console.log('====================================================\n');

  await testAsync('unsaved work is never sent in the next person\'s name, and they are told', async () => {
    const b = setupBackend();
    const sAdmin = b.sessionFor('admin@suraasa.com').session;
    const sRahul = b.sessionFor('rahul@suraasa.com').session;

    const pullAdmin = b.post({ action: 'pull', session: sAdmin });
    const baseState = JSON.parse(JSON.stringify(pullAdmin.state));
    const modifiedState = JSON.parse(JSON.stringify(pullAdmin.state));
    const initialDesc = modifiedState.tasks[0].desc || '';
    modifiedState.tasks[0].desc = 'Typed by Admin while offline';

    const KEY = 'suraasa_sales_control_tower_v1';
    const BASE_KEY = 'suraasa_sales_control_tower_base';

    const env = createBrowserEnv(b, {
      [KEY]: JSON.stringify(modifiedState),
      [BASE_KEY]: JSON.stringify(baseState),
      'sct_session': sRahul, // Rahul's session is now in localStorage
      'sct_owner': 'admin@suraasa.com' // previous owner on this browser
    });

    const SYNC = env.sandbox.window.SYNC;
    SYNC.init();
    await SYNC.boot();

    // Verify:
    // 1. The unsaved desc was NOT applied to the Sheet
    const sheetDesc = b.ss.getSheetByName('Tasks').getRange(2, b.ctx.schemaFor_('tasks').cols.indexOf('desc') + 1).getValues()[0][0];
    assert.strictEqual(sheetDesc, initialDesc, 'unsaved edit was not sent to Sheet');

    // 2. The active identity is Rahul
    assert.strictEqual(env.sandbox.window.SCT.ME.email, 'rahul@suraasa.com', 'ME is Rahul');

    // 3. User was alerted with toast
    const toastText = env.dom['#toast'].innerHTML + ' ' + env.dom['#toast'].textContent;
    assert.ok(/previous person/.test(toastText) || env.toasts.some(t => /previous person/.test(t.msg)), 'toast notified of discarded changes: ' + toastText);
  });

  await testAsync('older unsaved work before sign-in is not sent, and is kept to download', async () => {
    const b = setupBackend();
    const sAdmin = b.sessionFor('admin@suraasa.com').session;
    const sRahul = b.sessionFor('rahul@suraasa.com').session;
    const pullAdmin = b.post({ action: 'pull', session: sAdmin });

    const baseState = JSON.parse(JSON.stringify(pullAdmin.state));
    const modifiedState = JSON.parse(JSON.stringify(pullAdmin.state));
    modifiedState.tasks[1].desc = 'Typed before sign-in existed';

    const KEY = 'suraasa_sales_control_tower_v1';
    const BASE_KEY = 'suraasa_sales_control_tower_base';

    // No sct_owner in storage (predates sign-in)
    const env = createBrowserEnv(b, {
      [KEY]: JSON.stringify(modifiedState),
      [BASE_KEY]: JSON.stringify(baseState),
      'sct_session': sRahul
    });

    const SYNC = env.sandbox.window.SYNC;
    SYNC.init();
    await SYNC.boot();

    // Verify:
    // 1. Work was not sent
    const sheetDesc = b.ss.getSheetByName('Tasks').getRange(3, b.ctx.schemaFor_('tasks').cols.indexOf('desc') + 1).getValues()[0][0];
    assert.notStrictEqual(sheetDesc, 'Typed before sign-in existed');

    // 2. Work was preserved in sct_browser_copy
    const backup = env.storage.get('sct_browser_copy') || '';
    assert.ok(backup.includes('Typed before sign-in existed'), 'backup copy saved in sct_browser_copy');

    // 3. Toast told the user
    const toastText = env.dom['#toast'].innerHTML + ' ' + env.dom['#toast'].textContent;
    assert.ok(/Older unsaved work/.test(toastText) || env.toasts.some(t => /Older unsaved work/.test(t.msg)), 'told older work kept to download: ' + toastText);
  });

  await testAsync('flush refuses to send before identity confirmation', async () => {
    const b = setupBackend();
    const env = createBrowserEnv(b, {
      'sct_session': 'unconfirmed_session_xyz'
    });

    const SYNC = env.sandbox.window.SYNC;
    SYNC.init();
    assert.strictEqual(SYNC.sessionConfirmed, false, 'session is unconfirmed initially');

    let postCount = 0;
    const origPost = b.post;
    b.post = (body) => { if (body.action === 'apply') postCount++; return origPost(body); };

    await SYNC.flush();
    assert.strictEqual(postCount, 0, 'no apply was dispatched');
  });

  console.log('\nResults:');
  results.forEach(r => console.log(r[0] + ' ' + r[1]));
  console.log(`\n${results.filter(r => r[0] === 'PASS').length} of ${results.length} passed\n`);
  if (results.some(r => r[0] === 'FAIL')) process.exit(1);
  process.exit(0);
})();
