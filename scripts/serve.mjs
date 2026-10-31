import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createAuth } from './auth.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const handleAuth = await createAuth(root, port);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (await handleAuth(req, res, url)) return;
  if (url.pathname !== '/' && url.pathname !== '/index.html' && url.pathname !== '/favicon.svg') {
    res.writeHead(404); res.end('Not found'); return;
  }
  try {
    const filename = url.pathname === '/favicon.svg' ? 'favicon.svg' : 'index.html';
    const data = await fs.readFile(path.join(root, filename));
    const compressed = filename.endsWith('.html') && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const body = compressed ? gzipSync(data) : data;
    res.writeHead(200, { 'Content-Type': filename.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Vary': 'Accept-Encoding', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}), 'Content-Length': body.length });
    res.end(body);
  } catch { res.writeHead(503); res.end('Run npm run build first.'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Style lab ready: http://localhost:${port}`));
