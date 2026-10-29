import type { CourseData } from '../course/course';
import { searchIdealRun } from '../sim/ideal';
import { withRecoil, type RecoilCfg } from './recoil-lane';

// Fix it for a launcher (CC-66): the smallest change to the ball that makes the lane clearable. A faster ball is tried first (the push grows in a straight line with
// its speed); only when the fastest launcher is still not enough does the ball get heavier. The simulator's own proof decides: a setting is good only if the ideal run clears with it.
export interface RecoilFix { ok: boolean; cfg: RecoilCfg; steps: string[] }

export function fixRecoil(c: CourseData, cfg: RecoilCfg): RecoilFix {
  const clears = (k: RecoilCfg) => searchIdealRun(withRecoil(c, k)).cleared;
  if (clears(cfg)) return { ok: true, cfg, steps: [] };
  const speedMax = cfg.kind === 'bigcannon' ? 60 : 40, massMax = cfg.kind === 'bigcannon' ? 120 : 40; // the angle is the player's to aim: the proof searches it
  for (let m = cfg.ballMass; m <= massMax; m = Math.round(m * 1.25 + 1)) {
    if (!clears({ ...cfg, ballMass: m, muzzle: speedMax })) continue;
    let lo = Math.min(cfg.muzzle, speedMax), hi = speedMax; // hi clears
    for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (clears({ ...cfg, ballMass: m, muzzle: mid })) hi = mid; else lo = mid; }
    const to = { ...cfg, ballMass: m, muzzle: Math.ceil(hi) };
    return { ok: true, cfg: to, steps: [`Use a ${to.ballMass} kg ball thrown at ${to.muzzle} m/s (it was ${cfg.ballMass} kg at ${cfg.muzzle} m/s).`] };
  }
  return { ok: false, cfg, steps: ['Even the heaviest, fastest launcher does not clear this lane. Make the gap narrower or the far side lower.'] };
}
