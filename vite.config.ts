import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { defineConfig, type Plugin } from 'vite';
import { askSpark, limited, MAX_BODY } from './functions/api/designer';

const build = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })();

// Dev only: serves /api/designer on this machine with the key read from a private file (never sent to the page); silent if the file is absent.
const designerDev = (): Plugin => ({
  name: 'designer-dev',
  configureServer(server) {
    let key = '';
    try { key = /^BASETEN_API_KEY=(.+)$/m.exec(readFileSync(`${homedir()}/.config/ninja/baseten.env`, 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '') ?? ''; } catch { /* no key here */ }
    if (!key) return;
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

export default defineConfig({
  plugins: [designerDev()],
  define: { __BUILD__: JSON.stringify(build + ' ' + new Date().toISOString().slice(0, 10)) },
  server: { host: 'localhost', port: Number(process.env.PORT ?? 5173) },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
