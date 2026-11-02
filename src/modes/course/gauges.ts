import type { CourseData } from '../../course/course';
import { DEFAULT_WALL } from '../../sim/wall';
import { droneParams } from '../../sim/world';
import type { createHud } from './hud';
import type { CourseCtx } from './context';

const GAUGE_MAX = 10;

type Hud = ReturnType<typeof createHud>;

// What the speed gauge, the drone battery and the time line show for this picture.
export function createGaugeUpdate(ctx: CourseCtx, hud: Pick<Hud, 'speedGauge' | 'batteryGauge' | 'hud'>, zoneOf: (x: number) => { id: string } | undefined) {
  const { course, st, specs, wallNeed } = ctx;
  const { speedGauge, batteryGauge } = hud;
  return (r: { x: number; vx: number; tick: number }) => {
    const onCoaster = st.world.mode === 'cart' && st.world.cart !== null;
    const spd = onCoaster ? Math.abs(st.world.cart!.v) : Math.abs(r.vx);
    const gaugeMax = onCoaster ? 40 : GAUGE_MAX;
    const nextGap = specs.find((g) => g.x + 0.2 >= r.x && g.x - r.x < 40 && ['gap', 'landing'].includes(zoneOf(g.x)?.id ?? ''));
    let need = 0, msgNext = '';
    if (nextGap && st.world.mode === 'run') { need = nextGap.needed; msgNext = `Next gap: ${nextGap.width.toFixed(1)} m wide. You need at least ${need.toFixed(1)} m/s at the edge.`; }
    else if (course.wall && st.world.mode === 'run' && r.x < course.wall.x0 && course.wall.x0 - r.x < 45) { need = wallNeed; msgNext = `Warped wall: ${(course.wall.height ?? DEFAULT_WALL.height).toFixed(1)} m high. You need at least ${need.toFixed(1)} m/s at its foot.`; }
    speedGauge.set({ text: `${onCoaster ? 'Speed along track' : 'Speed'} ${spd.toFixed(1)} m/s`, max: gaugeMax, value: spd, mark: need, colour: need && spd < need ? '#c4572a' : '#0f6b5c', note: msgNext });
    if (batteryGauge) { // before boarding there is no drone state yet: the battery is full
      const full = droneParams(course as CourseData).battery * 3600;
      const left = st.world.drone ? (st.world.drone.empty ? 0 : Math.max(0, Math.min(1, st.world.drone.energy / full))) : 1;
      const pct = Math.round(100 * left);
      batteryGauge.set({ text: st.world.drone?.empty ? 'Drone battery empty' : `Drone battery ${pct}%`, max: 1, value: left, colour: pct <= 20 ? '#c4572a' : '#2a6fb0' });
    }
    hud.hud.textContent = `Time ${(r.tick / 120).toFixed(1)} s   ·   ${Math.max(0, Math.round(r.x))} m of ${course.finishX} m`;
  };
}
