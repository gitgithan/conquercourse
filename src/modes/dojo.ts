import { EXPERIMENTS, closeEnough, defaults, type Experiment, type Point, type Trial } from '../sim/experiments';

// The Dojo: one obstacle at a time. Change the knobs, guess what will happen, run it, see how close you were.
// Sayings are earned (three close guesses at different settings), never handed out; no formulas on screen.
const KEY = 'cc.dojo.v1';
interface Save { earned: string[]; close: Record<string, string[]> }
function load(): Save {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '') as Save; } catch { return { earned: [], close: {} }; }
}
function store(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: keep going */ } }

export function startDojo(host: HTMLElement): { backend: 'webgl2' } {
  const save = load();
  const style = document.createElement('style');
  style.textContent = `
    .dojo{font:16px/1.4 system-ui,sans-serif;color:#17201d;background:#eef1ec;min-height:100%;padding:16px;display:grid;gap:14px;max-width:1100px;margin:0 auto}
    .dojo h1{margin:0;font-size:24px}.dojo .tabs{display:flex;flex-wrap:wrap;gap:8px}
    .dojo button{font:inherit;border:1px solid #b9c2bb;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
    .dojo button[aria-pressed=true]{background:#17201d;color:#fff}.dojo .go{background:#0f6b5c;color:#fff;border-color:#0f6b5c;font-weight:700}
    .dojo .row{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px}@media(max-width:800px){.dojo .row{grid-template-columns:1fr}}
    .dojo canvas{width:100%;height:auto;background:#fff;border:1px solid #cfd6d0;border-radius:10px}
    .dojo .panel{background:#fff;border:1px solid #cfd6d0;border-radius:10px;padding:12px;display:grid;gap:10px;align-content:start}
    .dojo label{display:grid;gap:2px;font-size:14px}.dojo input[type=range]{width:100%}
    .dojo .result{border-left:4px solid #0f6b5c;padding:6px 10px;background:#f3f7f4}.dojo .saying{font-size:18px;font-style:italic;border-left:4px solid #c9893b;padding:6px 10px;background:#fbf4e8}
    .dojo .muted{color:#58635d;font-size:14px}`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'dojo';
  host.appendChild(root);

  let exp: Experiment = EXPERIMENTS.find((e) => e.id === new URLSearchParams(location.search).get('ex')) ?? EXPERIMENTS[0];
  let values = defaults(exp);
  let guess = exp.answerMax / 2;
  let last: Trial | null = null;
  let ghost: Trial | null = null;
  let lastGuess: number | null = null;

  const el = <T extends HTMLElement>(tag: string, parent: HTMLElement, props: Partial<T> & { text?: string } = {}): T => {
    const e = document.createElement(tag) as T;
    if (props.text) e.textContent = props.text;
    Object.assign(e, { ...props, text: undefined });
    parent.appendChild(e);
    return e;
  };

  function render() {
    root.innerHTML = '';
    el('h1', root, { text: 'The Dojo' });
    el('p', root, { className: 'muted', text: 'Train slow. Pick an obstacle, change what you like, guess what will happen, then run it.' });
    const tabs = el('div', root, { className: 'tabs' });
    for (const e of EXPERIMENTS) {
      const b = el<HTMLButtonElement>('button', tabs, { text: e.name + (save.earned.some((s) => e.sayings.includes(s)) ? ' ★' : '') });
      b.setAttribute('aria-pressed', String(e === exp));
      b.onclick = () => { exp = e; values = defaults(e); guess = e.answerMax / 2; last = null; ghost = null; lastGuess = null; render(); };
    }
    const row = el('div', root, { className: 'row' });
    const canvas = el<HTMLCanvasElement>('canvas', row, { width: 760, height: 440 });
    const panel = el('div', row, { className: 'panel' });
    el('strong', panel, { text: 'What you can change' });
    for (const k of exp.knobs) {
      const l = el<HTMLLabelElement>('label', panel);
      const span = el('span', l, { text: `${k.label}: ${values[k.id].toFixed(k.step < 0.1 ? 2 : 1)} ${k.unit}` });
      const r = el<HTMLInputElement>('input', l, { type: 'range', id: 'knob-' + k.id, min: String(k.min), max: String(k.max), step: String(k.step), value: String(values[k.id]) });
      r.oninput = () => { values[k.id] = Number(r.value); span.textContent = `${k.label}: ${values[k.id].toFixed(k.step < 0.1 ? 2 : 1)} ${k.unit}`; };
    }
    el('strong', panel, { text: exp.question });
    const gl = el<HTMLLabelElement>('label', panel);
    const gs = el('span', gl, { text: `Your guess: ${guess.toFixed(1)} ${exp.answerUnit}` });
    const gr = el<HTMLInputElement>('input', gl, { type: 'range', id: 'guess', min: '0', max: String(exp.answerMax), step: '0.1', value: String(guess) });
    gr.oninput = () => { guess = Number(gr.value); gs.textContent = `Your guess: ${guess.toFixed(1)} ${exp.answerUnit}`; draw(canvas); };
    const go = el<HTMLButtonElement>('button', panel, { text: 'Run it', className: 'go', id: 'run' });
    go.onclick = () => runIt(panel, canvas);
    const out = el('div', panel, { id: 'out' });
    if (last) showResult(out);
    el('div', root, { className: 'muted', text: `Sayings collected: ${save.earned.length} of ${EXPERIMENTS.reduce((n, e) => n + e.sayings.length, 0)}` });
    if (save.earned.length) {
      const cab = el('div', root, { className: 'panel', id: 'cabinet' });
      el('strong', cab, { text: 'Trophy cabinet' });
      save.earned.forEach((s) => el('div', cab, { className: 'saying', text: s }));
    }
    draw(canvas);
  }

  function showResult(out: HTMLElement) {
    out.innerHTML = '';
    if (!last || lastGuess === null) return;
    const close = closeEnough(lastGuess, last.answer);
    el('div', out, { className: 'result', text: `You guessed ${lastGuess.toFixed(1)} ${exp.answerUnit}. It was ${last.answer.toFixed(1)} ${exp.answerUnit}. ${close ? 'Close!' : 'Not quite, so change something and try again.'} ${last.note ?? ''}` });
    const n = save.close[exp.id]?.length ?? 0;
    if (close && n < 3) el('div', out, { className: 'muted', text: `Close guesses at different settings: ${n} of 3.` });
    const fresh = save.earned.filter((s) => exp.sayings.includes(s));
    if (n >= 3 && fresh.length) fresh.forEach((s) => el('div', out, { className: 'saying', text: s }));
  }

  function runIt(panel: HTMLElement, canvas: HTMLCanvasElement) {
    ghost = last;
    last = exp.run(values);
    lastGuess = guess;
    if (closeEnough(guess, last.answer)) {
      const sig = JSON.stringify(values);
      const list = (save.close[exp.id] ??= []);
      if (!list.includes(sig)) list.push(sig);
      if (list.length >= 3) for (const s of exp.sayings) if (!save.earned.includes(s)) save.earned.push(s);
      store(save);
    }
    render();
    void panel; void canvas;
  }

  function draw(canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d');
    if (!c) return;
    const W = canvas.width, H = canvas.height, pad = 36;
    c.clearRect(0, 0, W, H);
    const paths: Point[][] = [last?.path ?? [], ghost?.path ?? []];
    const all = paths.flat();
    const maxX = Math.max(exp.axis === 'x' ? exp.answerMax : 6, ...all.map((p) => p.x), 1);
    const maxY = Math.max(exp.axis === 'y' ? exp.answerMax : 4, ...all.map((p) => p.y), 1);
    const sx = (x: number) => pad + (x / maxX) * (W - 2 * pad);
    const sy = (y: number) => H - pad - (y / maxY) * (H - 2 * pad);
    c.strokeStyle = '#9aa59e'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(pad, sy(0)); c.lineTo(W - pad, sy(0)); c.stroke();
    c.fillStyle = '#58635d'; c.font = '13px system-ui';
    for (let m = 0; m <= maxX; m += Math.max(1, Math.round(maxX / 8))) { c.fillText(`${m}`, sx(m) - 4, sy(0) + 16); }
    for (let m = 0; m <= maxY; m += Math.max(1, Math.round(maxY / 6))) { c.fillText(`${m}`, 6, sy(m) + 4); }
    // the guess marker
    c.strokeStyle = '#c9893b'; c.setLineDash([6, 5]); c.lineWidth = 2;
    c.beginPath();
    if (exp.axis === 'x') { c.moveTo(sx(guess), sy(0)); c.lineTo(sx(guess), pad); } else { c.moveTo(pad, sy(guess)); c.lineTo(W - pad, sy(guess)); }
    c.stroke(); c.setLineDash([]);
    c.fillStyle = '#c9893b'; c.fillText('your guess', exp.axis === 'x' ? sx(guess) + 4 : W - pad - 70, exp.axis === 'x' ? pad + 12 : sy(guess) - 6);
    const line = (pts: Point[], color: string, dash: number[]) => {
      if (pts.length < 2) return;
      c.strokeStyle = color; c.lineWidth = 3; c.setLineDash(dash);
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(sx(p.x), sy(p.y)) : c.moveTo(sx(p.x), sy(p.y)))); c.stroke(); c.setLineDash([]);
    };
    line(ghost?.path ?? [], '#9aa59e', [4, 4]);
    line(last?.path ?? [], '#0f6b5c', []);
    if (exp.id === 'gap') {
      c.fillStyle = '#2f7fc1'; c.fillRect(sx(0), sy(0), sx(5.5) - sx(0), 10);
      c.fillStyle = '#17201d'; c.fillText('water', sx(2), sy(0) + 28); c.fillText('far side', sx(5.5), sy(0) - 8);
    }
  }

  render();
  return { backend: 'webgl2' };
}
