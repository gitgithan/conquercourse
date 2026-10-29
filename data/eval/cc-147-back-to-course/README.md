# World editor: Back to the Course (CC-147)

## So what
- The button worked in every case except one: the simulator could not prove the lane clears.
- Then it stayed in the editor and wrote the reason only into the Design partner panel, which may be closed, so it looked broken.
- Fix: Back to the Course and the T key never wait for the simulator and never refuse.
- "Apply and try it" still refuses an unclearable lane, and the refusal now opens the Design partner panel.

## Check
- Script: scripts/back-links-check.mjs (run on a Vultr VM, software graphics).
- Before the fix: backWhenUnclearable false (see before.log).
- After the fix: every case true (see after.log).
- Not tested: the "Apply and try it" refusal, because the check found no proposal to apply.

## Files
- before.log, after.log, and the screenshots of the Course after each Back click.
