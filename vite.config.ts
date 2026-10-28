import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { defineConfig, type Plugin } from 'vite';
import { askSpark, limited, MAX_BODY } from './functions/api/designer';
import { askPhoto, MAX_PHOTO_BODY } from './functions/api/photo-course';
import { lookup } from './functions/api/places';

const build = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })();

// Dev only: serves /api/designer on this machine with the key read from a private file (never sent to the page); silent if the file is absent.
const designerDev = (): Plugin => ({
  name: 'designer-dev',
  configureServer(server) {
    let key = '';
    try { key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '') ?? ''; } catch { /* no key here */ }
    if (!key) return;
    server.middlewares.use('/api/photo-course', (req, res) => {
      const send = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
      if (req.method !== 'POST') return send(405, { error: 'POST only' });
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > MAX_PHOTO_BODY + 200) req.destroy(); });
      req.on('end', async () => {
        try {
          if (limited('photo:dev', Date.now(), 30)) return send(429, { error: 'slow down a little' });
          const r = await askPhoto(key, JSON.parse(raw));
          send(r.status, r.body);
        } catch { send(502, { error: 'the photo helper is unavailable' }); }
      });
    });
    server.middlewares.use('/api/designer', (req, res) => {
      const send = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
      if (req.method !== 'POST') return send(405, { error: 'POST only' });
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > MAX_BODY) req.destroy(); });
      req.on('end', async () => {
        try {
          if (limited('dev')) return send(429, { error: 'slow down a little' });
          const r = await askSpark(key, JSON.parse(raw));
          send(r.status, r.body);
        } catch { send(502, { error: 'the designer is unavailable' }); }
      });
    });
  },
});

// Dev only: /api/places on this machine (the same lookup as the Pages Function), with the answers kept on disk so a restart keeps them.
const placesDev = (): Plugin => ({
  name: 'places-dev',
  configureServer(server) {
    const dir = 'node_modules/.cache/cc-places';
    const file = (k: string) => `${dir}/${k.replace(/[^\d.,-]/g, '_')}.json`;
    const store = {
      async get(k: string) { try { return existsSync(file(k)) ? readFileSync(file(k), 'utf8') : null; } catch { return null; } },
      async put(k: string, v: string) { try { mkdirSync(dir, { recursive: true }); writeFileSync(file(k), v); } catch { /* no disk cache */ } },
    };
    server.middlewares.use('/api/places', async (req, res) => {
      const u = new URL(req.url ?? '/', 'http://localhost');
      const r = await lookup(u.searchParams, 'dev', store);
      res.statusCode = r.status; res.setHeader('content-type', 'application/json');
      for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
      res.end(JSON.stringify(r.body));
    });
  },
});

export default defineConfig({
  plugins: [designerDev(), placesDev()],
  define: { __BUILD__: JSON.stringify(build + ' ' + new Date().toISOString().slice(0, 10)) },
  server: { host: 'localhost', port: Number(process.env.PORT ?? 5173) },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
