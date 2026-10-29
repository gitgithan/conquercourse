// CC-149 check helper: hand the body the browser sent to /api/course-clear to the real function, on a real SQLite database with the real migrations.
import { readFileSync } from 'node:fs';
import { onRequestPost } from '../functions/api/course-clear';
import { assets, localD1 } from '../tests/helpers-d1';

const { db, sql } = localD1();
const res = await onRequestPost({ request: new Request('https://x/api/course-clear', { method: 'POST', body: readFileSync(process.argv[2], 'utf8') }), env: { DB: db, ASSETS: assets } as never });
const row = sql.prepare('SELECT course_key, ticks FROM course_clears').get();
console.log(JSON.stringify({ status: res.status, body: await res.json(), row: row ?? null }));
