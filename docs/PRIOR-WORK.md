# Prior work: what existed before this repo, and what is new

*For the judges of the Meta Global AI Developer Hackathon (2026-10-26 to 2026-11-04), whose rules say the demo may show only work built during the event and that new work must be distinguishable.*
*Draft v0.1, 2026-10-27; updated whenever something from outside the event is used.*

## In one paragraph
- Before the event, the product owner ran a private practice project (an earlier physics-game prototype, 2026-10-21 to 2026-10-25) to learn game design, the tools and the models.
- This repository starts empty on 2026-10-27; no code, data or asset from the practice project is copied into it.
- What carries over is knowledge: lessons, measured numbers and design ideas, written fresh into the spec and the lessons doc.
- Everything in this repo was written or generated during the event, or is third-party material used under its licence and listed below.

## What came from before the event (knowledge only)
- **Design ideas:** a physics obstacle game that teaches by prediction and testing; no formulas on screen; timing windows measured by the simulator; nudges after a miss instead of tables.
- **Measured facts:** how the sprint, braking, rope catch and landing models behave; how many motion clips an obstacle needs (one mid-speed clip time-warped covers 3-7 m/s within 4 cm); motion-model quirks (for example, Kimodo's constraints act through joint rotations).
- **Engineering lessons:** one clock for game time; joint-name lists must match array lengths; a plausibility check before any motion is shown; headless browser testing of WebGPU; true-speed filming with a stepped clock (`docs/lessons.md`).
- **None of the practice project's code is used;** this repo's code is written from `docs/spec/SPEC.md` during the event.

## Third-party material (used under its licence)
- **Motion capture:** CMU Graphics Lab Motion Capture Database (free to use, credit requested); re-imported here with new code.
- **Footage:** Pexels clips downloaded by hand under the Pexels licence (creators credited in `docs/ASSETS.md`); Wikimedia Commons and public-domain clips, each with its licence.
- **Models and tools:**
  - Meta: Muse Spark, Muse Image, SAM 3.1 (Meta Model API); Muse Glimmer or Muse Spark Open on partner hosting; SAM 3D Body and SAM 3D Objects (open weights, on Modal).
  - NVIDIA Kimodo and the SOMA skeleton (NVIDIA Open Model License); Tripo (character generation).
  - three.js, Rapier, Vite and other open-source libraries, under their licences.

## How the code is written
- The product owner sets requirements and reviews; AI coding agents (Claude Code) write most of the code, each change tied to an issue in the `conquercourse` Linear project.
- Every commit is dated in this repo's history, which starts on 2026-10-27.

## Muse Spark Open (Baseten, hackathon key)
- **Used for:** the course-design partner in the World editor (`functions/api/designer.ts`, `src/slice/designer.ts`); new work in this project.
- **Model and key:** the hackathon key works only with `meta-models/muse-spark-open-1026` (other models answer 403); it always reasons first, so calls leave room (`max_tokens` 4000) and its reasoning text is never shown.
- **Rule kept:** it suggests moves, the simulator checks them; it never grades a player.
