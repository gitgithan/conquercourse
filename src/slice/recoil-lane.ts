import type { CourseData } from '../course/course';
import { DEFAULT_RECOIL } from '../sim/recoil';

// A lane with a launcher (CC-66): a pad on the start deck clips it on, and K fires it. The editor keeps the lane as it is and calls this on the course it makes,
// so the proof and the Play button see the launcher too. The knobs are the ball's mass and its speed leaving the launcher.
export interface RecoilCfg { kind: 'cannon' | 'crate'; ballMass: number; muzzle: number }

export function withRecoil(c: CourseData, cfg: RecoilCfg): CourseData {
  const p0 = c.terrain.platforms.find((p) => p.x0 <= c.startX + 0.01 && p.x1 > c.startX);
  if (!p0) return c;
  const x0 = Math.round((c.startX + 1.5) * 100) / 100, x1 = Math.round(Math.min(c.startX + 4, p0.x1 - 0.5) * 100) / 100;
  if (x1 - x0 < 1) return c; // no room for a pad on the start deck
  const { plan: _plan, ...keep } = c;
  void _plan; // a stored line was found without the launcher
  return { ...keep, recoil: { ...DEFAULT_RECOIL, x0, x1, kind: cfg.kind, ballMass: cfg.ballMass, muzzle: cfg.muzzle } };
}
