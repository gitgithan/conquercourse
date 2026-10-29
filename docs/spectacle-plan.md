# Spectacle plan: Blender, After Effects, Cinema 4D and free tools for the demo (CC-188)

*Serves the Demo score and the viral post; fits the shot list in [storyboard](storyboard.md) (CC-143) and the rules in [film-craft](film-craft.md) (CC-150).*
*Plan and stills only: no new video is made until the product owner approves the shot list.*

## So what
- Blender is the one worth adding: it is free, it already runs headless on our VMs, and it turned our own course into a lit picture with sky, shadows and depth of field in 50 seconds (see the stills below).
- The in-game effects (bloom, vignette, depth of field behind `?fx=`) are the second one worth doing: they cost almost nothing, and every film shot gets them for free.
- Remotion plus ffmpeg, which we already use, are the third: they do the speed ramps, the wipes, the glow trails and the end card.
- After Effects and Cinema 4D are not worth it in the days left.
  - They are paid, and the product owner would have to buy and learn them.
  - Everything they would do for us has a free route that runs on a VM overnight.
- The honest limit: Blender stills prove the look, but a moving Rookie in Blender needs the Rookie motion imported, and that is a separate, riskier job.
- Recommendation: approve the shot list first, then spend the Blender hours on three moments (the fly-over build-up, the let-go in slow motion, the end card).
- Next step: the product owner picks from the ranked moments in part 2.

## 1. What each tool offers for this game

### Paid tools (assessed only; nothing installed, no account made)
| Tool | What it would do for us | Cost and licence | Verdict |
|---|---|---|---|
| After Effects | Compositing, glow, trackers, speed ramps, motion graphics, text animation | Paid Adobe subscription; price not checked; the owner must decide | Skip: Remotion and ffmpeg cover the same jobs for this film, and nobody here knows it |
| Cinema 4D | Redshift renders, MoGraph (many cloned objects), motion text | Paid Maxon subscription; price not checked; the owner must decide | Skip: Blender does the same 3D jobs for free |

- Both are Windows or Mac desktop programs, so neither runs on the Linux VMs and neither can be queued overnight.
- If the owner already owns After Effects, one job is worth it: a hand-polished end card and title.
  - Even then it is optional, because Remotion renders the same card.

### Free tools that run on our Linux VMs or in code
| Tool | What it offers | Time to useful | Licence | Verdict |
|---|---|---|---|---|
| Blender (headless, `bpy`) | Sky, sun, shadows, materials, depth of field, particles, Cycles on the CPU, glTF in and out | Done: stills work today | GPL program; the pictures we render are ours | Worth it |
| three.js post effects in the game (`?fx=`) | Bloom, vignette, depth of field now; motion blur, speed lines and slow-mo ramps next | Bloom, vignette and DOF done (about 1 hour) | MIT | Worth it |
| Remotion (already in `demo/`) | Cuts on the beat, captions, wipes, glow overlays, end card, speed ramps on clips | Already used | Remotion's own licence; already accepted by the project | Worth it, keep using |
| ffmpeg filters | Speed ramps, blur, glow (blend modes), colour grade, frame blending | Minutes per effect | LGPL or GPL build | Use inside the Remotion pipeline |
| DaVinci Resolve (free) | Colour grade, trackers, a good timeline for the owner to cut by hand | A day to learn | Free edition, proprietary; the owner accepts the licence | Only if the owner wants to cut by hand |
| Natron | Node compositing like After Effects | A day or more; project looks quiet | GPL | Skip: slower than Remotion for us |
| Kdenlive | A free timeline editor | Hours | GPL | Skip: Remotion is already the editor |

- Blender's glTF route: our script `scripts/export-gltf.ts` turns a course file into a `.glb`, and Blender imports it with the Rookie model beside it.
- Rookie motion in Blender is possible, because the motion files are glTF-style clips, but it is not tested here.
  - The stills use the Rookie in its bind pose (arms out), and say so.

## 2. Ranked spectacle moments

Ranking uses wow, fit with the story ("real world to browser to real world") and the odds that it is done by 2026-11-04 9 PM ET.
Hours are for one person; "needs first" means what must be true in the game before the moment can be made.

