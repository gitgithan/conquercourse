# CC-75 performance: before and after

- before.json and after.json: best of two runs of scripts/perf-check.mjs on the same machine (software GPU), per scene.
- before-run*.json and after-run*.json: the two raw runs each.
- before = the overlay-only commit; after = decks merged, loose pieces merged and chunked, photo objects instanced, shared materials.
- Draw calls and triangles are exact; render times are relative (software GPU, a busy shared machine).
- The six scenes: Montmartre, San Francisco hill, coaster, stacks, and two synthetic courses made by the script (300 loose pieces with 30 benches and 12 stacks; one mesh of 3,000 buildings).
