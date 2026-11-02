import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((request, response) => {
  let url;
  try { url = new URL(request.url, 'http://localhost'); } catch { response.writeHead(400).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  if (!existsSync(target) || !statSync(target).isFile()) { response.writeHead(404).end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (request.method === 'HEAD') response.end(); else createReadStream(target).pipe(response);
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`Cimi Work prototype: http://127.0.0.1:${port}\n`));
process.on('SIGINT', () => server.close());
