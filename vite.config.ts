import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const build = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })();

export default defineConfig({
  define: { __BUILD__: JSON.stringify(build + ' ' + new Date().toISOString().slice(0, 10)) },
  server: { host: 'localhost', port: Number(process.env.PORT ?? 5173) },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
