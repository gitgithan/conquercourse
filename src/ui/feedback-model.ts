// The feedback form's rules in one pure place (no page needed), so a test can walk every case.
// The card in feedback-card.ts only draws what this file decides. The server (functions/api/submit.ts) repeats the same limits.

export const KINDS = ['broke', 'confusing', 'idea', 'loved'] as const;
export type Kind = typeof KINDS[number];

export const KIND_INFO: Record<Kind, { label: string; hint: string; prompt: string; placeholder: string }> = {
  broke: { label: 'Something broke', hint: 'A bug, a freeze, a wrong result', prompt: 'What did you press, and what did you expect to happen?', placeholder: 'I pressed ... and expected ... but ...' },
  confusing: { label: 'Something was confusing', hint: 'You did not know what to do', prompt: 'What were you trying to do, and what made you stop?', placeholder: 'I wanted to ... but I could not tell ...' },
  idea: { label: 'I have an idea', hint: 'A thing we could add or change', prompt: 'What would you like to be able to do?', placeholder: 'It would be great if ...' },
  loved: { label: 'I loved something', hint: 'Tell us what worked', prompt: 'What was the best part?', placeholder: 'My favourite part was ...' },
};

/** Screens that get the one-tap "Was this clear?" row. */
export const CLEAR_SCREENS = ['course', 'dojo', 'labs', 'editor', 'slicer', 'parts'] as const;
export const WHY_CHIPS = ['Too fast', 'Too many steps', 'The words were unclear', 'I could not find the button', 'It looked broken', 'Something else'] as const;
export type Why = typeof WHY_CHIPS[number];

export const LIMITS = { text: 1000, where: 80, context: 60, rating: 5 } as const;
export const ROUND = 'quick-1';
/** The only context lines the form may attach; the server drops any other key. */
export const CONTEXT_KEYS = ['screen', 'browser', 'window', 'world', 'character', 'last_run', 'replay'] as const;
export type ContextKey = typeof CONTEXT_KEYS[number];
export const CONTEXT_LABEL: Record<ContextKey, string> = {
  screen: 'Screen', browser: 'Browser', window: 'Window size', world: 'Course or world', character: 'Character', last_run: 'Your last run', replay: 'Seed or run code',
};

const SCREEN_LABEL: Record<string, string> = {
  welcome: 'Welcome screen', course: 'Course', dojo: 'Dojo', editor: 'World Editor', map: 'World Slicer', parts: 'Parts', coaster: 'Coaster builder',
  communities: 'Community', gallery: 'Community', park: 'Community', rookie: 'Rookie demo', diagrams: 'Diagrams',
};
export const screenLabel = (mode: string): string => SCREEN_LABEL[mode] ?? (mode.startsWith('lab-') ? `Lab: ${mode.slice(4)}` : mode.slice(0, 20) || 'Course');
/** The key used for "Was this clear?" (labs share one key). */
export const screenKey = (mode: string): string => (mode.startsWith('lab-') ? 'labs' : mode === 'map' ? 'slicer' : mode);
export const asksClear = (mode: string): boolean => (CLEAR_SCREENS as readonly string[]).includes(screenKey(mode));

export const clip = (v: unknown, n: number): string => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

/** A short browser name and the window size; no user-agent string, no device id. */
export function browserName(ua: string): string {
  const m = /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(ua);
  const name = !m ? 'Browser' : m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1] === 'Version' ? 'Safari' : m[1];
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return clip(`${name}${m ? ' ' + m[2] : ''}${os ? ' on ' + os : ''}`, LIMITS.context);
}

