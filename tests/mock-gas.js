// A small in-memory stand-in for Google Sheets and Apps Script, so apps-script/Code.gs
// runs unchanged in Node. Used by the backend tests and the browser journeys.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function chain() { const p = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : p), apply: () => p }); return p; }

class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.maxRows = 1000; this.frozen = 0; }
  getName() { return this.name; }
  getLastRow() { for (let r = this.cells.length - 1; r >= 0; r--) if ((this.cells[r] || []).some(v => v !== '' && v != null)) return r + 1; return 0; }
  getLastColumn() { let m = 0; this.cells.forEach(r => { for (let c = (r || []).length - 1; c >= m; c--) if (r[c] !== '' && r[c] != null) { m = c + 1; break; } }); return m; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  getFrozenRows() { return this.frozen; }
  getMaxColumns() { return 40; }
  getRange(row, col, nr = 1, nc = 1) {
    if (row < 1 || col < 1 || nr < 1 || nc < 1) throw new Error(`Bad range ${row},${col},${nr},${nc}`);
    if (row + nr - 1 > this.maxRows) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
    const sh = this;
    const api = {
      getValues() { const out = []; for (let r = 0; r < nr; r++) { const line = []; for (let c = 0; c < nc; c++) { const v = (sh.cells[row - 1 + r] || [])[col - 1 + c]; line.push(v == null ? '' : v); } out.push(line); } return out; },
      setValues(vals) {
        if (vals.length !== nr || vals[0].length !== nc) throw new Error(`Size mismatch ${vals.length}x${vals[0].length} vs ${nr}x${nc}`);
        vals.forEach(line => line.forEach(v => { if (String(v).length > 50000) throw new Error('Your input contains more than the maximum of 50000 characters in a single cell.'); }));
        vals.forEach((line, r) => { sh.cells[row - 1 + r] = sh.cells[row - 1 + r] || []; line.forEach((v, c) => { sh.cells[row - 1 + r][col - 1 + c] = v; }); });
        return api;
      },
      setValue(v) { sh.cells[row - 1] = sh.cells[row - 1] || []; sh.cells[row - 1][col - 1] = v; return api; },
      clearContent() { for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) if (sh.cells[row - 1 + r]) sh.cells[row - 1 + r][col - 1 + c] = ''; return api; },
      getSheet() { return sh; },
      getA1Notation() { return 'R' + row + 'C' + col; }
    };
    const self = new Proxy(api, { get: (t, k) => (k in t ? t[k] : () => self) });
    return self;
  }
  deleteRow(r) { if (this.maxRows - 1 <= this.frozen) throw new Error('Sorry, it is not possible to delete all non-frozen rows.'); this.cells.splice(r - 1, 1); this.maxRows -= 1; }
  clearContents() { this.cells = []; }
  protect() { return chain(); }
  setFrozenRows(n) { this.frozen = n; } setColumnWidth() {} hideSheet() {} setTabColor() {}
}

class Spreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
  getSheets() { return Object.values(this.sheets); }
  deleteSheet(s) { delete this.sheets[s.getName()]; }
  setActiveSheet() {} moveActiveSheet() {}
  getName() { return 'Test Sheet'; } getId() { return 'x'; } getSpreadsheetTimeZone() { return 'Asia/Kolkata'; }
}

function createBackend(opts = {}) {
  const ss = new Spreadsheet();
  const props = new Map(Object.entries(opts.props || {}));
  const cache = new Map();
  const tokens = opts.tokens || {}; // id token -> Google tokeninfo reply
  const ctx = {
    console, JSON, Date, Math, Object, Array, String, Number, parseInt, parseFloat, isNaN, encodeURIComponent, RegExp,
    SpreadsheetApp: { flush() {}, getActive: () => ss, getUi: () => { throw new Error('no UI'); }, newDataValidation: () => chain() },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v), setProperties: o => Object.entries(o).forEach(([k, v]) => props.set(k, v)) }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: d => d.toISOString().slice(0, 10),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (alg, str) => {
        const hash = crypto.createHash('sha256').update(str, 'utf8').digest();
        return Array.from(hash).map(b => b > 127 ? b - 256 : b);
      }
    },
    UrlFetchApp: { fetch: url => { const t = decodeURIComponent(url.split('id_token=')[1] || ''); const hit = tokens[t]; return { getResponseCode: () => (hit ? 200 : 400), getContentText: () => JSON.stringify(hit || {}) }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    DriveApp: {}, ScriptApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(opts.code || path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  ctx.setupSheet();
  const parse = r => JSON.parse(r.text);
  return {
    ss, props, cache, ctx, tokens,
    get: params => parse(ctx.doGet({ parameter: params })),
    post: body => parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } })),
    load(state) { const r = parse(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'push', force: true, state }) } })); if (!r.ok) throw new Error(r.error); return r; },
    addUser(u) { ss.getSheetByName('Users').getRange(ss.getSheetByName('Users').getLastRow() + 1, 1, 1, 6).setValues([[u.email, u.name, u.role, u.active === false ? 'FALSE' : 'TRUE', 'test', '']]); },
    sessionFor(email) { const id = 'tok-' + email; tokens[id] = { aud: props.get('AUTH_CLIENT_ID'), email, email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }; return parse(ctx.doPost({ postData: { contents: JSON.stringify({ action: 'login', idToken: id }) } })); }
  };
}
module.exports = { createBackend };
