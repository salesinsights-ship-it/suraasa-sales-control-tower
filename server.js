const http = require('http');
const fs = require('fs');
const path = require('path');

const distCandidates = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'suraasa-control-tower', 'dist'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'suraasa-control-tower', 'dist')
];
const distDir = distCandidates.find(d => fs.existsSync(d) && fs.existsSync(path.join(d, 'index.html')));

if (!distDir) {
  console.error('Error: Could not find dist directory with index.html. Run build first.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(path.join(distDir, reqPath));
  if (!safePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(distDir, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(safePath).pipe(res);
  });
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

function start(port) {
  server.listen(port, () => {
    console.log(`\n========================================`);
    console.log(`  Suraasa Control Tower is running!`);
    console.log(`  Local URL: http://localhost:${port}`);
    console.log(`  Serving:   ${distDir}`);
    console.log(`========================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      start(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

start(DEFAULT_PORT);

