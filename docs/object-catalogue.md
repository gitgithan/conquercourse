# Object catalogue: what happens when many players upload photos (CC-218, CC-108, CC-221)

*Owner, 2026-10-30: "What if everyone uploads photos which each becomes obstacles? Can we do a similarity search to suggest that some obstacles already exist? How will obstacles be IDed, and will the IDs be composed into a course?"*

## So what for the game
- Most uploads will be the same few things: a bench, a bin, a wall, a rail.
  - So the catalogue should grow by new kinds of thing, not by new copies.
  - Check for a match before the expensive step, and offer the match first.
- A course keeps pointing at an object by id, so a course never breaks when a copy is merged or a better version appears.
- The cost has a ceiling by design: a daily budget per player and one for the whole game.
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

## Budgets (numbers to tune, not measured yet)
- Per player: 6 lifts per day (the Pages route already allows 6 per 10 minutes per address; the daily cap is new).
- Whole game: a daily lift budget in dollars, set by the owner (10 000 lifts at 2 cents is $200).
- When the budget is spent, the upload dialog says "Today's makers are used up, try tomorrow" and still offers the catalogue search.
- Every refusal is counted, so the owner can see demand before raising a limit.

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
- `budgets(day, lifts, dollars)`: one row per day.
- Indexes: (`role`, `height_m`) for the browse list; (`created_by`, `day`) for the player budget; (`object_id`) on uses.

## What waits for the owner
- The daily dollar budget and the per-player cap.
- Whether a player needs any identity for the per-player cap; today the cap is per address, with no account (the owner never wants real name, email or age asked).
- Turning on Publish at all (moderation of what the whole world sees is the owner's).

## Known gaps
- No similarity test has run: the embedding model is not chosen and no hit rate exists.
- The glb size per object is a mean of 19 objects; hard photos may be larger.
