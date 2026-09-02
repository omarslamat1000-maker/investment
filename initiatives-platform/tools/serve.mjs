// خادم تطوير محلي بسيط — بلا اعتمادات خارجية
// الاستخدام: node tools/serve.mjs [منفذ] — الافتراضي 8210
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
// المنفذ: وسيط سطر الأوامر ← متغير البيئة PORT ← 8210
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8210;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    if (path.endsWith('/')) path += 'index.html';
    const filePath = normalize(join(ROOT, path));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      const notFound = await readFile(join(ROOT, '404.html')).catch(() => null);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(notFound || 'Not Found');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err.message));
  }
});

server.listen(PORT, () => {
  console.log(`منصة المبادرات تعمل محليًا: http://localhost:${PORT}/`);
});
