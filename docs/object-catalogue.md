# Object catalogue: what happens when many players upload photos (CC-218, CC-108, CC-221)

*Owner, 2026-10-30: "What if everyone uploads photos which each becomes obstacles? Can we do a similarity search to suggest that some obstacles already exist? How will obstacles be IDed, and will the IDs be composed into a course?"*

## So what for the game
- Most uploads will be the same few things: a bench, a bin, a wall, a rail.
  - So the catalogue should grow by new kinds of thing, not by new copies.
  - Check for a match before the expensive step, and offer the match first.
- A course keeps pointing at an object by id, so a course never breaks when a copy is merged or a better version appears.
- The cost has a ceiling by design: a daily budget per player and one for the whole game (100 objects or $3).
- Recommendation: build the funnel in section "The funnel" first (it needs no new service), add vector search when the catalogue passes about 2,000 objects.

## Three layers, three kinds of id
| Layer | What it is | Id | Mutable |
|---|---|---|---|
| Photo (`assets`) | the uploaded picture, after privacy masking | its SHA-256 | never |
| Object (`objects`) | the lifted thing: collision proxy, looks (glb), size, role, label | `ob_` + 10 random characters | never; a better version is a new row |
| Placement (`course_objects`) | one object put in one course, with a transform | (`course_hash`, `idx`) | with the course |

- A photo can make several objects (one per box); an object remembers its photo.
- The same photo uploaded twice is one asset (see `docs/data-model.md`, Assets).

## How objects are composed into a course
- The course JSON lists placements: `{ obj: "ob_x7k2m9q4ab", rev: 1, at: [x, y, z], turn, scale }`.
- The simulator only needs the collision proxy (boxes or primitives with a role and a size), which is small.
  - So the proxy is copied into the course JSON (under 1 KB per object) and covered by the course hash.
  - Replay and the ideal-run search never fetch a glb and never depend on the catalogue being reachable.
- The glb (about 380 KB each today: 19 objects take 7.3 MB) is looks only, fetched by id from R2 or the CDN.
- If the glb is missing or hidden, the course still plays with the proxy shown as a plain block.
- `rev` pins the version the course was proved on; a newer revision is offered, never swapped in silently.

## The funnel: how uploads are kept from exploding
1. **Private first.** An upload makes a `user:<id>` object in the player's own browser (as today).
   - Nothing reaches the shared catalogue until the player presses Publish.
2. **Free checks on the Worker, before any GPU:**
   - size, type, box, label and height checks;
   - exact duplicate: SHA-256 of the masked crop;
   - near duplicate: a 64-bit perceptual hash (dHash) of the crop, match when the Hamming distance is 8 or less.
3. **Cheap mask on the small GPU (L4, about 1 s):** SAM 3 mask, person-free check, and an embedding of the masked crop.
4. **Similarity search, still before the expensive lift:** nearest objects by embedding, narrowed by role and size class (height within 25 %).
   - Above the match threshold the player sees: "This looks like *Park bench* (used in 14 courses). Use it?"
   - Use it costs nothing; Make a new one goes on.
5. **The lift (48 GB card, about 2 cents) only for a genuinely new object,** and only inside the budget.
6. **Moderation and a placeable check** (the proxy lands on the ground and can be climbed or vaulted) before Publish is allowed.
7. **Ranking and retirement:** the catalogue sorts by courses that use an object; objects nobody used for 90 days and never published are deleted.

## Savings from scale, turn and mirror
- The catalogue stores one shape and many placements, because a placement already carries a scale and a turn.
  - A 0.8 m bench and a 1.0 m bench are one object placed at two scales; the match ignores size and turn about the vertical axis.
  - The size class in the search is a filter on the placement, not a reason for a second object.
- Mirror: a left-right symmetric object (most benches, bins, bollards, rails) stores half a mesh and a `mirror` flag; a mirrored copy of the same photo is one object.
  - The similarity search compares the embedding of the crop and of its mirror image, and keeps the better score.
