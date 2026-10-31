# Features in the order a player meets them

- Moved here from the root README (CC-208).
- Diagram links point to [docs/meta-ai-pipelines.md](meta-ai-pipelines.md) (called "pipelines" below) unless another file is named.
- "After pull" marks work that was still landing when this was written; if the switch does nothing, pull first.
- Keys: arrows or A/D run, Space jump, S squat, E hold, V vault, X roll, R retry, H key card.
- One key can mean several things by state (S bends, slides, descends, brakes): [input design](input-design.md).

## 1. Play the Course
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Deterministic physics | A runner that moves the same way every time | Always on | [pipelines 7](meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game), [SPEC 8](spec/SPEC.md) |
| Moves: run, jump, hold, vault, climb, roll | Captured vault and climb clips play by default | Keys above; `?clips=0` shows the built poses | [pipelines 2](meta-ai-pipelines.md#2-video-to-motion-sam-3-sam-3d-body-mhr), [motion pipeline](motion-pipeline.md) |
| Generated motion | Run, leap and hang motion from text, shown only after the plausibility check | Always on | [pipelines 3](meta-ai-pipelines.md#3-generated-motion-kimodo-with-a-llama-3-encoder) |
| Obstacles with one saying each | The saying is earned by playing the obstacle; no formula | Always on | [sayings](sayings.md), [stages](stages.md) |
| Ideal run and shortcuts | A ghost line that shows the best way and any shortcut | `I` for one try, `Shift+I` for the whole course; `?bot=ideal` | [pipelines 7](meta-ai-pipelines.md#7-not-ai-but-the-core-of-the-game), [world-slice](world-slice.md#shortcut-discovery-cc-71) |
| Gauges and readable HUD | Bright text on dark panels for speed, time and hints | Always on; `?gauges=old` for the old look | [course design](course-design.md) |
| Touch controls | On-screen buttons on a phone | Automatic; `?touch=1` or `?touch=0` | [onboarding](onboarding.md) |
| First visit help | A short welcome and the Help chip | `?welcome` or `?onboarding` | [onboarding](onboarding.md) |
| Welcome screen with a slow pan over a real 3D world and music (after pull) | A dimmed real place behind the start screen | Opens by default once it lands | [pipelines 6](meta-ai-pipelines.md#6-real-places-and-photos-mapillary-masking) |

## 2. Learn
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Dojo lessons | Four steps: why it matters, try it, the shape, then the exact formula once, at the end | `T` or `?mode=dojo`; `?dojo=old` for the earlier layout | [learning design](learning-design.md) |
| Course picker | Press `T` in the Dojo to pick a course | `T` | [onboarding](onboarding.md) |
| University Labs | Equations are allowed here, nowhere else | On by default; `?labs=0` hides them (the browser remembers it), `?labs=1` brings them back | [university labs](university-labs.md) |
| Course cards with stats | Plays, simulator-verified clears, best verified time, difficulty | Always on; `?stats=0` hides them | [course stats](course-stats.md) |

## 3. Make
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Editor with real objects | 19 real objects (bench, low wall, hydrant and more) to place on a lane | `?mode=editor` | [pipelines 1](meta-ai-pipelines.md#1-photo-to-obstacle-sam-3-and-sam-3d-objects), [editor UI](editor-ui.md) |
| Map and Slicer | Pin a place on Earth; its buildings become a course | `?mode=map` | [pipelines 6](meta-ai-pipelines.md#6-real-places-and-photos-mapillary-masking), [world-slice](world-slice.md#why-a-pin-is-slow-and-the-speed-up-cc-152) |
| Ready places | 18 parks that load at once | In Map mode | [world-slice](world-slice.md#why-a-pin-is-slow-and-the-speed-up-cc-152) |
| Design partner and Fix it | A note on why a course cannot be cleared and one proved change | Editor buttons | [pipelines 4](meta-ai-pipelines.md#4-course-design-partner-muse-spark-open) |
| Editor defaults and Start flag (CC-200) | The Design partner starts hidden (the tab and bar button open it; only a hand choice is remembered), the water level starts at 0 (a saved world keeps its own), and a green Start flag marks where the runner begins in the 3D and side views | On by default | [evidence](evidence/cc-200-editor-defaults/editor-defaults-1280.jpg) |
| Upload check and move tips | An ok, review or block answer; moves that could pass a cut-out | On upload | [pipelines 4b](meta-ai-pipelines.md#4b-upload-check-and-move-tips-muse-spark-open) |
| Generate a course | A course from a seed | `?generate=<seed>` | [world-slice](world-slice.md#course-generator-v1-cc-47) |
| Characters | The Rookie and a second Rookie in the first one's style | Always on | [pipelines 5](meta-ai-pipelines.md#5-characters-muse-image) |
| Starter cast (CC-108) | Eight ready-made characters (Fox, Skater, Toy Robot, Cactus, Banana, Robo Cat, Jelly, Potato Blob) in the Characters picker, fitted to the runner's skeleton at load | On by default; `?cast=0` hides them | [ugc fit](ugc-fit.md) |
| Parts gallery | A page of every move and obstacle, special ones first, each played live in the real game, plus a strip showing how a course is made | On by default (`?mode=parts`, World picker card); `?parts=0` hides the card | [parts gallery](parts-gallery.md) |

## 4. Share
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Challenge link | A link whose keys the simulator replays, so the time cannot be faked | End report, "Copy challenge link"; `?share=0` hides it | [challenge](challenge.md), [viral plan](viral-plan.md) |
| Three-letter tag | An optional tag so a friend sees who to beat; never a real name | The "Tag" box in the end report | [challenge](challenge.md) |
| Clip of a run | A 15 second vertical clip with about 20 m of course in view | End report, "Make a clip"; `?clipshape=wide` for 16:9 | [viral plan](viral-plan.md) |
| Every try can be a clip | The fall panel offers a clip too | After a fall | [viral plan](viral-plan.md) |
| Ghost | Your best run, or a friend's, beside you | `?ghost`; `N` cycles chips | [challenge](challenge.md) |
| Community courses | Finished courses, the first thing in Explore | `?mode=gallery` opens Explore | [world-slice](world-slice.md#the-courses-gallery-cc-89) |
| Communities (CC-247) | Make a wallpaper or a 3D object from a photo: Photo, Segment Region (click the found things you want; several allowed, in a fixed order), Choose, Make N pieces (queued, one run each), a spinning prize screen with Open in the World Editor, and your pieces under My pieces in Add pieces; a stepped progress bar and plain-words limit messages with a try-again time; Share in Community and Delete for your own items | `?mode=communities`, or the Community tab in the top bar | [communities](communities.md) |
| Voice badges and Meet the crew (CC-243) | Every message from the main tech says who is speaking (Simulator, Design partner, Safety check, Cutter, Builder, Character maker, Ghost) with a "powered by" line; a crew strip on the welcome page and in Explore | On by default; `?says=0` hides them | [ui voices](ui-voices.md), [model ledger](model-ledger.md) |
| Top bar (CC-246) | One bar on every page: Courses, World Editor, World Slicer, Community | On by default; `?nav=0` hides it | [communities](communities.md#the-top-bar) |
| End report sections, restart chip (after pull) | Download and Copy first, a restart hint during a run | End of a run | [viral plan](viral-plan.md) |

## 5. Sound and look
| Feature | What the player sees | Turn it on | Diagram or doc |
|---|---|---|---|
| Music | An original loop for each screen | On by default; `M` mutes; `?music=0` | [pipelines 5b](meta-ai-pipelines.md#5b-music-musicgen-from-meta-audiocraft), [music](music.md) |
| Live street photos | Photos along a built place, people masked | In Map mode | [pipelines 6](meta-ai-pipelines.md#6-real-places-and-photos-mapillary-masking) |
| Drone and front view | A fly-over and a side view of the course | `C` camera, `F` front view | [drone](drone.md) |
| Debug view | Why a swing worked | `B` | [world-slice](world-slice.md#debug-view-fix-it-and-the-helper-window-2026-10-28) |

## 6. Under the hood
- The whole system: [pipelines, the whole system](meta-ai-pipelines.md#the-whole-system).
- Recipes with exact settings: [docs/pipelines.md](pipelines.md).
- What did not work: [pipelines, what we tried](meta-ai-pipelines.md#what-we-tried-that-did-not-work).
- Architecture: [SPEC section 8](spec/SPEC.md).
- Tests: [docs/testing.md](testing.md).
- Checks on a submitted clear before and after the server replay: [docs/run-checks.md](run-checks.md).
- Features with no diagram of their own: tag, ghost, gauges, touch controls, drone, debug view; each links to its doc instead.
