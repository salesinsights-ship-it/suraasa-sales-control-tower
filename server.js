const http = require('http');
const fs = require('fs');
const path = require('path');
const { createBackend } = require('./tests/mock-gas');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'dist', 'Suraasa_Sales_Control_Tower.html');

// Initialize local mock backend running apps-script/Code.gs
const seed = new Function(fs.readFileSync(path.join(__dirname, 'src', 'seed.js'), 'utf8') + ';return buildSeed();')();
const backend = createBackend({ props: { AUTH_REQUIRED: 'true', AUTH_DOMAIN: 'suraasa.com' } });
backend.props.set('AUTH_REQUIRED', 'false');
backend.load(seed);
backend.props.set('AUTH_REQUIRED', 'true');

// Pre-seed all official accounts with unique, breach-free, memorable passwords
const DEFAULT_ACCOUNTS = [
  // 5 Management Users
  { name: 'Ankit Khanna', email: 'ankit@suraasa.com', password: 'Suraasa@Ankit2026!' },
  { name: 'Manish Pandey', email: 'manish@suraasa.com', password: 'Suraasa@Manish2026!' },
  { name: 'Rishabh Khanna', email: 'rk@suraasa.com', password: 'Suraasa@Rishabh2026!' },
  { name: 'Shrayansh Sood', email: 'shrayansh.sood@suraasa.com', password: 'Suraasa@Shrayansh2026!' },
  { name: 'Divya', email: 'divya@suraasa.com', password: 'Suraasa@Divya2026!' },

  // 7 Regular Employees
  { name: 'Akhand Mishra', email: 'akhand@suraasa.com', password: 'Suraasa@Akhand2026!' },
  { name: 'Atishay', email: 'aj@suraasa.com', password: 'Suraasa@Atishay2026!' },
  { name: 'Sales Operations', email: 'salesinsights@suraasa.com', password: 'Suraasa@SalesOps2026!' },
  { name: 'Somesh Sahoo', email: 'somesh.sahoo@suraasa.com', password: 'Suraasa@Somesh2026!' },
  { name: 'Deepansh Pandey', email: 'deepansh.pandey@suraasa.com', password: 'Suraasa@Deepansh2026!' },
  { name: 'Anisha Ankita Behera', email: 'anisha.behera@suraasa.com', password: 'Suraasa@Anisha2026!' },
  { name: 'Anurakta Sarkar', email: 'anurakta.sarkar@suraasa.com', password: 'Suraasa@Anurakta2026!' }
];

DEFAULT_ACCOUNTS.forEach(acc => {
  backend.post({ action: 'signup', fullName: acc.name, email: acc.email, password: acc.password });
});

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Local API handler for authentication, tasks, sync & RBAC
  if (req.url.startsWith('/api')) {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://localhost:' + PORT);
      const action = u.searchParams.get('action') || 'ping';
      const result = backend.get(action);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          console.log(`[API POST] action=${json.action} email=${json.email || ''}`);
          const result = backend.post(json);
          console.log(`[API POST RESULT] action=${json.action} ok=${result.ok}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error(`[API ERROR] ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }
  }
  
  if (req.url === '/' || req.url === '/index.html' || req.url.startsWith('/?')) {
    fs.readFile(HTML_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error reading dashboard file: ' + err.message);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  const requestedPath = path.join(__dirname, path.normalize(req.url).replace(/^(\.\.[\/\\])+/, ''));
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    const ext = path.extname(requestedPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(requestedPath).pipe(res);
    return;
  }

  // Fallback to control tower HTML
  fs.readFile(HTML_FILE, (err, data) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Control Tower server running at http://localhost:${PORT}/`);
});
