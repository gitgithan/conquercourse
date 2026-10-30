import { agentTestInWorker } from '../slice/proof-client';
import { firstAsk, obstacleCount, runAgent, STEP_CAP, type AgentResult, type Ask, type Message, type Step } from '../slice/course-agent';
import type { Layout } from '../slice/photo-course';
import { pageSearch } from '../flags';

// The Course Agent in the editor (labs, ?agent=1): a photo goes in, the player watches each step (proposed, tested, repaired, tested) as it happens,
// and the editor gets the layout the simulator proved, or the best attempt it tested with the reason it stopped. Nothing here grades a person.
export const agentOn = (): boolean => /[?&]agent\b/.test(pageSearch()) || /[?&]labs\b/.test(pageSearch());

async function photoDataUrl(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file), k = Math.min(1, 768 / bmp.width);
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export const stepLine = (s: Step): string => `${s.n}. ${s.kind === 'proposed' ? 'Proposed' : 'Repaired'}: ${s.say || 'a new layout.'} Tested: ${s.words}`;
export function endLine(r: AgentResult): string {
  if (r.status === 'cleared') return `Done in ${r.steps.length} step${r.steps.length === 1 ? '' : 's'}: the simulator proved this course can be cleared.`;
  if (r.status === 'no-layout') return 'I could not get a course from the helper this time. Nothing was changed.';
  const best = r.report!;
  return `I stopped after ${r.steps.length} steps and could not prove this course. The best attempt got ${Math.round(best.reachedMetres * 10) / 10} m of ${Math.round(best.laneMetres * 10) / 10} m. I kept that one so you can edit it by hand.`;
}

export interface AgentUi { trace: HTMLElement; apply: (layout: Layout) => void }

export async function runCourseAgent(file: Blob, ui: AgentUi): Promise<AgentResult> {
  const root = document.documentElement;
  ui.trace.replaceChildren();
  const add = (text: string, className = ''): HTMLElement => { const li = document.createElement('li'); li.textContent = text; li.className = className; ui.trace.appendChild(li); return li; };
  root.dataset.courseAgent = 'running';
  let image = '';
  try { image = await photoDataUrl(file); } catch { add('I could not read that photo.', 'bad'); root.dataset.courseAgent = 'error'; return { status: 'no-layout', layout: null, report: null, steps: [], problems: ['unreadable photo'] }; }
  const live: { el: HTMLElement | null } = { el: null };
  const clearLive = () => { live.el?.remove(); live.el = null; };
  const note = (text: string) => { clearLive(); live.el = add(text, 'muted'); };
  const ask: Ask = async (messages: Message[]) => {
    try {
      const first = messages.length === 1 && messages[0].content === firstAsk();
      const r = await fetch('/api/course-agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(first ? { image, messages } : { messages }) });
      const d = (await r.json()) as { reply?: string; error?: string };
      return r.ok && d.reply ? d.reply : null;
    } catch { return null; }
  };
  const result = await runAgent(ask, (layout) => agentTestInWorker(layout), {
    cap: STEP_CAP,
    onEvent: (e) => {
      if (e.type === 'asking') note(e.repair ? 'Asking for a repair from the simulator’s report…' : 'Looking at the photo…');
      else if (e.type === 'testing') note('Testing it with the simulator…');
      else { clearLive(); add(stepLine(e.step), e.step.report.cleared ? 'ok' : ''); }
    },
  });
  clearLive();
  for (const p of result.problems) add(p, 'muted');
  add(endLine(result), result.status === 'cleared' ? 'ok' : 'bad');
  if (result.layout) ui.apply(result.layout);
  root.dataset.courseAgent = result.status;
  root.dataset.courseAgentSteps = String(result.steps.length);
  root.dataset.courseAgentObstacles = String(obstacleCount(result.layout));
  return result;
}
