const fs = require('fs');
const path = require('path');

const parts = [
  'src/shell_head.html',
  'src/styles.css',
  'src/shell_mid.html',
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

const bundle = contents.join('\n');

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

console.log('Build successful!');
console.log('  -> dist/Suraasa_Sales_Control_Tower.html');
console.log('  -> dist/index.html');
console.log('  -> index.html');

