import { soundButton, startAudio } from '../ui/audio';
import { EXPERIMENTS, GAP_WIDTH, classify, defaults, sweep, type Context, type Experiment, type Overlay, type Person, type Point, type Pose, type Trial } from '../sim/experiments';
import { LESSONS } from './lessons';
import { diagram } from './diagrams';
import { DOJO_V2_CSS } from './dojo-style';
import { currentWorld, mountWorldGallery } from '../ui/world-picker';
import defaultCourse from '../course/default-course.json';
import type { CourseData } from '../course/course';
import { courseFacts } from '../course/facts';
import { DEFAULT_LANDING } from '../sim/landing';
import { GRAVITY } from '../sim/units';
import { pageQuery } from '../flags';

// The Dojo: a guided lesson per obstacle. Why it matters, what to try, the shape of the relationship, a rule of
// thumb, the exact formula (earned, last), and what it means on the Course. Formulas appear only here.
const STEPS = ['Why it matters', 'Try it', 'The shape', 'A rule of thumb', 'The exact formula', 'On the Course']; // ?dojo=old
const STEPS_V3 = ['Why it matters', 'Try it', 'The shape', 'The exact formula']; // CC-154: one graph, the rule of thumb is a caption on it, the formula is drawn over it last

export function startDojo(host: HTMLElement): { backend: 'webgl2' } {
  const q = pageQuery();
  const num = (k: string) => (q.get(k) === null ? undefined : Number(q.get(k)));
  // the course in play (saved by the Course or the Park), else the default one: the lessons read their numbers from it
  let course = defaultCourse as unknown as CourseData;
  try { const saved = localStorage.getItem('cc.course'); if (saved) course = JSON.parse(saved) as CourseData; } catch { /* use the default */ }
  const facts = courseFacts(course);
  const g0 = facts.gaps[0];
  const ctx: Context = {
    width: num('width') ?? g0?.width, rise: num('rise') ?? g0?.rise, needed: num('needed') ?? g0?.needed, speed: num('speed'),
    wallHeight: num('wallh') ?? facts.wall?.height, ropeLength: num('length') ?? facts.rope?.length,
  };
  const legacy = q.get('dojo') === 'old'; // ?dojo=old shows the layout from before CC-146, for comparing
  const fromCourse = q.get('from') === 'course';
  const returnToCourse = fromCourse ? '?welcome=0' : '?';
  const style = document.createElement('style');
  style.textContent = `
    .dojo{font:16px/1.45 system-ui,sans-serif;color:#17201d;background:#eef1ec;min-height:100%;padding:16px;display:grid;gap:12px;max-width:1200px;margin:0 auto}
    .dojo h1{margin:0;font-size:24px}.dojo .tabs,.dojo .head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .dojo button,.dojo a.btn{font:inherit;border:1px solid #b9c2bb;background:#fff;color:#17201d;border-radius:8px;padding:6px 12px;cursor:pointer;text-decoration:none}
    .dojo button[aria-pressed=true]{background:#17201d;color:#fff}.dojo .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}
    .dojo button:disabled{opacity:.45;cursor:not-allowed}
    .dojo .row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px}@media(max-width:860px){.dojo .row{grid-template-columns:1fr}}
    .dojo canvas{width:100%;height:auto;background:#fff;border:1px solid #cfd6d0;border-radius:10px}
    .dojo .panel{background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:12px;display:grid;gap:10px;align-content:start}
    .dojo label{display:grid;gap:2px;font-size:14px}.dojo input[type=range]{width:100%}.dojo .why{font-size:13px;color:#58635d}
    .dojo .result{border-left:4px solid #0f6b5c;padding:6px 10px;background:#f3f7f4}.dojo .saying{font-size:18px;font-style:italic;border-left:4px solid #c9893b;padding:6px 10px;background:#fbf4e8}
    .dojo .formula{font:600 22px ui-monospace,Menlo,monospace;background:#17201d;color:#fff;border-radius:8px;padding:12px}
    .dojo .working{font:600 17px ui-monospace,Menlo,monospace;background:#f3f7f4;border-radius:8px;padding:8px 10px}.dojo .banner{background:#fff3e6;border:1px solid #e6b87a;border-radius:10px;padding:8px 12px}
    .dojo .steps{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start}.dojo .step{font-size:13px;padding:3px 10px;border-radius:999px;border:1px solid #b9c2bb;background:#fff;color:#58635d}
    .dojo .step.on{background:#0f6b5c;color:#fff;border-color:#0f6b5c}.dojo .step.done{color:#0f6b5c;border-color:#0f6b5c}
    .dojo .muted{color:#58635d;font-size:14px}.dojo ol,.dojo ul{margin:0;padding-left:20px}` + (legacy ? '' : DOJO_V2_CSS);
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = legacy ? 'dojo' : 'dojo v2';
  host.appendChild(root);

  let exp: Experiment = EXPERIMENTS.find((e) => e.id === q.get('ex')) ?? EXPERIMENTS[0];
  let values = defaults(exp, ctx);
  const steps = legacy ? STEPS : STEPS_V3;
  let step = 0;
  const key = () => steps[step];
  let diagramKind: 'real' | 'principle' = 'real';

  // a saying is earned by trying: it shows once a slider has moved in that lesson, or the lesson has moved past "Try it" (kept in this browser)
  const earned = new Set<string>();
  try { for (const id of JSON.parse(localStorage.getItem('cc.dojo.earned') ?? '[]') as string[]) earned.add(id); } catch { /* none yet */ }
  let paintSaying: () => void = () => {};
  let paintRule: () => void = () => {};
  const earn = () => { if (earned.has(exp.id)) return; earned.add(exp.id); try { localStorage.setItem('cc.dojo.earned', JSON.stringify([...earned])); } catch { /* not saved */ } paintSaying(); paintRule(); };
  let refresh: () => void = () => {}; // redraws whatever the current step shows when a slider moves
  const el = <T extends HTMLElement>(tag: string, parent: HTMLElement, props: Partial<T> & { text?: string } = {}): T => {
    const e = document.createElement(tag) as T;
    const { text, ...rest } = props;
    Object.assign(e, rest);
    if (text) e.textContent = text; // set after the rest: an anchor's own text property must not be overwritten
    parent.appendChild(e);
    return e;
  };
  const ctxFor = (e: Experiment): Context => (e.id === 'gap' || e.id === 'wall' || e.id === 'rope' ? ctx : {});
  // each obstacle keeps its own place: switching never throws the lesson away (R2-D2)
  const states: Record<string, { values: Record<string, number>; step: number }> = {};
  const choose = (e: Experiment) => {
    states[exp.id] = { values, step };
    exp = e;
    const st = states[e.id];
    if (st) ({ values, step } = st);
    else { values = defaults(e, ctx); step = 0; }
    render();
  };

  function render() {
    root.innerHTML = '';
    refresh = () => {};
    const head = el('div', root, { className: legacy ? 'head' : 'head bar' });
    if (legacy) el('h1', head, { text: 'The Dojo' });
    else { const brand = el('div', head, { className: 'brand' }); el('span', brand, { className: 'kicker', text: 'Train slow. Run fast.' }); el('h1', brand, { text: 'The Dojo' }); el('span', brand, { className: 'hint', id: 'thint', text: 'T: back to courses' }); }
    const back = el<HTMLAnchorElement>('a', head, { text: legacy ? 'Back to the Course (T)' : 'Back to the Course', href: returnToCourse, className: 'btn go' });
    back.id = 'back';
    if (legacy) back.style.cssText = 'position:fixed;top:12px;right:16px;z-index:30;font-size:18px;padding:10px 18px;box-shadow:0 2px 10px #0003'; // always in the same corner, easy to find
    if (fromCourse && (ctx.width || ctx.wallHeight || ctx.ropeLength)) {
      const b = el('div', root, { className: 'banner', id: 'banner' });
      b.textContent = ctx.width
        ? `Training for the gap you fell at: ${ctx.width.toFixed(1)} m wide${ctx.rise ? `, ${ctx.rise > 0 ? 'landing ' + ctx.rise.toFixed(1) + ' m higher' : ''}` : ''}. You left the edge at ${ctx.speed?.toFixed(1) ?? '?'} m/s; it needs at least ${ctx.needed?.toFixed(1) ?? '?'} m/s.`
        : ctx.wallHeight ? `Training for the warped wall: ${ctx.wallHeight.toFixed(1)} m high.` : `Training for the rope: ${ctx.ropeLength?.toFixed(0)} m long.`;
    }
    const tabs = el('div', root, { className: legacy ? 'tabs' : 'tabs cards' });
    for (const e of EXPERIMENTS) {
      const b = el<HTMLButtonElement>('button', tabs, legacy ? { text: e.name } : {});
      if (!legacy) {
        const at = e === exp ? step : states[e.id]?.step ?? 0;
        el('span', b, { text: e.name });
        el('small', b, { text: at === 0 ? 'Start here' : `Step ${at + 1} of ${steps.length}` });
      }
      b.setAttribute('aria-pressed', String(e === exp));
      b.onclick = () => choose(e);
    }
    if (!legacy) {
      // the lesson's title, its question and its saying (locked until the player has tried it)
      const hero = el('div', root, { className: 'hero', id: 'hero' });
      el('h2', hero, { text: exp.name });
      el('p', hero, { className: 'q', text: exp.question });
      const sayBox = el('div', hero);
      paintSaying = () => {
        sayBox.innerHTML = '';
        if (earned.has(exp.id)) exp.sayings.forEach((say) => el('div', sayBox, { className: 'saying', text: say }));
        else el('div', sayBox, { className: 'saying locked', id: 'locked-saying', text: 'Try the sliders to earn this lesson\'s saying.' });
      };
      paintSaying();
    }
    const stepsEl = el('div', root, { className: legacy ? 'steps' : 'steps path' });
    steps.forEach((s, i) => {
      const cls = (legacy ? 'step' : 'node') + (i === step ? ' on' : i < step ? ' done' : '');
      const b = el<HTMLButtonElement>('button', stepsEl, legacy ? { className: cls, text: `${i + 1}. ${s}` } : { className: cls });
      if (!legacy) { el('span', b, { className: 'dot', text: String(i + 1) }); el('span', b, { className: 't', text: s }); b.setAttribute('aria-label', `Step ${i + 1}: ${s}`); }
      b.onclick = () => { step = i; render(); };
    });
    if (!legacy && step >= 2) earn(); // reaching the shape counts as having tried it
    const L = LESSONS[exp.id];
    const stepKey = key();
    const row = el('div', root, { className: 'row' });
    let stage: HTMLElement = row;
    if (!legacy) stage = el('div', row, { className: 'stage' });
    const phoneSize = innerWidth < 640 && !legacy; // a phone gets a smaller drawing, so the labels stay readable
    const band = !legacy && stepKey === 'The exact formula' ? 76 : 0; // the strip over the graph that carries the formula
    const canvas = el<HTMLCanvasElement>('canvas', stage, phoneSize ? { width: 380, height: 340 + band } : { width: 760, height: 440 + band });
    canvas.dataset.band = String(band);
    if (!legacy && (stepKey === 'Try it' || stepKey === 'The exact formula')) {
      const cap = el('div', stage, { className: 'caption', id: 'rule' });
      paintRule = () => { cap.innerHTML = ''; if (earned.has(exp.id)) { el('b', cap, { text: 'Rule of thumb: ' }); cap.append(L.rule); cap.classList.remove('locked'); } else { cap.textContent = 'Move a slider to find this lesson\'s rule of thumb.'; cap.classList.add('locked'); } };
      paintRule();
    } else paintRule = () => {};
    const panel = el('div', row, { className: 'panel' });
    if (stepKey === 'Why it matters') {
      // step 1 uses the plot's space for a picture: the real obstacle with its forces, or the idea behind it
      canvas.style.display = 'none';
      if (stage !== row) stage.style.display = 'none';
      const box = el('div', row, { id: 'diagram' });
      row.insertBefore(box, panel);
      box.style.cssText = 'display:grid;gap:8px;align-content:start';
      const tg = el('div', box, { className: 'tabs' });
      (['real', 'principle'] as const).forEach((k) => {
        const b = el<HTMLButtonElement>('button', tg, { text: k === 'real' ? 'The real obstacle' : 'The idea' });
        b.setAttribute('aria-pressed', String(diagramKind === k));
        b.onclick = () => { diagramKind = k; render(); };
      });
      const svgBox = el('div', box);
      if (legacy) svgBox.style.cssText = 'background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:6px';
      svgBox.innerHTML = diagram(exp.id === 'bars' ? 'rope' : exp.id, diagramKind); // a bar swing is a pendulum like the rope: it borrows the rope's picture until it has its own
      const svg = svgBox.querySelector('svg'); if (svg) { svg.setAttribute('width', '100%'); svg.removeAttribute('height'); (svg as SVGElement).style.height = 'auto'; }
    }
    if (stepKey === 'Why it matters') {
      el('strong', panel, { text: `${exp.name}: why it matters` });
      el('p', panel, { text: L.why });
      el('strong', panel, { text: 'What each setting does' });
      const ul = el('ul', panel);
      exp.knobs.forEach((k) => el('li', ul, { text: `${k.label}: ${k.why}` }));
    } else if (stepKey === 'Try it') {
      el('strong', panel, { text: 'Try it' });
      const ol = el('ol', panel);
      L.tries.forEach((t) => el('li', ol, { text: t }));
      for (const k of exp.knobs) {
        const l = el<HTMLLabelElement>('label', panel);
        const span = el('span', l, { text: `${k.label}: ${values[k.id].toFixed(k.step < 0.1 ? 2 : 1)} ${k.unit}` });
        const r = el<HTMLInputElement>('input', l, { type: 'range', id: 'knob-' + k.id, min: String(k.min), max: String(k.max), step: String(k.step), value: String(values[k.id]) });
        r.oninput = () => { values[k.id] = Number(r.value); span.textContent = `${k.label}: ${values[k.id].toFixed(k.step < 0.1 ? 2 : 1)} ${k.unit}`; if (!legacy) earn(); refresh(); };
        el('span', l, { className: 'why', text: k.why });
      }
      el('strong', panel, { text: exp.question });
      const out = el('div', panel, { id: 'out' });
      el('span', panel, { className: 'muted', text: 'Drag the sliders: the picture and the answer follow you at once.' });
      showResult(out);
      refresh = () => { draw(canvas); showResult(out); };
    } else if (stepKey === 'The shape') {
      const pts = sweep(exp, values, exp.primary, ctxFor(exp));
      const cls = classify(pts);
      const k = exp.knobs.find((kk) => kk.id === exp.primary)!;
      el('strong', panel, { text: `The shape: ${k.label} against the answer` });
      el('p', panel, { text: `The grey curve is the simulator answering for every ${k.label.toLowerCase()} from ${k.min} to ${k.max}. The dot is where your sliders are now.` });
      el('p', panel, { id: 'shape', text: `This curve is ${L.shapeWords[cls.shape] ?? 'a smooth curve; the next step gives a rule of thumb for it.'}` });
    } else if (stepKey === 'A rule of thumb') {
      el('strong', panel, { text: 'A rule of thumb' });
      el('p', panel, { text: L.rule });
      el('p', panel, { className: 'muted', text: 'Directionally right is enough: you can use this on the Course without a calculator.' });
    } else if (stepKey === 'The exact formula') {
      el('strong', panel, { text: 'The exact formula' });
      el('div', panel, { className: 'formula', id: 'formula', text: L.formula });
      el('p', panel, { text: L.formulaWords });
      el('strong', panel, { text: 'Move one slider; the others stay where they are' });
      let upCalc = () => {};
      for (const id of L.inputs) {
        const k = exp.knobs.find((kk) => kk.id === id)!;
        const l = el<HTMLLabelElement>('label', panel);
        const span = el('span', l, { text: `${k.label}: ${values[k.id].toFixed(k.step < 0.1 ? 2 : 1)} ${k.unit}` });
        const r = el<HTMLInputElement>('input', l, { type: 'range', id: 'knob-' + k.id, min: String(k.min), max: String(k.max), step: String(k.step), value: String(values[k.id]) });
        r.oninput = () => { values[k.id] = Number(r.value); span.textContent = `${k.label}: ${values[k.id].toFixed(k.step < 0.1 ? 2 : 1)} ${k.unit}`; upCalc(); refresh(); };
      }
      const calcBox = el('div', panel, { id: 'calc' });
      upCalc = () => {
        const c = L.calc(values);
        calcBox.innerHTML = '';
        el('div', calcBox, { className: 'working', id: 'working', text: c.working });
        el('div', calcBox, { className: 'result', id: 'answer', text: `${c.label}: ${c.value.toFixed(c.unit === 'm/s²' ? 0 : 2)} ${c.unit}` });
        if (c.note) el('div', calcBox, { className: 'muted', text: c.note });
        const simulated = exp.run(values, ctxFor(exp));
        if (exp.id !== 'rope') el('div', calcBox, { className: 'muted', id: 'sim', text: `The simulator (it also counts friction and spring losses) gives ${simulated.answer.toFixed(c.unit === 'm/s²' ? 0 : 2)} ${exp.answerUnit}.` });
      };
      upCalc();
      refresh = () => draw(canvas);
      if (!legacy) courseBlock();
    } else {
      courseBlock();
    }
    function courseBlock() { // what this means on the Course, and the way back (the last step in both layouts)
      el('strong', panel, { text: 'On the Course' });
      const ap = el('div', panel, { id: 'apply' });
      L.apply(facts, ctx, values).split('\n').forEach((line) => el('p', ap, { text: line }));
      el<HTMLAnchorElement>('a', panel, { text: 'Back to the Course', href: returnToCourse, className: 'btn go' });
      const next = EXPERIMENTS[(EXPERIMENTS.indexOf(exp) + 1) % EXPERIMENTS.length];
      el<HTMLButtonElement>('button', panel, { text: `Learn the ${next.name} next` }).onclick = () => choose(next);
    }
    const nav = el('div', panel, { className: legacy ? 'tabs' : 'tabs nav' });
    const prev = el<HTMLButtonElement>('button', nav, { text: '← Back' });
    prev.disabled = step === 0;
    prev.onclick = () => { step--; render(); };
    const nx = el<HTMLButtonElement>('button', nav, { text: 'Next →', className: 'go', id: 'next' });
    nx.disabled = step === steps.length - 1;
    nx.onclick = () => { step++; render(); };
    draw(canvas);
  }

  const preview = (): Trial => exp.run(values, ctxFor(exp));
  function showResult(out: HTMLElement) {
    out.innerHTML = '';
    const t = preview();
    el('div', out, { className: 'result', text: `${t.answer.toFixed(1)} ${exp.answerUnit}. ${t.note ?? ''}` });
    if (legacy) exp.sayings.forEach((say) => el('div', out, { className: 'saying', text: say }));
  }

  // a simple stick-figure person, feet at (px, py), `s` pixels per metre
  function person(c: CanvasRenderingContext2D, px: number, py: number, s: number, pose: Pose, hand?: { px: number; py: number }, label?: string) {
    c.save(); c.strokeStyle = '#17201d'; c.fillStyle = '#17201d'; c.lineWidth = Math.max(2, s * 0.06); c.lineCap = 'round';
    const line = (x1: number, y1: number, x2: number, y2: number) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    const hip = pose === 'crouch' ? 0.5 : 0.9, shoulder = pose === 'crouch' ? 1.0 : 1.5, lean = pose === 'climb' ? 0.35 : pose === 'fly' ? 0.2 : 0;
    const sx = px + lean * s * 0.6, sy = py - shoulder * s, hx = px, hy = py - hip * s;
    line(sx, sy, hx, hy);
    c.beginPath(); c.arc(sx + lean * s * 0.15, sy - 0.2 * s, 0.11 * s, 0, Math.PI * 2); c.fill();
    if (pose === 'hang') { const gx = hand ? px + hand.px : sx; const gy = hand ? hand.py : sy - 0.6 * s; line(sx - 0.05 * s, sy, gx, gy); line(sx + 0.05 * s, sy, gx, gy); }
    else if (pose === 'fly') { line(sx, sy, sx + 0.4 * s, sy - 0.15 * s); line(sx, sy, sx + 0.3 * s, sy + 0.1 * s); }
    else if (pose === 'climb') { line(sx, sy, sx + 0.35 * s, sy - 0.35 * s); line(sx, sy, sx + 0.25 * s, sy - 0.1 * s); }
    else { line(sx, sy, sx - 0.15 * s, sy + 0.5 * s); line(sx, sy, sx + 0.15 * s, sy + 0.5 * s); }
    if (pose === 'crouch') { line(hx, hy, hx + 0.3 * s, hy + 0.25 * s); line(hx + 0.3 * s, hy + 0.25 * s, hx, py); line(hx, hy, hx - 0.25 * s, hy + 0.25 * s); line(hx - 0.25 * s, hy + 0.25 * s, hx - 0.1 * s, py); }
    else if (pose === 'fly') { line(hx, hy, hx + 0.35 * s, hy + 0.25 * s); line(hx + 0.35 * s, hy + 0.25 * s, hx + 0.1 * s, py); line(hx, hy, hx - 0.2 * s, hy + 0.3 * s); line(hx - 0.2 * s, hy + 0.3 * s, hx - 0.05 * s, py - 0.05 * s); }
    else { line(hx, hy, hx - 0.14 * s, py); line(hx, hy, hx + 0.14 * s, py); }
    if (label) { c.font = '12px system-ui'; c.fillStyle = '#58635d'; c.fillText(label, px - 18, py + 16); }
    c.restore();
  }

  // the graph is drawn once; on the last step the formula is drawn over it in a strip on top (CC-154)
  function draw(canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d');
    if (!c) return;
    const band = Number(canvas.dataset.band ?? 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save(); c.translate(0, band);
    drawGraph(c, canvas.width, canvas.height - band);
    c.restore();
    if (band) formulaStrip(c, canvas.width, band);
  }

  function formulaStrip(c: CanvasRenderingContext2D, W: number, band: number) {
    const L = LESSONS[exp.id];
    const calc = L.calc(values);
    c.save();
    c.fillStyle = '#2b2218'; c.beginPath(); c.roundRect(8, 6, W - 16, band - 12, 12); c.fill();
    const fit = (text: string, weight: number, size: number, color: string, y: number) => {
      let px = size; c.font = `${weight} ${px}px ui-monospace,Menlo,monospace`;
      while (px > 9 && c.measureText(text).width > W - 40) { px--; c.font = `${weight} ${px}px ui-monospace,Menlo,monospace`; }
      c.fillStyle = color; c.fillText(text, 20, y);
    };
    fit(L.formula, 800, 17, '#fffdf7', 32);
    fit(`${calc.working.split('\n').pop()}`, 600, 14, '#f0c987', 58);
    c.restore();
  }

  function drawGraph(c: CanvasRenderingContext2D, W: number, H: number) {
    const pad = 40;
    if (key() === 'The shape') return drawShape(c, W, H, pad);
    const lastTrial = preview(); // the picture follows the sliders; kept runs stay behind it
    if (exp.axis === 'meter' && exp.id === 'landing') return drawForce(c, W, H, pad, lastTrial);
    const paths: Point[][] = [lastTrial.path];
    const overlays = (lastTrial.overlays ?? []) as Overlay[];
    const meter = false;
    const bottom = meter ? H - 110 : H - pad;
    const defaultPeople: Person[] = exp.id === 'rope' ? [{ x: 0, y: -2.1, pose: 'hang', hand: { x: 0, y: 0 } }] : exp.id === 'trampoline' ? [{ x: 0, y: values.drop ?? 2, pose: 'fly' }] : exp.id === 'landing' ? [] : [{ x: 0, y: 0, pose: 'stand' }];
    const people = lastTrial.people ?? defaultPeople;
    const all = [...paths.flat(), ...overlays.flatMap((o) => o.pts), ...people.flatMap((q) => [{ x: q.x, y: q.y }, { x: q.x, y: q.y + 1.8 }])];
    const farSide = exp.id === 'gap' ? ctx.width ?? GAP_WIDTH : 0;
    const maxX = Math.max(exp.axis === 'x' ? exp.answerMax : 6, farSide + 1, ...all.map((p) => p.x), 1);
    const maxY = Math.max(exp.axis === 'y' ? exp.answerMax : 4, ...all.map((p) => p.y), 1);
    const minY = Math.min(0, ...all.map((p) => p.y));
    const sx = (x: number) => pad + (x / maxX) * (W - 2 * pad);
    const sy = (y: number) => bottom - ((y - minY) / (maxY - minY)) * (bottom - pad);
    c.strokeStyle = '#9aa59e'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(pad, sy(0)); c.lineTo(W - pad, sy(0)); c.stroke();
    c.fillStyle = '#58635d'; c.font = '13px system-ui';
    for (let m = 0; m <= maxX; m += Math.max(1, Math.round(maxX / 8))) c.fillText(`${m}`, sx(m) - 4, sy(0) + 16);
    for (let m = Math.ceil(minY); m <= maxY; m += Math.max(1, Math.round((maxY - minY) / 6))) c.fillText(`${m}`, 8, sy(m) + 4);
    c.fillText(meter ? 'seconds' : 'metres', W - pad - 50, sy(0) + 30);
    const line = (pts: Point[], color: string, w: number, dash: number[] = []) => {
      if (pts.length < 2) return;
      c.strokeStyle = color; c.lineWidth = w; c.setLineDash(dash);
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(sx(p.x), sy(p.y)) : c.moveTo(sx(p.x), sy(p.y)))); c.stroke(); c.setLineDash([]);
    };
    for (const o of overlays) { line(o.pts, o.color, 5); c.fillStyle = o.color; c.fillText(o.label, sx(o.pts[o.pts.length - 1].x) + 8, sy(o.pts[o.pts.length - 1].y) + 4); }
    line(lastTrial.path, '#0f6b5c', 4);
    if (exp.id === 'rope') {
      const L = values.length, cx = sx(0), cy = sy(L);
      c.fillStyle = '#8a5a2b'; c.fillRect(cx - 18, cy - 8, 36, 8); c.fillStyle = '#58635d'; c.fillText('beam', cx + 24, cy - 2);
      const th = (values.angle * Math.PI) / 180;
      c.strokeStyle = '#c9893b'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 46, Math.PI / 2 - th, Math.PI / 2); c.stroke();
      c.fillStyle = '#c9893b'; c.fillText(`angle ${Math.round((th * 180) / Math.PI)}°`, cx + 52, cy + 40);
      c.fillStyle = '#58635d'; c.fillText('The angle is how far the rope has swung from hanging straight down when you let go.', pad, H - 8);
    }
    {
      const pxm = Math.min(sx(1) - sx(0), (sy(0) - sy(1)));
      for (const q of people) person(c, sx(q.x), sy(q.y), pxm, q.pose, q.hand ? { px: sx(q.hand.x) - sx(q.x), py: sy(q.hand.y) } : undefined, q.label);
    }
    if (exp.id === 'gap') {
      c.fillStyle = '#2f7fc1'; c.fillRect(sx(0), sy(0), sx(farSide) - sx(0), 10);
      c.fillStyle = '#17201d'; c.fillText('water', sx(farSide / 2) - 14, sy(0) + 28); c.fillText(`far side: ${farSide.toFixed(1)} m`, sx(farSide) - 30, sy(0) - 8);
    }
    c.fillStyle = '#58635d'; c.fillText('The teal line follows the sliders.', pad, 20);
  }

  // Landing: the push on you against time. The block's width is the time you take to stop, its height the push,
  // and its area is the speed you lose, which depends only on the drop. A wider block must be shorter.
  function drawForce(c: CanvasRenderingContext2D, W: number, H: number, pad: number, now: Trial) {
    const bend = exp.knobs.find((k) => k.id === 'bend')!;
    const tMax = bend.max, left = 64;
    const top = Math.max(80, now.answer);
    const yMax = Math.ceil((top * 1.15) / 20) * 20;
    const sx = (t: number) => left + (t / tMax) * (W - left - pad), sy = (f: number) => H - 50 - (f / yMax) * (H - 50 - pad - 16);
    c.strokeStyle = '#9aa59e'; c.lineWidth = 1; c.beginPath(); c.moveTo(left, pad); c.lineTo(left, sy(0)); c.lineTo(W - pad, sy(0)); c.stroke();
    c.fillStyle = '#58635d'; c.font = '13px system-ui';
    for (let t = 0; t <= tMax + 1e-9; t += 0.1) c.fillText(t.toFixed(1), sx(t) - 8, sy(0) + 16);
    const stepY = yMax > 120 ? 40 : 20;
    for (let f = 0; f <= yMax; f += stepY) { c.fillText(String(f), left - 8 - 8 * String(f).length, sy(f) + 4); c.strokeStyle = '#e3e8e4'; c.beginPath(); c.moveTo(left, sy(f)); c.lineTo(W - pad, sy(f)); c.stroke(); }
    c.fillStyle = '#17201d'; c.fillText('time spent stopping (seconds) →', W / 2 - 80, H - 10);
    c.save(); c.translate(16, H / 2 + 60); c.rotate(-Math.PI / 2); c.fillText('push on you (m/s², more up = harder)', 0, 0); c.restore();
    const limit = DEFAULT_LANDING.stumbleDecel;
    c.strokeStyle = '#c4572a'; c.setLineDash([6, 5]); c.lineWidth = 2; c.beginPath(); c.moveTo(left, sy(limit)); c.lineTo(W - pad, sy(limit)); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#c4572a'; if (W < 500) c.textAlign = 'right'; c.fillText(W < 500 ? `${limit} m/s²: you stumble above this` : `${limit} m/s²: above this the Course makes you stumble`, W < 500 ? W - pad + 20 : left + 8, sy(limit) - 6); c.textAlign = 'left';
    const block = (t: Trial, fill: string | null, stroke: string, w: number) => {
      const bw = t.path[2].x, bh = t.path[2].y;
      if (fill) { c.fillStyle = fill; c.fillRect(sx(0), sy(bh), sx(bw) - sx(0), sy(0) - sy(bh)); }
      c.strokeStyle = stroke; c.lineWidth = w; c.strokeRect(sx(0), sy(bh), sx(bw) - sx(0), sy(0) - sy(bh));
    };
    block(now, '#0f6b5c55', '#0f6b5c', 3);
    const speed = Math.sqrt(2 * GRAVITY * values.drop);
    c.fillStyle = '#0f6b5c'; c.font = '600 14px system-ui';
    const bw = now.path[2].x, bh = now.path[2].y;
    if (W < 500) { // a phone's small drawing: the labels go top right, clear of the block and the limit line
      c.textAlign = 'right';
      c.fillText(`area = ${speed.toFixed(1)} m/s lost`, W - pad + 20, pad + 26);
      c.fillText(`${bh.toFixed(0)} m/s² for ${bw.toFixed(2)} s`, W - pad + 20, pad + 46);
      c.textAlign = 'left';
    } else {
      c.fillText(`area = ${speed.toFixed(1)} m/s (the speed you lose)`, Math.min(sx(bw) + 10, W - 280), Math.max(pad + 14, sy(bh) + 18));
      c.fillText(`${bh.toFixed(0)} m/s² for ${bw.toFixed(2)} s`, Math.min(sx(bw) + 10, W - 280), Math.max(pad + 34, sy(bh) + 38));
    }
    c.fillStyle = '#58635d'; c.font = '13px system-ui'; c.fillText(W < 500 ? 'Drag the sliders: the area stays the same.' : 'Drag the sliders: the block changes shape but not its area (for the same drop).', left, 18);
  }

  function drawShape(c: CanvasRenderingContext2D, W: number, H: number, pad: number) {
    const k = exp.knobs.find((kk) => kk.id === exp.primary)!;
    const pts = sweep(exp, values, exp.primary, ctxFor(exp));
    const maxX = k.max, maxY = Math.max(...pts.map((p) => p.y), 1e-6) * 1.1;
    const sx = (x: number) => pad + ((x - k.min) / (k.max - k.min)) * (W - 2 * pad);
    const sy = (y: number) => H - pad - (y / maxY) * (H - 2 * pad);
    c.strokeStyle = '#9aa59e'; c.beginPath(); c.moveTo(pad, sy(0)); c.lineTo(W - pad, sy(0)); c.moveTo(pad, sy(0)); c.lineTo(pad, pad); c.stroke();
    c.fillStyle = '#58635d'; c.font = '13px system-ui';
    c.fillText(`${k.label} (${k.unit}) →`, W / 2 - 60, H - 8); c.fillText(`${exp.question.split('?')[0]}? (${exp.answerUnit})`, pad, pad - 12);
    c.strokeStyle = '#8b958f'; c.lineWidth = 3; c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(sx(p.x), sy(p.y)) : c.moveTo(sx(p.x), sy(p.y)))); c.stroke();
    c.fillStyle = '#0f6b5c';
    c.beginPath(); c.arc(sx(values[exp.primary]), sy(exp.run(values, ctxFor(exp)).answer), 6, 0, Math.PI * 2); c.fill(); // where your sliders are now
    void maxX;
  }

  // T opens the Dojo from the Course, so it closes it here too (not while typing in a box)
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || document.getElementById('cc-feedback') || (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range')) return;
    if (!picker) { location.href = returnToCourse; return; } // the old layout keeps its old route
    if (document.getElementById('world-gallery')) return; // already open: the picker has its own keys
    picker.open(); // T takes the player to the course picker, where they choose a course (CC-154)
  });
  // the Courses pill is not shown in the new Dojo: T opens the same picker (main.ts skips the pill here)
  const picker = legacy ? null : mountWorldGallery(document.body, { current: currentWorld(q), place: 'display:none' });
  startAudio(); document.body.append(soundButton()); // the Dojo shares the mute switch with the Course
  render();
  return { backend: 'webgl2' };
}
