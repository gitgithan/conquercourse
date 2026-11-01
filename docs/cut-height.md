# Cut height: what it means, and the roof-start change

*Written 2026-11-01 (CC-200). The idea is the product owner's; the measurements are from `scripts/roof-start-compare.ts`.*

## So what
- The cut height now means what a player expects: raise the ground, so shorter buildings sink out of sight and the gaps between roofs grow.
- The old rule broke that idea: the start deck always stood at the cut height, so a high first roof was out of reach at low cuts.
- Starting on the first roof fixes it: the first finished place went from 13 to 28 solvable cut heights out of 30.
- It is behind a switch (`setRoofStart`, off by default) until the full sweep is in.

## How it worked before
- Heights are measured from the cut: `y = height of the ground - cut height`.
- The start deck was always `{x0: -10, x1: 6, top: 0}`, so the player began at the cut height, not on a building.
- The first run was 3 m away at its own relative height, so a first roof higher than about 4.5 m above the cut could not be climbed.
- Ground deeper than the survivable drop below the cut counted as water, a real way to fail.
- Ground shallower than that stayed as walkable floor, so a low cut changed the course in ways nobody could see.
- That is why raising the water level in the Editor could turn "no solution" into "solution".

## The new rule (roof start)
- The start deck stands at the first roof: every height is measured from that roof, and holds move with it.
- Everything below the cut is hidden, strictly (`y < 0` is dropped).
- Water becomes decoration; the fall limit (`LANE_DROP`) still decides what a player can survive.
- A higher cut gradually hides the shorter buildings and widens the gaps between rooftop jumps.
- Still unsolvable when a rise is over about 4.5 m, a gap is over the jump, or a drop is too deep to survive.
- Second step, not built: let the player start from any roof.

## Measurements (partial, sweep still running)
- Method: for each place at its stored shrink, every cut height in 0.5 m steps, proved by the simulator with roof start off and on.
- Ciutadella (Barcelona): solvable at 13 of 30 cut heights off, 28 of 30 on.
- Five more places (Shibuya, Montmartre, Lombard Street, Circular Quay, Edinburgh): at every cut height solvable only with roof start, none the other way round.
- Eixample (Barcelona): 15 cut heights solvable before and lost with roof start.
  - Guess: hiding the low ground removes a step the run used.
  - Not yet checked.
- The full table for all places goes into this file when the sweep ends.

## Where it lives
- `src/slice/slice.ts`: `setRoofStart(on)`, `roofStartOn()`, `sliceProfile`, `laneToCourse`.
- `tests/roof-start.test.ts`: the start deck stands at the roof, and ground below the cut is hidden.
- `scripts/roof-start-compare.ts`: the sweep; run it on a VM, one place per process.

## Next
- Finish the sweep and explain the Eixample losses.
- Wire the switch to a page setting, then to the Slicer and Editor.
- Relabel the Editor slider "Where the water starts (cut height)".
