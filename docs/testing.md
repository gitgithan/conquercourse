# Testing: which command to run

- `npm run test:changed` runs only the tests that import something you changed since `origin/main`.
  - Changes under `public/assets/demo` also run the demo and plan tests.
  - Changes under `public/assets/places` or `experiments` also run the place and photo tests.
  - Use it while working, before every commit.
- `npm run test:fast` runs everything except the files listed in `tests/slow.json`.
  - These are the files that took more than about 25 s on the VM in the 2026-10-29 baseline.
- `npm run test:slow` runs only those files, with a 180 s timeout per test.
  - Run it on a VM before a merge that touches `src/sim`, `src/slice` or the generator.
- `npm run test:quick` still runs everything with the 60 s timeout (this is what `scripts/ship.sh` runs unless `SKIP_QUICK=1`).
- Every command prints the 10 slowest test files at the end.
- Move a file into `tests/slow.json` when it takes more than about 25 s; move it out when it gets faster.
- Run tests on a VM, not the laptop (the laptop is for playtesting).
- Tests that fail under load but pass alone live in `tests/slow.json`, where the timeout is longer.