| Rank | Moment | Tool | Hours | Risk | Needs first |
|---|---|---|---|---|---|
| 1 | The let-go in slow motion with a light trail behind the hands | In-game (three.js trail plus bloom), capture on the stepped clock, ramp already built (`--ramp`) | 4 to 6 | Low | A trail mesh behind the hand joint; bloom is done |
| 2 | Real-park fly-over that turns into the course, with a shimmer as the blocks rise | In-game (blocks scale up with a glow edge), Remotion cross-fade from the photo | 6 to 8 | Medium | The hero shot (`?film=hero`) works; a build-up animation for the blocks does not exist |
| 3 | The end card: the course in a Blender sunset with the Rookie and the slogan | Blender stills plus Remotion title | 3 to 4 | Low | The shot list is approved; the Rookie pose is chosen |
| 4 | "Real world to browser to real world" wipe: photo, game, back to a real photo | Remotion (mask wipe) | 3 | Low | One real park photo and one matching game frame at the same angle |
| 5 | The ghost race with glowing trails (You green, Ghost amber) | In-game (trail on both runners) plus bloom | 4 to 6 | Medium | The ghost and the report colours are done; trails are not |
| 6 | The park photo breaks into 3D pieces that fly into place | Blender particles or in-game instancing | 10 to 14 | High | A clean mask per piece from SAM 3 and a piece mesh for each |
| 7 | A Blender hero fly-over of the whole course with depth of field | Blender, one camera path, Cycles on a VM | 8 to 12 (render overnight) | Medium | Course look in Blender matches the game; a moving camera still needs a render of about 30 frames per second of film |
| 8 | Speed lines and a screen shake on the landing | In-game | 2 to 3 | Low | The landing event exists in the film path; keep shake small and off for the slow motion |

- Rank 1 and 2 are the strongest because they show the two ideas the whole game rests on: the let-go carries the speed on, and a real place becomes a course.
- Rank 6 is the biggest wow and the biggest risk; do not start it before ranks 1 to 4 are done.
- Craft check from [film-craft](film-craft.md): every moment keeps one idea per shot and a camera move with a cause.
  - A light trail is on the hands only, so the let-go stays readable.
  - No moment uses a formula, a weapon or a robot look.

## 3. Prototype stills (this branch)

- What was built:
  - `scripts/export-gltf.ts` writes a `.glb` from any course file (decks, warped wall, rope, planks, holds, a hazard slab).
  - `pipelines/spectacle/render_stills.py` renders three stills in headless Blender 5.0.1 (the `bpy` Python package), Cycles on the CPU, a physical sky, a low sun, depth of field and denoising.
  - `src/render/fx.ts` adds `?fx=bloom,vignette,dof` (or `all`) to the course page; without the switch nothing changes and the code is not even loaded.
  - `scripts/fx-stills.mjs` takes the in-game stills on a VM.
- Where: `data/eval/cc-spectacle/` (inputs, outputs, `run.json`, README with the side-by-side).
- Blender stills, 1280 by 720, 48 samples: 50, 50 and 32 seconds each on an 8-core VM, no GPU.
- Quality, plainly:
  - The sky, the long shadows and the depth of field on the Rookie close-up already look like a different league from the in-game picture.
  - The colours are washed out and pink because the sun is low and the materials are plain; a real material pass would take another half day.
  - The black face on the warped wall is a defect of our export (a face pointing the wrong way); it is the first thing to fix.
  - The Rookie is in its bind pose, so these are look tests, not film frames.
- In-game stills: see the README for what bloom, vignette and depth of field changed.

## 4. Recommended pipeline, in three steps

1. Capture in the game (VM, stepped clock): every shot is a frame-exact capture with `?fx=` on; slow motion with `--ramp`.
2. Beauty passes in Blender (VM, overnight): export the course with `scripts/export-gltf.ts`, render the 3 to 5 hero stills or a short fly-over at 128 samples; queued with `scripts/spectacle-queue.sh`.
3. Cut in Remotion: music beats, wipes, trails as overlays, captions, end card; the 85 percent real-capture rule in the spec still holds, and Blender frames are tagged GFX.

- Overnight on the VMs (no owner needed): step 2 and the stills of step 1; see `data/eval/cc-spectacle/HANDOVER.md`.
- Needs the product owner:
  - Approval of the shot list (nothing moving is made before that).
  - A yes or no on buying After Effects or Cinema 4D (this plan says no).
  - Which three moments from part 2 to build.
- Costs: Blender and Remotion are free; the VM time is covered by the existing credit; nothing here uses Modal or any GPU.

## What is not verified
- No moving Blender shot was made, so the cost of a fly-over (frames, hours) is an estimate from the stills.
- Rookie motion import into Blender is untested.
- The paid-tool prices and the exact Adobe or Maxon licence terms were not checked.
- DaVinci Resolve, Natron and Kdenlive were not installed or tried; their lines are from general knowledge.
- The in-game effects were captured on a software GPU (SwiftShader); how they look and run on a real GPU, and the frame cost, are unmeasured.
- The Blender GPL point (our rendered pictures are ours) is the common reading of the Blender licence, not legal advice.
