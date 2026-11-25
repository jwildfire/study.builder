// Serves _site/ to this machine, for trying the builder: `npm run serve`.
// A plain static server. `--host 0.0.0.0` answers other machines too.

import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../_site');
const flag = (name, otherwise) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? otherwise : process.argv[at + 1];
};
const port = Number(flag('--port', '8650'));
const host = flag('--host', '127.0.0.1');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.R': 'text/plain; charset=utf-8',
  '.tgz': 'application/gzip',
  '.gz': 'application/gzip'
};

http
  .createServer((request, response) => {
    const asked = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    let file = path.join(root, asked);
    // Nothing outside the folder is served.
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404).end('Not found\n');
      return;
    }
    response.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(file).pipe(response);
  })
  .listen(port, host, () => {
    console.log(`study.builder is at http://${host}:${port}/  (Ctrl+C to stop)`);
  });
