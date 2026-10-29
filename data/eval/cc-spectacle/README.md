# CC-188 spectacle stills: Blender against in-game effects

- What this is: look tests for the demo, stills only, no video.
- Course used: `public/assets/demo/training.course.json` ("Training course: every move").

## So what
- Blender gives a clearly richer picture (sky, soft sun, shadows, real depth of field) for about 1 minute a still on a CPU VM.
- The in-game effects are cheap and safe, and bloom and vignette already help; depth of field needs a better focus rule before it is used on film.
- Recommendation: use Blender for the end card and one or two hero stills, and use the in-game effects on every captured shot.

## Inputs
- `inputs/training.glb`: the course exported by `scripts/export-gltf.ts` (338 triangles, 8 materials).
- The Rookie: `public/assets/characters/rookie-a.glb`, in its bind pose (arms out).

## Blender stills (outputs/1-wall-golden.png, 2-rope-wide.png, 3-lache-closeup.png)
- Command: `python pipelines/spectacle/render_stills.py training.glb rookie-a.glb out 48` in a Python 3.11 venv with `bpy` 5.0.1.
- Engine: Cycles on 8 CPU cores, 48 samples, denoised, 1280 by 720.
- Time: 50, 50 and 32 seconds (`outputs/render-info.json`).
- What works: physical sky, long shadows, depth of field on the close-up, the lava slab glowing orange at the edges.
- What is wrong:
  - the warped wall has a black face (a face pointing the wrong way in the export);
  - the colours are washed out and pink (low sun, plain materials);
  - the Rookie is tiny in the wide stills and not holding the bar in the close-up.

## In-game stills (outputs/a-*, b-*, c-*)
- Switch: `?fx=bloom,vignette,dof` or `?fx=all` (code in `src/render/fx.ts`, loaded only when the switch is on).
- Command: `node scripts/fx-stills.mjs <dir>` on a VM with a software GPU; 19 to 23 seconds a still without effects, 42 to 45 with depth of field.
- Bloom and vignette: a small lift of bright edges and darker corners; subtle on the flat colours of the course.
- Depth of field: blurs the whole picture in the fly-over and the wall push, because the focus is set to the runner, who is far from the camera in those shots.
- The compositions (stepped-clock film shots at fixed times) are not curated; judge the effect, not the framing.
- The "Looking ahead" inset is not touched by the effects.

## Quality against cost
| | Blender (Cycles, CPU) | In-game `?fx=` |
|---|---|---|
| Look | Highest: sky, shadows, real depth of field | Modest: bloom, vignette, blur |
| Time per still | about 1 minute at 48 samples | about 20 to 45 seconds on a software GPU |
| Moving shots | Slow: a frame a minute, so 30 s of film is over 15 hours on one VM | Free: it is the game, captured on the stepped clock |
| Fits our real-capture rule | No: tagged GFX | Yes: still real capture |
| Setup cost | Done, plus about half a day to fix materials and the wall | Done; focus rule needs 1 to 2 hours |

## Not verified
- Real-GPU look and speed of the in-game effects.
- Moving Blender shots and the Rookie in motion.
- Whether the half-day material pass reaches film quality.
