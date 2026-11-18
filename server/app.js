import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Forge, httpError } from './forge.js';
import { spiritStatus } from './spirits.js';
import { dataDir } from './config.js';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

export function createServer(cfg) {
  const forge = new Forge(cfg, dataDir());
  const clients = new Set();

  forge.on('update', (msg) => {
    const data = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of clients) res.write(data);
  });

  const state = () => ({
    config: {
      default_tool: cfg.default_tool,
      reverence: cfg.reverence,
      wrap_prompt: cfg.wrap_prompt,
      incense: cfg.incense,
      cwd: cfg.cwd,
      configFile: cfg.configFile,
    },
    spirits: spiritStatus(cfg),
    sessions: forge.list(),
    running: [...forge.running.keys()],
  });

  const routes = [
    ['GET', /^\/api\/state$/, () => state()],
    ['POST', /^\/api\/sessions$/, (_, body) => forge.create(body)],
    ['PATCH', /^\/api\/sessions\/([\w-]+)$/, ([id], body) => forge.update(id, body)],
    ['DELETE', /^\/api\/sessions\/([\w-]+)$/, ([id]) => (forge.remove(id), { ok: true })],
    ['POST', /^\/api\/sessions\/([\w-]+)\/petition$/, ([id], body) => forge.petition(id, body?.text)],
    ['POST', /^\/api\/sessions\/([\w-]+)\/abort$/, ([id]) => ({ ok: forge.abort(id) })],
  ];

  const allowedHosts = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname.startsWith('/api/')) {
        // The forge spawns processes: refuse DNS-rebinding and cross-site requests.
        if (!allowedHosts.has(req.headers.host)) throw httpError(403, 'Unknown host — the Noosphere is sealed');
        if (req.method !== 'GET' && req.headers['x-omnissiah'] !== 'praise') throw httpError(403, 'Missing sacred header');

        if (req.method === 'GET' && url.pathname === '/api/events') return sse(req, res);

        for (const [method, re, handler] of routes) {
          const m = url.pathname.match(re);
          if (!m || method !== req.method) continue;
          const body = method === 'GET' ? null : await readJson(req);
          return json(res, 200, await handler(m.slice(1), body));
        }
        throw httpError(404, 'No such rite');
      }
      return serveStatic(url.pathname, res);
    } catch (err) {
      json(res, err.status || 500, { error: err.message });
    }
  });

  function sse(req, res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
  }

  server.on('listening', () => {
    const { port } = server.address();
    for (const h of ['127.0.0.1', 'localhost', '[::1]']) allowedHosts.add(`${h}:${port}`);
  });

  const close = () => {
    forge.shutdown();
    for (const res of clients) res.end();
    server.close();
  };

  return { server, forge, close };
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (d) => {
      raw += d;
      if (raw.length > 2_000_000) reject(httpError(413, 'Petition too vast'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(httpError(400, 'Malformed binary cant'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(pathname, res) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) throw httpError(403, 'Forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'content-type': 'text/plain' });
    return res.end('The web cogitator is not built. Run `npm run build` first.');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(file).pipe(res);
}
