# From a 3D lift to collision objects

*How a lifted photo object gets a collider the physics can trust. Worked example: the monkey bars.*

## The idea
- The lifted mesh is only the **skin**; it is never the collider.
  - A lift is noisy: holes, extra blobs, a squeezed depth, a guessed size, rungs that are thin or fused.
  - Rule from [lessons.md](lessons.md): a photo becomes a skin, never a collider.
- The collider is a **clean primitive built from a few measured numbers**, chosen by the object's role.
- Code: [src/slice/role-collider.ts](../src/slice/role-collider.ts) (pure and deterministic: the same points always give the same numbers).

## The steps
1. **Role.** The maker (or the label) says what the object is: bar, wall, pole or platform.
   - The role decides what is measured: bar = height, span and one spacing; wall = height and width; pole = height and thickness; platform = height and size.
2. **Scale.** The mesh is scaled so its height is the typed height (`knownHeight`), else a typical one for the label (see [pipelines.md](pipelines.md)).
3. **Clean up in 3D** (the 3D cousin of 2D opening and closing):
   - Voxelise the mesh into cells; every triangle is split until its edges are shorter than a cell, so thin rungs are not missed.
   - Keep the largest connected piece (drops floating blobs).
   - Close holes.
4. **Measure** the numbers the role needs (the bars case is below).
5. **Build the primitive** (`RolePrimitive`): a platform, wall or bar with its roles (`stand`, `grab`, `vault`), and keep the measured notes.
6. **Place the skin on the collider**, not the other way round: the skin is shifted so its rungs sit on the collider's rungs (`scripts/make-bars-lift-demo.ts`).
7. **Prove it** with the simulator: the ideal-run search must clear the course made from the collider (`found.cleared`), then the keys are recorded as a demo run.

## Bars: how the evenly spaced rungs are found
- Only the top band of the object is looked at (0.3 m under the highest cell), so legs and posts do not count.
- The long horizontal side is the **axis** the rungs run along.
- Cells in that band are counted per slice along the axis; a rung is a **peak** in that count (smoothed, above the median plus 40% of the way to the maximum).
- Peaks closer than a quarter metre are one rung; the stronger one stays.
- An end post is dropped if its column is much thicker than the typical rung column (a rung is a few layers, a post is many).
- `regulariseRungs` turns the noisy peak places into **one spacing**:
  - Neighbouring gaps are rounded to a whole number of unit gaps (a missed rung gives a double gap, a split rung a half gap); the unit is the median.
  - Each peak gets its whole-number place on the row, then one least-squares line through them gives the spacing and the first rung's place.
  - So rung i sits at `first + i * gap` exactly: the evenly spaced row is a **fit**, not a copy of the mesh.
- The spacing is held inside what the editor allows (`GAP_MIN` 0.3 m, `GAP_MAX` 1.0 m in [src/sim/bars.ts](../src/sim/bars.ts)): a smaller spacing uses every k-th rung, a larger one is capped; the notes say so.
- The rung radius is the median measured radius, held between 2 and 4.5 cm so a hand can close on it.
- The result is a `BarRun {x, y, n, gap}`: first rung's place, height, count, spacing.
  - The Saienji CC0 lift gave 9 rungs, 0.575 m apart, at 2.08 m.

## How the game uses the collider
- The editor's `bars:<rungs>:<gap>` piece and `course.bars` hold the same row, so a hand-built row and a lifted row play identically ([src/slice/bars-world.ts](../src/slice/bars-world.ts)).
- The player grabs the rung height the simulator uses, never the lifted mesh.
- The rules of play on the row are in [bars.md](bars.md).

## What is not covered yet (known gaps)
- Only the bar role measures a repeated structure; walls, poles and platforms use one extent each.
- Rungs of different thickness or a row bent in a curve are not fitted (the fit is a straight line).
- A lift with the wrong size still passes if the typed height is wrong: check the typed height first.
- The other roles' steps are in code but have no worked example here yet.
