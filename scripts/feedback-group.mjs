// Groups the new feedback card's rows (round quick-1) by kind and by screen, and writes plain Markdown for the team.
// Pure functions: rows look like { ts, session, build, mode, answers, context } with answers and context already parsed.
// Old-form rows (any other round) are counted apart and never break the page.
export const KIND_ORDER = ['broke', 'confusing', 'idea', 'loved'];
const KIND_TITLE = { broke: 'Something broke', confusing: 'Something was confusing', idea: 'Ideas', loved: 'Loved' };

export function groupQuick(rows) {
  const quick = rows.filter((r) => r.round === 'quick-1' || (r.answers && r.answers.kind !== undefined));
  const byKind = Object.fromEntries(KIND_ORDER.map((k) => [k, []]));
  const noKind = [];
  for (const r of quick) (byKind[r.answers.kind] ?? noKind).push(r);
  const screens = {};
  for (const r of quick) {
    const s = r.context?.screen || r.mode || 'unknown';
    const g = (screens[s] ??= { notes: 0, ratings: [], clearYes: 0, clearNo: 0, why: {} });
    g.notes++;
    if (typeof r.answers.rating === 'number') g.ratings.push(r.answers.rating);
    if (r.answers.clear === 'yes') g.clearYes++;
    if (r.answers.clear === 'no') { g.clearNo++; if (r.answers.why) g.why[r.answers.why] = (g.why[r.answers.why] ?? 0) + 1; }
  }
  return { total: quick.length, old: rows.length - quick.length, byKind, noKind, screens };
}

export function renderQuick(rows) {
  const g = groupQuick(rows);
  const L = [`# Feedback cards`, '', `- ${g.total} notes from the new card; ${g.old} rows from older forms are not shown here.`, ''];
  for (const k of KIND_ORDER) {
    L.push(`## ${KIND_TITLE[k]} (${g.byKind[k].length})`);
    for (const r of g.byKind[k]) L.push(`- ${r.answers.where ?? r.context?.screen ?? r.mode}: ${(r.answers.text ?? '(no words)').replace(/\n/g, ' ')} [${r.build}]`);
    L.push('');
  }
  if (g.noKind.length) L.push(`## No kind chosen (${g.noKind.length})`, ...g.noKind.map((r) => `- ${r.answers.where ?? r.mode}: ${(r.answers.text ?? '').replace(/\n/g, ' ')}`), '');
  L.push('## By screen');
  for (const [s, v] of Object.entries(g.screens).sort((a, b) => b[1].notes - a[1].notes)) {
    const avg = v.ratings.length ? (v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length).toFixed(1) : 'none';
    const why = Object.entries(v.why).map(([w, n]) => `${w} ${n}`).join(', ');
    L.push(`- ${s}: ${v.notes} notes; rating ${avg} (${v.ratings.length}); clear yes ${v.clearYes}, not really ${v.clearNo}${why ? ` (${why})` : ''}`);
  }
  return L.join('\n') + '\n';
}
