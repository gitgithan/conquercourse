
## Two answers that changed on purpose

- **Fix it and the advice for the tall wall:** with the old clock budget (1.5 s) the advice found nothing on this machine, because the first proof alone used the budget; Fix it then shrank the wall.
  - With the tick budget (which starts after the first proof) the advice finds "Slide the low box 0.3 m back", and the simulator confirms it clears.
  - `tests/golden/search.json` holds the new hashes for these two; every other answer matches the old search.
