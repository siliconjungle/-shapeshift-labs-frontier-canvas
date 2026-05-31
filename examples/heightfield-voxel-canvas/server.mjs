import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');
const exampleRoot = __dirname;
const runtimeRoot = path.join(exampleRoot, '.runtime');
const currentStatePath = path.join(runtimeRoot, 'heightfield-current-state.json');
const args = new Set(process.argv.slice(2));
const smoke = args.has('--smoke');
const port = readPort(process.env.PORT ?? '4191');

if (smoke) {
  for (const file of [
    path.join(exampleRoot, 'index.html'),
    path.join(exampleRoot, 'src/main.js'),
    path.join(exampleRoot, 'src/mesh.js'),
    path.join(exampleRoot, 'src/styles.css'),
    path.join(exampleRoot, 'assets/grey-blob-mask.png'),
    path.join(exampleRoot, 'assets/grey-blob-mask-curvy.png'),
    path.join(exampleRoot, 'assets/tiles/dcaf8693-48b4-4396-b08c-a5be48d6339d.png'),
    path.join(exampleRoot, 'assets/tiles/87fd8ddb-3344-47f8-971b-584175c48448.png'),
    path.join(exampleRoot, 'assets/tiles/cce6eac8-ba93-4456-9986-b53d670c1515.png'),
    path.join(repoRoot, 'packages/frontier/dist/index.js'),
    path.join(repoRoot, 'packages/frontier/dist/clone.js'),
    path.join(repoRoot, 'packages/frontier-canvas/dist/index.js'),
    path.join(repoRoot, 'packages/frontier-canvas-tools/dist/index.js'),
    path.join(repoRoot, 'packages/frontier-tools/dist/index.js')
  ]) {
    if (!fs.existsSync(file)) throw new Error('missing demo dependency: ' + path.relative(repoRoot, file));
  }
  console.log('heightfield voxel canvas demo smoke passed');
  process.exit(0);
}

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
    if (url.pathname === '/__frontier/heightfield-state') {
      handleCurrentState(request, response);
      return;
    }
    const file = resolveRequest(url.pathname);
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': contentType(file),
      'cache-control': 'no-store'
    });
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error && error.stack ? error.stack : String(error));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Frontier heightfield voxel canvas: http://127.0.0.1:${port}`);
});

function resolveRequest(pathname) {
  const clean = decodeURIComponent(pathname);
  if (clean === '/' || clean === '/index.html') return path.join(exampleRoot, 'index.html');
  if (clean.startsWith('/src/')) return safeJoin(exampleRoot, clean.slice(1));
  if (clean.startsWith('/assets/')) return safeJoin(exampleRoot, clean.slice(1));
  if (clean.startsWith('/packages/')) return safeJoin(repoRoot, clean.slice(1));
  return null;
}

function safeJoin(root, requestPath) {
  const file = path.resolve(root, requestPath);
  if (!file.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.json') || file.endsWith('.map')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function handleCurrentState(request, response) {
  if (request.method === 'GET') {
    if (!fs.existsSync(currentStatePath)) {
      response.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: false, error: 'no current heightfield state has been published' }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(currentStatePath).pipe(response);
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, POST' });
    response.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
    return;
  }
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 8 * 1024 * 1024) request.destroy(new Error('state payload too large'));
  });
  request.on('end', () => {
    try {
      const parsed = JSON.parse(body || '{}');
      const payload = {
        ok: true,
        updatedAt: new Date().toISOString(),
        state: parsed.state || parsed
      };
      fs.mkdirSync(runtimeRoot, { recursive: true });
      fs.writeFileSync(currentStatePath, JSON.stringify(payload, null, 2));
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, updatedAt: payload.updatedAt }));
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    }
  });
  request.on('error', (error) => {
    response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
  });
}

function readPort(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error('invalid PORT: ' + value);
  return number;
}
