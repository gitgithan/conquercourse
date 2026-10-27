// Labelled Dojo diagrams (CC-31): one "real" drawing and one "principle" picture per obstacle, as inline SVG strings.
// Original art, drawn in code; words only, no formulas.
export type DiagramId = 'gap' | 'wall' | 'rope' | 'trampoline' | 'landing';
export type DiagramKind = 'real' | 'principle';
export const DIAGRAM_IDS: DiagramId[] = ['gap', 'wall', 'rope', 'trampoline', 'landing'];

const INK = '#1f2937', SPEED = '#2563eb', FORCE = '#dc2626', GRAV = '#d97706', ENERGY = '#16a34a', GROUND = '#9ca3af', SOFT = '#e5e7eb';
type P = [number, number];

let uid = 0;
const f = (n: number) => Math.round(n * 10) / 10;

function txt(x: number, y: number, s: string, o: { color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean } = {}): string {
  const lines = s.split('\n');
  const tspans = lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : (o.size ?? 15) * 1.2}">${l}</tspan>`).join('');
  return `<text x="${x}" y="${y}" font-size="${o.size ?? 15}" fill="${o.color ?? INK}" text-anchor="${o.anchor ?? 'middle'}"${o.bold ? ' font-weight="700"' : ''}>${tspans}</text>`;
}

function arrow(a: P, b: P, color: string, w = 4, dash = ''): string {
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#ah-${color.slice(1)})"/>`;
}

