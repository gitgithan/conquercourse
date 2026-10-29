# CC-161: shortcut and roll on the Training course

- Serves the demo of the shortcut feature in the ideal run on "Training course: every move".
- The rope is untouched (anchor 90, 6.6, length 9).

## What changed (decks and bars after the lache pair only)

- The far deck starts at x 74 (was 71.8) and its top is 2 m down (was 0).
- Both lache bars are 0.5 m higher (3.4, was 2.9), which gives the swing a bigger drop.
- Why both: a 2 m drop alone made the shortcut land at 7.9 m/s, still a clean squat; the higher bars lift it to 9.2 m/s.
- A deck start before 73 lets a plain jump clear the gap, which would kill the lache lesson; 74 does not.

## The two lines

| Line | Ticks | Seconds | Landing speed | Squat clean? | Roll needed? | Stiff landing if not rolled |
|---|---|---|---|---|---|---|
| Shortcut: pump on bar 1, fly past bar 2 (the ideal run) | 3233 | 26.9 | 9.2 m/s | no (limit about 8.5) | yes | about 92 m/s² (hurt above 80) |
| Bar to bar | 3387 | 28.2 | 8.2 m/s | yes, but close to the limit | yes (above 90 % of the clean limit) | about 82 m/s² (hurt above 80) |

- The shortcut saves 1.28 s (the stored shortcut `skip-bar-2`).
- Both lines are clearable and both roll after the lache pair.
- The final roll at the end stays (9.9 m/s), and the rope landing is a plain squat.
- Picture: `two-lines.png`.

## How the line was found

- The whole-course search on VM2 (224 s) stored a slower plan (3486 ticks) for this course, because the roll after the lache pair confuses its stage-by-stage choices.
- `scripts/training-line.ts` searches the two lines through the lache pair on the plan of the other obstacles and stores the faster one, with both routes and the shortcut list.
- Run it after `scripts/make-training-course.ts` and `scripts/plans.ts`.

## Known gaps

- The bar-to-bar drop is a roll by the rule (more than 90 % of the squat limit), not a broken run: a squat there would still land clean at 8.2 m/s.
- The whole-course search itself does not find the shortcut line on this course; the helper script does.
- Not played in a browser.
