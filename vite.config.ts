import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: 'localhost', port: Number(process.env.PORT ?? 5173) },
  test: { include: ['tests/**/*.test.ts'] },
});
