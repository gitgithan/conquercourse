# Handover: CC-122
- Ask stage: `npx tsx scripts/bulk-courses-ask.ts 100` on the laptop (key is not on the VMs); a file that already exists is skipped.
- If a reply is empty, delete that file and run again.
- Score stage: `npx tsx scripts/bulk-courses-score.ts` on a VM from a worktree with `npm ci`; takes about 6 minutes; start one copy only.
- Results are in README.md.