export interface Notes { lastRun?: string; replay?: string }
const notes: Notes = {};
let running = false;
const listeners = new Set<() => void>();
/** A mode tells the form about its last run ("Cleared in 12.4 s") and a run or seed code; both stay in memory only. */
export function noteRun(o: Notes): void { Object.assign(notes, o); }
export const readNotes = (): Notes => ({ ...notes });
/** The Course says when a run is going, so the button hides and never steals a key. */
export function noteRunning(on: boolean): void { if (on === running) return; running = on; listeners.forEach((f) => f()); }
export const isRunning = (): boolean => running;
export function onRunningChange(f: () => void): () => void { listeners.add(f); return () => listeners.delete(f); }

export interface ContextItem { key: ContextKey; label: string; value: string; on: boolean }
export interface PageFacts { mode: string; params: URLSearchParams; ua: string; width: number; height: number; worldLabel?: string }

/** Every line the form could attach, each ticked by default and only when there is something to say. */
export function buildContext(f: PageFacts, n: Notes = readNotes()): ContextItem[] {
  const p = f.params;
  const course = p.get('course') ?? (p.has('generate') ? `generated course, seed ${p.get('generate')}` : p.has('coaster') ? 'coaster' : p.get('cid') ? `challenge ${p.get('cid')}` : '');
  const world = f.worldLabel || course.replace(/^\/assets\//, '').replace(/\.course\.json$/, '');
  const seed = p.get('generate');
  const raw: [ContextKey, string][] = [
    ['screen', screenLabel(f.mode)],
    ['browser', browserName(f.ua)],
    ['window', `${Math.round(f.width)} x ${Math.round(f.height)}`],
    ['world', world],
    ['character', p.get('rk') ? `Rookie ${p.get('rk')!.slice(0, 1).toUpperCase()}` : ''],
    ['last_run', n.lastRun ?? ''],
    ['replay', n.replay ?? (seed ? `seed ${seed}` : '')],
  ];
  return raw.filter(([, v]) => v).map(([key, v]) => ({ key, label: CONTEXT_LABEL[key], value: clip(v, LIMITS.context), on: true }));
}

export interface FormState {
  kind: Kind | null; where: string; text: string; rating: number | null;
  clear: 'yes' | 'no' | null; why: Why | null; context: ContextItem[];
}
export const emptyState = (context: ContextItem[], where: string): FormState => ({ kind: null, where, text: '', rating: null, clear: null, why: null, context });

export interface Payload { round: string; v: 2; session: string; build: string; mode: string; website: string; answers: Record<string, string | number>; context: Record<string, string> }

/** The exact body sent to /api/submit; the "What gets sent" box shows this very object. */
export function buildPayload(s: FormState, o: { session: string; build: string; mode: string; trap?: string }): Payload {
  const answers: Record<string, string | number> = {};
  if (s.kind) answers.kind = s.kind;
  const where = clip(s.where, LIMITS.where); if (where) answers.where = where;
  const text = clip(s.text, LIMITS.text); if (text) answers.text = text;
  if (s.rating && s.rating >= 1 && s.rating <= LIMITS.rating) answers.rating = Math.round(s.rating);
  if (s.clear) { answers.clear = s.clear; if (s.clear === 'no' && s.why) answers.why = s.why; }
  const context: Record<string, string> = {};
  for (const c of s.context) if (c.on && (CONTEXT_KEYS as readonly string[]).includes(c.key)) context[c.key] = clip(c.value, LIMITS.context);
  return { round: ROUND, v: 2, session: o.session, build: clip(o.build, 40), mode: clip(o.mode, 20), website: o.trap ?? '', answers, context };
}

/** True when there is something worth sending (a kind, some words, a rating or a clear answer). */
export const canSend = (s: FormState): boolean => !!s.kind || !!s.text.trim() || !!s.rating || !!s.clear;

/** The lines of the "What gets sent" box. */
export function sentLines(p: Payload): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(p.answers)) out.push(`${k}: ${v}`);
  for (const [k, v] of Object.entries(p.context)) out.push(`${k}: ${v}`);
  out.push(`build: ${p.build}`, 'A random code made in this browser (not your name) tells two sends from one player apart.');
  return out;
}
