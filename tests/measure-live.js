// Live Google Apps Script Endpoint Benchmark Script
// Measures real-world network latency, payload sizes, and server timing.
// Usage: CT_API_URL="https://script.google.com/macros/s/.../exec" node tests/measure-live.js

const url = process.env.CT_API_URL || process.argv[2];

if (!url) {
  console.log('Error: No API URL provided.');
  console.log('Usage: CT_API_URL="https://script.google.com/macros/s/<ID>/exec" node tests/measure-live.js');
  process.exit(1);
}

async function request(action, params = {}, method = 'GET', body = null) {
  const sep = url.includes('?') ? '&' : '?';
  const query = new URLSearchParams({ action, timing: '1', ...params }).toString();
  const target = method === 'GET' ? `${url}${sep}${query}` : url;
  
  const opts = {
    method,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  };
  if (body) {
    opts.body = JSON.stringify({ action, timing: true, ...body });
  }

  const t0 = performance.now();
  const res = await fetch(target, opts);
  const roundtrip = performance.now() - t0;
  const rawText = await res.text();
  let json = null;
  try { json = JSON.parse(rawText); } catch (e) {}

  return {
    status: res.status,
    roundtripMs: roundtrip,
    bytes: Buffer.byteLength(rawText, 'utf8'),
    json
  };
}

async function runLiveBenchmark() {
  console.log('\n====================================================');
  console.log('  LIVE REAL-GOOGLE-SHEET MEASUREMENT BENCHMARK');
  console.log('====================================================');
  console.log('Target URL:', url.slice(0, 50) + '...');

  // 1. PING
  console.log('\n1. Ping (action: "ping")');
  const ping = await request('ping');
  console.log(`   - HTTP Status:        ${ping.status}`);
  console.log(`   - Roundtrip Latency:  ${ping.roundtripMs.toFixed(0)} ms`);
  console.log(`   - Payload Size:       ${(ping.bytes / 1024).toFixed(2)} KB`);
  if (ping.json && ping.json.timing) {
    console.log('   - Server Timings:    ', JSON.stringify(ping.json.timing));
  }

  // 2. VERSION POLL
  console.log('\n2. Version Poll (action: "version")');
  const ver = await request('version');
  console.log(`   - HTTP Status:        ${ver.status}`);
  console.log(`   - Roundtrip Latency:  ${ver.roundtripMs.toFixed(0)} ms`);
  console.log(`   - Payload Size:       ${(ver.bytes / 1024).toFixed(2)} KB`);
  console.log(`   - Version Returned:   ${ver.json ? ver.json.version : 'none'}`);
  if (ver.json && ver.json.timing) {
    console.log('   - Server Timings:    ', JSON.stringify(ver.json.timing));
  }

  // 3. LIGHT PULL
  console.log('\n3. Pull (action: "pull", light: true)');
  const pull = await request('pull', { light: '1' });
  console.log(`   - HTTP Status:        ${pull.status}`);
  console.log(`   - Roundtrip Latency:  ${pull.roundtripMs.toFixed(0)} ms`);
  console.log(`   - Payload Size:       ${(pull.bytes / 1024).toFixed(2)} KB`);
  if (pull.json && pull.json.timing) {
    console.log('   - Server Timings:    ', JSON.stringify(pull.json.timing));
  }

  // 4. SECOND PULL (Cache Hit)
  console.log('\n4. Second Pull (action: "pull", light: true - Cache Hit)');
  const pullCached = await request('pull', { light: '1' });
  console.log(`   - HTTP Status:        ${pullCached.status}`);
  console.log(`   - Roundtrip Latency:  ${pullCached.roundtripMs.toFixed(0)} ms`);
  console.log(`   - Payload Size:       ${(pullCached.bytes / 1024).toFixed(2)} KB`);
  if (pullCached.json && pullCached.json.timing) {
    console.log('   - Server Timings:    ', JSON.stringify(pullCached.json.timing));
  }

  console.log('\n====================================================');
  console.log('  BENCHMARK SUMMARY');
  console.log('====================================================');
  console.log(`Version Check Latency: ${ver.roundtripMs.toFixed(0)} ms`);
  console.log(`Cached Pull Latency:   ${pullCached.roundtripMs.toFixed(0)} ms`);
  console.log('====================================================\n');
}

runLiveBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