const line = (a: P, b: P, color = INK, w = 3, dash = '') => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const poly = (pts: P[], color = INK, w = 4) => `<polyline points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// A stick figure: a head, a back line, arms and legs given as lines of points.
function fig(o: { head: P; neck: P; hip: P; arms: P[][]; legs: P[][]; color?: string; ghost?: boolean }): string {
  const c = o.color ?? INK;
  const g = o.ghost ? ' opacity="0.35"' : '';
  const r = 12;
  const d = [o.neck[0] - o.head[0], o.neck[1] - o.head[1]];
  const m = Math.hypot(d[0], d[1]) || 1;
  const top: P = [o.neck[0] - (d[0] / m) * 2, o.neck[1] - (d[1] / m) * 2];
  return `<g${g}><circle cx="${o.head[0]}" cy="${o.head[1]}" r="${r}" fill="#fff" stroke="${c}" stroke-width="4"/>` +
    poly([top, o.hip], c, 5) + o.arms.map((a) => poly([o.neck, ...a], c, 4)).join('') + o.legs.map((l) => poly([o.hip, ...l], c, 5)).join('') + '</g>';
}

const wrap = (title: string, body: string) => {
  const n = ++uid;
  const marks = [SPEED, FORCE, GRAV, ENERGY, INK].map((c) =>
    `<marker id="ah-${c.slice(1)}-${n}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
  const b = body.replace(/url\(#ah-([0-9a-f]{6})\)/g, `url(#ah-$1-${n})`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 440" width="100%" style="max-width:100%;height:auto" font-family="system-ui, Arial, sans-serif" role="img" aria-label="${title}"><defs>${marks}</defs><rect width="760" height="440" fill="#fff"/>` +
    txt(380, 32, title, { size: 20, bold: true }) + b + '</svg>';
};

// A bar made of a track and a fill, for the energy pictures. Fills grow upward from the base.
function bar(x: number, base: number, full: number, frac: number, color: string, w = 44): string {
  const h = Math.max(2, full * frac);
  return `<rect x="${x}" y="${base - full}" width="${w}" height="${full}" fill="${SOFT}" rx="4"/><rect x="${x}" y="${f(base - h)}" width="${w}" height="${f(h)}" fill="${color}" rx="4"/>`;
}

function gapReal(): string {
  const body =
    `<rect x="0" y="300" width="250" height="140" fill="${SOFT}"/><rect x="510" y="300" width="250" height="140" fill="${SOFT}"/>` +
    line([0, 300], [250, 300], GROUND, 5) + line([510, 300], [760, 300], GROUND, 5) +
    `<path d="M240,290 Q380,40 520,290" fill="none" stroke="${SPEED}" stroke-width="3" stroke-dasharray="9 7"/>` +
    fig({ head: [214, 214], neck: [219, 232], hip: [200, 268], arms: [[[240, 250], [255, 232]], [[205, 252], [188, 232]]], legs: [[[213, 285], [218, 298]], [[180, 285], [160, 298]]] }) +
    arrow([226, 292], [292, 218], FORCE, 5) +
    txt(310, 240, 'The push of the legs\nat take-off', { color: FORCE, anchor: 'start', bold: true }) +
    arrow([380, 140], [380, 215], GRAV, 5) + txt(392, 190, 'Gravity pulls down', { color: GRAV, anchor: 'start', bold: true }) +
    fig({ head: [380, 112], neck: [380, 128], hip: [380, 160], arms: [[[400, 118], [415, 108]], [[360, 118], [345, 108]]], legs: [[[395, 175], [410, 168]], [[365, 175], [350, 185]]] }) +
    txt(380, 76, 'Flight path: sideways speed stays the same', { color: SPEED, bold: true }) +
    arrow([395, 305], [395, 305], INK, 1) +
    line([250, 335], [510, 335], INK, 2) + arrow([250, 335], [250, 335], INK, 1) +
    `<path d="M252,335 L268,327 M252,335 L268,343 M508,335 L492,327 M508,335 L492,343" stroke="${INK}" stroke-width="2" fill="none"/>` +
    txt(380, 365, 'The gap: nothing to push on in the air', { bold: true }) +
    fig({ head: [606, 224], neck: [610, 242], hip: [606, 278], arms: [[[630, 232], [645, 222]], [[590, 254], [575, 240]]], legs: [[[620, 290], [626, 298]], [[596, 288], [586, 298]]], ghost: true }) +
    arrow([575, 150], [600, 215], SPEED, 5) + txt(620, 140, 'Landing: feet first,\non the far side', { anchor: 'middle', bold: true }) +
    txt(120, 340, 'Take-off edge', { anchor: 'middle' }) + txt(640, 340, 'Far edge', { anchor: 'middle' });
  return wrap('Gap jump: push off, fly, land', body.replace(arrow([395, 305], [395, 305], INK, 1), '').replace(arrow([250, 335], [250, 335], INK, 1), ''));
}

function gapPrinciple(): string {
  let dots = '';
  for (let i = 0; i <= 5; i++) {
    const x = 80 + i * 70, t = i / 5, y = 280 - 4 * 130 * t * (1 - t);
    dots += `<circle cx="${x}" cy="${f(y)}" r="8" fill="${SPEED}"/>` + line([x, f(y) + 10], [x, 300], GROUND, 2, '4 5') + `<circle cx="${x}" cy="305" r="5" fill="${INK}"/>`;
  }
  const body = dots + line([80, 305], [430, 305], INK, 2) +
    txt(255, 340, 'Same sideways step in every tick of time', { bold: true }) +
    txt(255, 362, 'The dots underneath are evenly spaced', { size: 14 }) +
    txt(255, 90, 'The path through the air', { color: SPEED, bold: true }) +
    // the area picture
    `<rect x="520" y="140" width="200" height="130" fill="${SPEED}" opacity="0.18" stroke="${SPEED}" stroke-width="3"/>` +
    txt(620, 212, 'How far\nyou fly', { color: SPEED, bold: true, size: 18 }) +
    arrow([520, 290], [720, 290], INK, 3) + txt(620, 318, 'Time in the air', { bold: true }) +
    arrow([500, 270], [500, 140], INK, 3) + txt(490, 205, 'Sideways\nspeed', { anchor: 'end', bold: true }) +
    txt(620, 100, 'Wider and taller box,\nfurther flight', { bold: true }) +
    txt(380, 410, 'Fly twice as fast or twice as long, and you fly twice as far.', { size: 15 });
  return wrap('Gap jump: the idea', body);
}

function wallReal(): string {
  const body =
    `<path d="M100,380 Q520,380 580,80 L580,380 Z" fill="${SOFT}"/><path d="M100,380 Q520,380 580,80" fill="none" stroke="${GROUND}" stroke-width="6"/>` +
    fig({ head: [412, 190], neck: [421, 212], hip: [444, 238], arms: [[[445, 202], [465, 190]], [[432, 220], [452, 208]]], legs: [[[462, 262], [474, 272]], [[455, 276], [453, 289]]] }) +
    arrow([150, 362], [260, 362], SPEED, 5) + txt(150, 322, 'Speed at the start,\nalong the ground', { color: SPEED, anchor: 'start', bold: true }) +
    arrow([474, 272], [432, 208], FORCE, 5) + txt(380, 92, 'The push of the legs\nagainst the curve', { color: FORCE, bold: true, anchor: 'end' }) +
    arrow([590, 130], [590, 52], SPEED, 5) + txt(565, 75, 'Speed at the top:\nslower, and upward', { color: SPEED, anchor: 'end', bold: true }) +
    arrow([300, 170], [300, 245], GRAV, 5) + txt(288, 205, 'Gravity\npulls down', { color: GRAV, anchor: 'end', bold: true }) +
    txt(670, 300, 'The curved wall', { bold: true, size: 16 });
  return wrap('Warped wall: run up the curve', body);
}

function wallPrinciple(): string {
  const stages: [string, number, number][] = [['At the bottom', 1, 0.05], ['Halfway up', 0.55, 0.5], ['At the top', 0.1, 0.95]];
  let body = '';
  stages.forEach(([name, k, h], i) => {
    const cx = 130 + i * 250;
    body += txt(cx + 22, 85, name, { bold: true, size: 17 }) + bar(cx - 50, 330, 200, k, SPEED) + bar(cx + 10, 330, 200, h, ENERGY) +
      txt(cx - 28, 354, 'Speed', { size: 14, color: SPEED, bold: true }) + txt(cx + 32, 354, 'Height', { size: 14, color: ENERGY, bold: true });
    if (i < 2) body += arrow([cx + 100, 220], [cx + 150, 220], INK, 4);
  });
  body += txt(380, 392, 'Speed energy is spent to buy height energy.', { bold: true }) +
    txt(380, 416, 'Run in faster and you buy more height.', { size: 15 });
  return wrap('Warped wall: speed turns into height', body);
}

function ropeReal(): string {
  const hang = (x: number, y: number, ghost = false) => fig({ head: [x, y + 38], neck: [x, y + 20], hip: [x, y + 70], arms: [[[x - 4, y + 5], [x, y]], [[x + 4, y + 5], [x, y]]], legs: [[[x - 8, y + 92], [x - 8, y + 112]], [[x + 8, y + 92], [x + 8, y + 112]]], ghost });
  const body =
    line([300, 52], [460, 52], INK, 8) + `<circle cx="380" cy="52" r="6" fill="${INK}"/>` +
    `<path d="M196,204 Q380,350 564,204" fill="none" stroke="${GROUND}" stroke-width="2" stroke-dasharray="7 7"/>` +
    line([380, 52], [196, 204], INK, 3) + line([380, 52], [564, 204], INK, 3, '3 7') +
    hang(196, 204) + hang(564, 204, true) +
    arrow([196, 204], [265, 148], FORCE, 5) + txt(230, 120, 'Tension: the rope\npulls along itself', { color: FORCE, bold: true, anchor: 'end' }) +
    arrow([150, 250], [150, 320], GRAV, 5) + txt(138, 285, 'Gravity\npulls down', { color: GRAV, bold: true, anchor: 'end' }) +
    arrow([200, 215], [250, 275], SPEED, 5) + txt(262, 292, 'Grab here and swing', { color: SPEED, bold: true, anchor: 'start' }) +
    arrow([575, 190], [632, 118], SPEED, 5) + txt(660, 62, 'Let go here:\nyou fly off the way\nthe path points', { color: SPEED, bold: true, anchor: 'middle' }) +
    txt(380, 410, 'The rope only pulls. It swings you round in an arc.', { size: 15 });
  return wrap('Rope swing: grab, swing, let go', body);
}

function ropePrinciple(): string {
  const stages: [string, number, number, number][] = [['Top of the swing, going down', 0.05, 0.95, -1], ['Bottom: fastest', 1, 0.05, 0], ['Top on the far side', 0.05, 0.95, 1]];
  let body = '';
  stages.forEach(([name, k, h, side], i) => {
    const cx = 130 + i * 250;
    const px = cx + 20, bx = px + side * 70, by = side === 0 ? 215 : 150;
    body += txt(cx + 20, 70, name, { bold: true, size: 15 }) + line([px - 50, 90], [px + 50, 90], INK, 6) + line([px, 90], [bx, by], INK, 3) + `<circle cx="${bx}" cy="${by}" r="13" fill="${SPEED}"/>` +
      bar(cx - 20, 380, 100, k, SPEED, 36) + bar(cx + 36, 380, 100, h, ENERGY, 36) +
      txt(cx - 2, 402, 'Speed', { size: 14, color: SPEED, bold: true }) + txt(cx + 54, 402, 'Height', { size: 14, color: ENERGY, bold: true });
  });
  body += txt(380, 262, 'Height energy and speed energy trade places all the way round.', { bold: true, size: 16 });
  return wrap('Rope swing: energy swaps', body);
}

function trampolineReal(): string {
  const body =
    line([180, 340], [180, 400], INK, 6) + line([580, 340], [580, 400], INK, 6) + line([150, 340], [210, 340], INK, 6) + line([550, 340], [610, 340], INK, 6) +
    `<path d="M210,340 Q380,420 550,340" fill="none" stroke="${GROUND}" stroke-width="8"/>` +
    fig({ head: [380, 276], neck: [380, 292], hip: [380, 330], arms: [[[360, 300], [345, 292]], [[400, 300], [415, 292]]], legs: [[[398, 345], [392, 380]], [[362, 345], [368, 380]]] }) +
    arrow([480, 395], [480, 285], FORCE, 6) + txt(496, 255, 'Spring pushes\nthe runner up', { color: FORCE, bold: true, anchor: 'start' }) +
    arrow([300, 270], [300, 330], GRAV, 5) + txt(286, 296, 'Gravity\npulls down', { color: GRAV, bold: true, anchor: 'end' }) +
    fig({ head: [120, 94], neck: [120, 110], hip: [120, 146], arms: [[[102, 100], [90, 90]], [[138, 100], [150, 90]]], legs: [[[132, 166], [136, 186]], [[108, 166], [104, 186]]], ghost: true }) +
    arrow([120, 200], [120, 262], SPEED, 5) + txt(135, 232, 'Landing:\nspeed down', { color: SPEED, bold: true, anchor: 'start' }) +
    fig({ head: [640, 94], neck: [640, 110], hip: [640, 146], arms: [[[622, 100], [610, 90]], [[658, 100], [670, 90]]], legs: [[[652, 166], [656, 186]], [[628, 166], [624, 186]]], ghost: true }) +
    arrow([640, 262], [640, 200], SPEED, 5) + txt(655, 232, 'Leaving:\nspeed up', { color: SPEED, bold: true, anchor: 'start' }) +
    txt(380, 70, 'The mat stretches like a spring', { bold: true });
  return wrap('Trampoline: land, stretch, spring back', body);
}

function trampolinePrinciple(): string {
  const stages: [string, number, number, number][] = [['Coming down', 1, 0, 0], ['Mat stretched, stopped', 0, 0.95, 0], ['Going back up', 0.9, 0.0, 0.1]];
  let body = '';
  stages.forEach(([name, k, s, l], i) => {
    const cx = 130 + i * 250;
    body += txt(cx + 20, 85, name, { bold: true, size: 17 }) + bar(cx - 60, 330, 200, k, SPEED, 40) + bar(cx - 2, 330, 200, s, ENERGY, 40) + bar(cx + 56, 330, 200, l, GRAV, 40) +
      txt(cx - 40, 354, 'Speed', { size: 13, color: SPEED, bold: true }) + txt(cx + 18, 354, 'Spring', { size: 13, color: ENERGY, bold: true }) + txt(cx + 76, 354, 'Lost', { size: 13, color: GRAV, bold: true });
    if (i < 2) body += arrow([cx + 105, 220], [cx + 150, 220], INK, 4);
  });
  body += txt(380, 392, 'The mat stores the energy, then gives it back.', { bold: true }) +
    txt(380, 416, 'A little is lost as heat, so each bounce is a bit lower.', { size: 15 });
  return wrap('Trampoline: store it, give it back', body);
}

function landingReal(): string {
  const body =
    `<rect x="0" y="380" width="760" height="60" fill="${SOFT}"/>` + line([0, 380], [760, 380], GROUND, 5) +
    fig({ head: [330, 250], neck: [336, 270], hip: [310, 320], arms: [[[360, 290], [385, 300]], [[345, 295], [372, 318]]], legs: [[[350, 345], [322, 378]], [[335, 350], [300, 378]]] }) +
    arrow([270, 100], [310, 205], SPEED, 6) + txt(30, 70, 'Speed when you\nhit the ground', { color: SPEED, bold: true, anchor: 'start' }) +
    arrow([322, 440], [322, 400], FORCE, 1) +
    arrow([400, 372], [400, 300], FORCE, 6) + arrow([440, 372], [440, 300], FORCE, 6) +
    txt(480, 300, 'The ground pushes\nback, gently, for\na longer time', { color: FORCE, bold: true, anchor: 'start' }) +
    txt(540, 200, 'Bent knees spread\nthe stop over more time', { bold: true, anchor: 'start' }) + arrow([535, 235], [362, 335], INK, 2) +
    arrow([230, 295], [230, 340], GRAV, 4) + txt(214, 290, 'Gravity', { color: GRAV, bold: true, anchor: 'end' });
  return wrap('Landing: bend your knees', body.replace(arrow([322, 440], [322, 400], FORCE, 1), ''));
}

function landingPrinciple(): string {
  const graph = (x: number, name: string, h: number, w: number, color: string) =>
    arrow([x, 340], [x + 290, 340], INK, 3) + arrow([x, 340], [x, 110], INK, 3) +
    `<path d="M${x},340 L${x},340 Q${x + 20},${340 - h} ${x + 20 + w / 2},${340 - h} Q${x + 20 + w},${340 - h} ${x + 20 + w},340 Z" fill="${color}" opacity="0.28" stroke="${color}" stroke-width="3"/>` +
    txt(x + 145, 66, name, { bold: true, size: 17 }) + txt(x + 145, 368, 'Time', { bold: true }) + txt(x + 8, 96, 'Push of the ground', { anchor: 'start', size: 14, bold: true });
  const body = graph(60, 'Stiff legs', 190, 70, FORCE) + graph(410, 'Bent knees', 75, 180, ENERGY) +
    txt(380, 405, 'Same stop, same area. Spread it over more time and the push is gentler.', { bold: true, size: 15 });
  return wrap('Landing: the same stop, spread out', body);
}

const table: Record<DiagramId, Record<DiagramKind, () => string>> = {
  gap: { real: gapReal, principle: gapPrinciple },
  wall: { real: wallReal, principle: wallPrinciple },
  rope: { real: ropeReal, principle: ropePrinciple },
  trampoline: { real: trampolineReal, principle: trampolinePrinciple },
  landing: { real: landingReal, principle: landingPrinciple },
};

export function diagram(id: DiagramId, kind: DiagramKind): string {
  return table[id][kind]();
}