- Repeats: a row of bollards or a run of railings is one object with many placements, never many objects.
- Proxy sharing: collision proxies are rounded to 5 cm, so many objects share one proxy shape and one row.
- Measured on the 19 objects now in the game (7.4 MB):
  - Textures are 4.1 MB (55 %) and geometry is 3.3 MB (45 %).
  - Texture first: 1024 pixels down to 512 for small objects, and WebP or KTX2, should roughly halve the textures.
  - Geometry second: mesh compression (meshopt) is lossless to the eye and shrinks the geometry.
  - Half-mesh for symmetric objects adds up to half of the geometry again for those objects.
- Not measured: the real saving of each step; each one is a test on the 19 objects, with a before and after screenshot.
- A merge is never a deletion: the old id becomes an alias, so no course changes.

## Budgets (the owner changes them in one place)
- The whole game spends at most **100 objects or $3 a day, whichever is reached first.**
  - Both count: a lift is about 2 cents, a triage (mask, check, embedding) about half a cent, so refused photos use the dollars too.
  - At 2 cents a lift, 100 objects is about $2, so with triage the object cap usually comes first.
- Per player: 3 objects a day (the owner can change it).
- Per hour: the day is cut into 24 slices of one twenty-fourth (about 4 objects).
- When a limit is reached, the dialog says "Today's makers are used up, try tomorrow" and still offers the catalogue search.
- Every refusal is counted, so the owner sees demand before raising a limit.
- The knobs live in one D1 row `settings(key, value)`, read with a 60 second cache; defaults are in code.
  - The owner changes them with one command, for example `node scripts/upload-limits.mjs set objects 100 usd 3 player 3`.
  - Changing a live D1 row is the owner's action; agents write the script and never run it.
- The day counters are one D1 row per day, bumped with a single conditional update, so two requests cannot both take the last slot.

## Who is a player
- Players are anonymous: no account, name, email, age or phone.
- The limits in Budgets apply per player; how a player is told apart is kept out of the repo.

## Similarity search: what and where
- **Embedding:** a small open image model (DINOv2 or SigLIP, to be chosen by a quick test on the 19 objects plus the 14 hard photos), run on the L4 in the mask step.
  - Licence goes in `docs/ASSETS.md` before use.
- **Store, now:** the embedding as a small blob in D1 or R2 beside the object, with a brute-force search inside the Modal mask function.
  - Fine up to about 2 000 objects (2 000 × 512 numbers is about 4 MB).
- **Store, later:** Cloudflare Vectorize, with the object id as the vector id, and role and size class as filters.
- **Test before trusting:** take each of the 19 objects, upload a second photo of the same kind of thing, and check that it ranks first.
  - Report the hit rate and the false-match rate; a weak result means "not tested", not "failed".
- **Fallback:** the perceptual hash alone catches only near-identical photos; label and size filters alone give a browsable list.

## Tables (added to the plan in `docs/data-model.md`)
- `objects(id, rev, supersedes, asset_id, mesh_sha256, r2_key, label, role, height_m, proxy, source, status, created_by, created_at)`
  - `proxy`: the collision shape as JSON (under 1 KB), the part that goes into a course.
  - `status`: `private-only` never appears here; rows are `pending`, `ok`, `hidden`.
- `object_uses(object_id, course_hash)`: for ranking and for "used in 14 courses".
- `object_alias(from_id, to_id)`: when two objects are found to be the same, the old id redirects; no course changes.
- `uploads(id, player, day, asset_id, outcome)`: the budget ledger, with `outcome` one of `matched`, `new`, `refused`, `rejected`.
- `budgets(day, hour, lifts, dollars)`: one row per hour of each day.
- `settings(key, value)`: the owner's knobs.
- `uploads.player` holds the address key and the cookie id as two hashed columns.
- Indexes: (`role`, `height_m`) for the browse list; (`created_by`, `day`) for the player budget; (`object_id`) on uses.

## What waits for the owner
- Nothing about who the player is (the owner never wants real name, email or age asked).
- Turning on Publish at all (moderation of what the whole world sees is the owner's).

## Known gaps
- No similarity test has run: the embedding model is not chosen and no hit rate exists.
- The glb size per object is a mean of 19 objects; hard photos may be larger.
- The per-player caps live in one Worker's memory today; the D1 counters in Budgets replace them.
