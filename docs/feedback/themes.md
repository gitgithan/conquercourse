# Feedback themes (CC-124)

Serves the product owner's question: what do players keep telling us, grouped, so the backlog follows the pattern and not the loudest voice.

## So what
- Most notes are about the same few places: the Dojo, landing feedback, controls and the HUD, and session flow.
- The strongest single cluster is the Dojo (lessons and finding it); 4 of 5 public players did not know it was there.
- Only 5 public submissions exist so far; rounds 1 to 6 are the product owner's own playtest items.
- So these are themes to watch, not proof of what players want.
- Next step: re-run this when 20 or more public answers arrive (`npx tsx scripts/feedback-cluster.ts <public-answers.json> 2`).

## How it was made
- Items: 70 (round files in `docs/feedback/` plus 7 paraphrased public notes; a line with several ids stays one item).
- Model: Muse Spark Open on Baseten, temperature 0.3, two runs.
- Both runs gave 12 themes; every item was placed exactly once and no id was invented.
- The model split 4 combined lines into their separate ids; that is fine, no item is lost.
- Inputs and both outputs: `data/eval/cc-124-feedback-clusters/`.
- Cost: about $0.02 per run.

## Themes (run 1, largest first)
### Dojo lessons (12)
- Ids: R1-T1, R1-T2, R1-T3, R1-G4, R2-G4, R2-D2, R2-D5, R4-D3, R4-D4, R5-D1, R5-D2, P5-dojo
- Example (R1-T1): "every obstacle has a six-step lesson (why, try it, the shape, a rule of thumb, the exact formula, on the Course)."

### Landing feedback (10)
- Ids: R1-N1, R1-N1', R1-V1, R2-G6, R2-G7, R4-D1, R4-D2, R5-D3, R5-D4, P3-again
- Example (R1-N1): "landing shows "Soft landing" or "Hard landing" with the push in times the runner's weight, and the capsule squashes; the full picture needs the Rookie (CC-16)."

### Run and jump pacing (8)
- Ids: R1-G2, R2-G3, R2-G5, R2-D1, R2-G1, R2-G2, R4-G3, P4-confusing
- Example (R1-G2): "too slow"

### Controls and HUD (7)
- Ids: R1-G3, R5-G2, R5-G6, R5-G7, R5-G13, P1-confusing, P2-confusing
- Example (R1-G3): "speed visible"

### Session flow and scoring (7)
- Ids: R1-G1, R3-Q1, R3-G3, R3-G4, R5-F1, P3-confusing, P4-again
- Example (R1-G1): "wall teleport"

### Trampoline cues (6)
- Ids: R3-G1, R3-G2, R5-G4, R5-G5, R5-G5b, R5-G8
- Example (R3-G1): "the trampoline"

### Wall climb (6)
- Ids: R1-W1, R1-W2, R5-S1, R5-G10, R5-G11, R5-G12
- Example (R1-W1): "the climb height comes from energy only, and the wall is drawn as an orange curve."

### Rope swing (6)
- Ids: R1-P1, R1-P2, R2-G8, R2-V1, R2-D3, R2-D4
- Example (R1-P1): ""Length above the grip", and the rope question is now "How far across will you land after you let go?"."

### Standing pose (5)
- Ids: R4-G2, R5-G1, R5-G1b, R5-G1c, R5-G1d
- Example (R4-G2): "the standing pose is now an upright frame (head level, arms down, feet together), picked by scoring every frame of the shipped clips."

### General praise (3)
- Ids: R1-OK1, R1-OK2, R1-OK3
- Example (R1-OK1): "the basic mechanics feel good."

### Camera views (3)
- Ids: R4-G1, R5-G3, R5-G9
- Example (R4-G1): "C cycles side, 45 degrees and first person."

### Dev setup (1)
- Ids: R1-X1
- Example (R1-X1): "the agent works in its own git worktree."

## Checks
- Each id appears once; unknown ids: none.
- Public notes are paraphrased, with no personal information.
