const fs = require('fs');
const path = require('path');

// The Apps Script web app the site talks to. Set CT_API_URL in Vercel to point a preview at a test Sheet.
// This is an address, not a secret: the script itself refuses anyone without a Google sign-in.
const API_URL = process.env.CT_API_URL || 'https://script.google.com/macros/s/AKfycbxHM02G-PRe0xrkGvMaOej0Fq-uU_pX8AW1EnoTfGGL3bqsmA-fm2Kdz9j8XGUu81Km/exec';
const parts = [
  'src/shell_head.html',
  'src/styles.css',
  'src/shell_mid.html',
  'src/engine.js',
  'src/seed.js',
  'src/app.js',
  'src/shell_tail.html'
];

console.log('Concatenating source files...');
const contents = parts.map(p => {
  const fullPath = path.join(__dirname, p);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
});

// The published page holds no business data: projects, owners, risks and decisions
// come from the Sheet after sign-in. src/seed.js stays in the repo for tests.
const seed = new Function(contents[parts.indexOf('src/seed.js')] + ';return buildSeed();')();
const shell = {
  meta: { app: seed.meta.app, schema: seed.meta.schema, version: 1, sync: seed.meta.sync },
  roles: [], programs: [], projects: [], tasks: [], risks: [], dependencies: [], decisions: [], updates: [], actions: [], activity: [],
  governance: { cadence: {}, rag: {}, classification: [] }, options: seed.options
};
contents[parts.indexOf('src/seed.js')] = 'function buildSeed() { const s = ' + JSON.stringify(shell) + '; s.meta.seeded = s.meta.savedAt = new Date().toISOString(); return s; }';

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets/logo', f)).toString('base64');
contents[parts.indexOf('src/app.js')] = contents[parts.indexOf('src/app.js')].replace(/\/\*CONFIG\*\/.*?\/\*END\*\//, JSON.stringify({ apiUrl: API_URL }));
const bundle = contents.join('\n')
  .replace(/\{\{LOGO_LIGHT\}\}/g, b64('suraasa-logo-light-bg.png'))
  .replace(/\{\{LOGO_DARK\}\}/g, b64('suraasa-logo-dark-bg.png'));

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Write dist/Suraasa_Sales_Control_Tower.html
fs.writeFileSync(path.join(distDir, 'Suraasa_Sales_Control_Tower.html'), bundle, 'utf8');

// 2. Write dist/index.html (standard dist output)
fs.writeFileSync(path.join(distDir, 'index.html'), bundle, 'utf8');

// 3. Write root index.html (fallback for static hosts that deploy root directory)
fs.writeFileSync(path.join(__dirname, 'index.html'), bundle, 'utf8');

// 4. Favicons and app icons are served from the site root
const pub = path.join(__dirname, 'assets/public');
fs.readdirSync(pub).forEach(f => fs.copyFileSync(path.join(pub, f), path.join(distDir, f)));

console.log('Build successful!');
console.log('  -> dist/Suraasa_Sales_Control_Tower.html');
console.log('  -> dist/index.html');
console.log('  -> index.html');

