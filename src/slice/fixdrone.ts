import type { CourseData } from '../course/course';
import { searchIdealRun } from '../sim/ideal';
import { withDrone, type DroneCfg } from './drone-lane';

// Fix it for a drone (CC-87): the smallest change that makes the lane clearable. A bigger battery is tried first (nothing else about the flight changes);
// only when the biggest battery is still not enough does the rider get lighter. The simulator's own proof decides: a setting is good only if the ideal run clears with it.
export interface DroneFix { ok: boolean; cfg: DroneCfg; steps: string[] }

export function fixDrone(c: CourseData, cfg: DroneCfg, range?: { x0: number; x1: number }): DroneFix {
  const clears = (k: DroneCfg) => searchIdealRun(withDrone(c, k, range)).cleared;
  if (clears(cfg)) return { ok: true, cfg, steps: [] };
  const maxWh = 1000;
  for (let pay = cfg.payload; pay >= 30; pay -= 20) {
    if (!clears({ payload: pay, battery: maxWh })) continue; // even the biggest battery does not clear it at this weight
    let lo = pay === cfg.payload ? cfg.battery : 10, hi = maxWh; // hi clears
    for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (clears({ payload: pay, battery: mid })) hi = mid; else lo = mid; }
    const to = { payload: pay, battery: Math.ceil(hi / 10) * 10 };
    const steps = pay === cfg.payload
      ? [`Use a ${to.battery} Wh battery (it was ${cfg.battery} Wh).`]
      : [`Use a ${to.battery} Wh battery and a rider of ${to.payload} kg or less (the battery was ${cfg.battery} Wh and the rider ${cfg.payload} kg).`];
    return { ok: true, cfg: to, steps };
  }
  return { ok: false, cfg, steps: ['Even a big battery and a light rider do not clear this lane. Make the gap narrower or the far side lower.'] };
}
