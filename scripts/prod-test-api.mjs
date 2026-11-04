// CC-133: GET status table for every read route; usage: node scripts/prod-test-api.mjs <base> (read-only, GET only)
const base = process.argv[2];
const routes = ['turnstile-key','leaderboard','leaderboard?course=training&hash=x&window=all','leaderboard?recent=1','course-stats','daily-stats','world-stats','places?q=shibuya','places?lat=35.659&lon=139.700',
  'photos?lat=35.6595&lon=139.7005&r=60','features?lat=35.6595&lon=139.7005&r=150','community','community?list=1','community-items','community-items?q=','challenge-course?list=1','challenge-course?id=nope','leaderboard-run?id=nope',
  'admin-usage','character','community-image','community-report','course-clear','course-agent','course-event','design-partner','designer','funnel-event','moderate','move-tips','object-lift','segment','submit','share/nope'];
for (const r of routes) {
  try { const res = await fetch(`${base}/api/${r}`, { signal: AbortSignal.timeout(30000) }); const t = (await res.text()).slice(0, 90).replace(/\s+/g, ' ');
    console.log(`| ${r} | ${res.status} | ${t.replace(/\|/g, '/')} |`); } catch (e) { console.log(`| ${r} | ERR | ${e.message} |`); }
}
