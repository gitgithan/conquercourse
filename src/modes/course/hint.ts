// The one line of help under the picture: controls are taught while you play, one short hint at a time, then none.
// It reads the world, the run log and what the player has already done; it changes nothing but its own cue timer for the trampoline.
import { approachToast } from '../../ui/approach-toast';
import type { Drum } from '../../sim/drums';
import { droneParams, recoilParams, type WorldState } from '../../sim/world';
import { energyWords, isAimable, shotEnergy } from '../../sim/recoil';
import { weight } from '../../sim/drone';
import { canReach } from '../../sim/bars';
import { climbAhead } from '../../sim/climb';
import { bandParams, stretchAt } from '../../sim/band';
import { predictBand, predictLaunch, predictRelease, type Prediction } from '../../sim/predict';
import type { CourseCtx } from './context';

export interface HintDeps { toastDrums: () => Drum[]; shotPreview: (w: WorldState) => Prediction | null }

export function createHint(ctx: CourseCtx, deps: HintDeps): (w: WorldState) => string {
  const toastDrumsNow = deps.toastDrums, shotPreview = deps.shotPreview;
  let cueSince: number | null = null, cueDone = false;
  return function hintFor(w: WorldState): string {
    const { course, st, log, specs } = ctx;
    const r = w.runner;
    if (course.pole && w.outcome === 'running') { // the pole vault (CC-239): one plain line for each step
      const pw = w.pole, ps = course.pole;
      if (w.mode === 'pole') return pw?.ride?.result ? '' : 'Hold E: the pole bends and gives your speed back. Let go at the top.';
      if (w.mode === 'run' && r.x < ps.barX) {
        if (!pw?.carrying) return r.x < ps.pickX + 1.5 ? 'Hold E at the pole to pick it up, then run' : '';
        return r.x < ps.x0 ? 'Run fast. Hold E in the orange box to plant the pole.' : '';
      }
    }
    if (w.mode === 'bars' && w.bars && course.bars?.[w.bars.run]) { // the monkey bars: say which key is due, and when the swing allows it
      const b = w.bars, row = course.bars[b.run], next = b.last === 1 ? 2 : 1;
      if (b.l >= row.n - 1 && b.r >= row.n - 1) return 'Last rung: let go of E to fly off';
      return canReach(row, b, next).ok ? `Press ${next === 1 ? 'Q (left hand)' : 'T (right hand)'} now` : `Swing forward with → and ←, then ${next === 1 ? 'Q (left hand)' : 'T (right hand)'}. Hold E to stay on.`;
    }
    if (course.bars?.length && w.mode === 'run' && w.outcome === 'running') { const nb = course.bars.find((q) => q.x + q.n * q.gap > r.x && q.x - r.x < 8); if (nb) return 'Monkey bars: jump and hold E to grab a rung. Then alternate Q (left hand), T (right hand) as you swing.'; }
    if (w.mode === 'plank') return 'The plank dips under you: it gives most in the middle. Keep running.';
    if (course.planks?.length && w.mode === 'run' && w.outcome === 'running') { const pk = course.planks.find((q, i) => !w.broken?.includes(i) && q.x0 - w.runner.x > 0 && q.x0 - w.runner.x < 8); if (pk) return 'A plank bridge: run across it. A plank bends under your weight, most in the middle.'; }
    if (w.mode === 'cart') return w.cart?.started ? 'Height is speed. Hold ↓ to brake before a sharp hilltop.' : 'Press → to push off';
    if (w.mode === 'bounce') { cueDone = true; return ''; }
    // the trampoline cue comes early and stays for 4 seconds (or until you land on the bed), so it can be read before the bounce
    const bed = course.terrain.platforms.find((q2) => q2.bouncy && r.x < q2.x1);
    if (!bed || bed.x0 - r.x > 14 || w.outcome !== 'running') { cueSince = null; cueDone = false; } // far from the bed, or restarted: the cue starts over
    if (bed && !cueDone && w.mode === 'run' && w.outcome === 'running' && !(course.rope && r.x < course.rope.anchorX + 1) && // not while the rope is still ahead: it only flashed for a moment there
       (bed.x0 - r.x < 14 || (cueSince !== null && r.tick - cueSince < 480))) {
      cueSince ??= r.tick;
      return 'Trampoline ahead: press Space the moment you land on it for extra height';
    }
    if (w.mode === 'band') { // the elastic band: stretch it by running away from the post, then turn round
      const s = stretchAt(bandParams(course), w.runner.x);
      if (s < 0.5 && w.band!.maxStretch < 0.5) return 'Hold ← to run away from the post and stretch the band. Then turn round (hold →): it throws you forward.';
      const pb = predictBand(w, course);
      return pb.result === 'lands' ? `TURN NOW (hold →): ${pb.why}` : `Stretched ${s.toFixed(0)} m: ${pb.why}`;
    }
    if (course.drone && w.mode === 'run' && !w.runner.grounded) return '';
    if (course.drone && w.mode === 'run' && w.runner.grounded && w.runner.x < course.drone.x0 && w.runner.x > course.startX - 20 && !log.some((e) => e.type === 'drone-board')) return 'Run onto the teal pad, then hold E to board the cargo drone.';
    if (course.drone && w.mode === 'run' && w.runner.grounded && w.runner.x >= course.drone.x0 && w.runner.x <= course.drone.x1 && !log.some((e) => e.type === 'drone-board')) return 'Hold E to board the drone.';
    if (w.mode === 'drone' && w.drone) {
      const dp = droneParams(course), pct = Math.round((100 * w.drone.energy) / (dp.battery * 3600));
      const state = w.drone.empty ? 'Battery empty: the rotors have stopped.' : `Battery ${pct}% · push ${(w.drone.thrust / 1000).toFixed(1)} kN (hover ${(weight(dp) / 1000).toFixed(1)} kN) · speed ${Math.abs(w.drone.vx).toFixed(1)} m/s`;
      return `${state}\n← → lean · ↑ ↓ climb or come down · hold E to stay on`;
    }
    if (course.recoil && w.mode === 'run') { // the launcher: clip it on at the pad, then fire it (on the ground, or in the air to add to a jump)
      if (w.recoil && w.recoil.armed > 0 && isAimable(recoilParams(course))) {
        const rp = recoilParams(course), deg = Math.round(((w.recoil.aim ?? rp.angle) * 180) / Math.PI), pr = shotPreview(w);
        return `Cannon loaded: aim ${deg}° (↑ ↓ tilt the barrel), then press K. The tank holds ${energyWords(shotEnergy(rp))}.${pr ? ' ' + pr.why : ''}`;
      }
      if (w.recoil && w.recoil.armed > 0) return 'Launcher on: press K to fire. The ball flies back and pushes you forward. Fire in the air to add to a jump.';
      if (!w.recoil || w.recoil.fired === 0) return 'Run onto the teal pad to clip the launcher on.';
    }
    if (w.mode === 'launch') {
      if (!w.launch?.fired) return 'Hold → to pull the pin. Then press Space to let the rider go.';
      const pl = predictLaunch(w, course); // the same look ahead as the debug view: where would you come down if you let go this instant?
      return pl.result === 'lands' ? `LET GO NOW (Space): ${pl.why}` : `Wait for it: ${pl.why}`;
    }
    if (w.mode === 'swing') return 'Hold E to hold on. Let go of E while you are still rising';
    if (w.mode === 'hang') {
      // a push cue (the way the body is swinging) and a let-go cue from the simulator's own look ahead
      const fwd = (w.hang?.omega ?? 0) >= 0, rel = predictRelease(w, course);
      return `${fwd ? 'Push →' : 'Push ←'} with the swing (hold E)  ·  ${rel.result === 'lands' && /reach the .* bar|ground/.test(rel.why) ? 'LET GO NOW: ' + rel.why : 'keep swinging: ' + rel.why}`;
    }
    if (course.holds?.length && w.mode === 'run' && !r.grounded) { const next = course.holds.find((h) => h.x > r.x - 0.5); if (next && Math.abs(next.x - r.x) < 2.5) return 'Hold E to grab the bar'; }
    if (w.mode === 'climb') return 'Keep holding E: the arms pull you up';
    { const ca = w.mode === 'run' ? climbAhead(course.terrain, r.x, r.y, 2.5, course.jumpSpeed) : null; if (ca) return ca.standing ? 'A tall wall: hold E at the wall to grab the edge and climb' : 'A very tall wall: jump and hold E at the top of the jump'; }
    { const at = w.mode === 'run' && r.tick >= 60 && toastDrumsNow().length ? approachToast(course, toastDrumsNow(), r.x) : null; if (at && at.kind !== 'bounce' && !(at.kind === 'jump' && (ctx.everCleared || st.falls > 0))) return at.text; }
    if (ctx.everCleared || st.falls > 0) return '';
    if (r.tick < 60 || (r.x < 4 && r.tick < 600)) return 'Hold → to run';
    const g = specs.find((q2) => q2.x + 0.2 >= r.x && q2.x - r.x < 6);
    if (g && r.grounded) return 'Press Space just before the edge to jump';
    return '';
  }
}
