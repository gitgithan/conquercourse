// Time left for a live ideal-run search (CC-133). Pure: the caller passes the clock, so a test can play any run.
// The search reports "step N of M" as each obstacle starts; the steps are uneven (a bars stage takes far longer than a step), so the guess blends
// the average of all finished steps with a quick-moving average of the latest ones, is smoothed so the number does not jump, and is said in plain, rounded words.
export interface EtaView { fraction: number; seconds: number | null; text: string }

const FEW = 'a few seconds left', LONGER = 'a little longer';

export function etaText(seconds: number | null): string {
  if (seconds === null) return FEW;
  if (seconds > 60) return 'more than a minute left';
  if (seconds < 6) return FEW;
  const step = seconds > 30 ? 10 : 5; // never more precision than the guess has
  return `about ${Math.round(seconds / step) * step} s left`;
}

export function createEta() {
  let fraction0 = 0, lastNow = 0, t0 = -1, lastStep = 0, stepStart = 0, recent = 0, shown: number | null = null;
  let completedAtStart = 0;
  return {
    // `step` is the obstacle being worked on (1-based), `of` how many there are; `nowMs` the clock
    note(step: number, of: number, nowMs: number): EtaView {
      if (t0 < 0) { t0 = nowMs; lastNow = nowMs; stepStart = nowMs; lastStep = step; completedAtStart = step - 1; }
      if (step > lastStep) { // one or more steps finished since the last note
        const done = step - lastStep, each = (nowMs - stepStart) / done;
        recent = recent === 0 ? each : recent * 0.6 + each * 0.4;
        lastStep = step; stepStart = nowMs;
      }
      const total = Math.max(1, of), completed = Math.max(0, Math.min(total, step - 1));
      const elapsed = nowMs - t0, measured = completed - completedAtStart, inStep = nowMs - stepStart;
      // the bar creeps through the step in hand (never to the end of it), so a single long step still shows life
      const within = measured >= 1 ? Math.min(0.9, inStep / (((stepStart - t0) / measured + (recent || 0)) / (recent ? 2 : 1))) : 0.85 * (1 - Math.exp(-elapsed / 20000));
      const fraction = Math.max(fraction0, Math.min(1, (completed + within) / total)); fraction0 = fraction;
      if (measured < 1 || elapsed < 2500) return { fraction, seconds: null, text: elapsed >= 10000 ? LONGER : FEW }; // nothing finished yet: no number
      const mean = (stepStart - t0) / measured, per = (mean + (recent || mean)) / 2;
      const left = total - completed - 1; // whole steps still to come after this one
      let raw = left * per + Math.max(per - inStep, per * 0.25); // a step that runs long still has a little left
      raw = Math.max(0, raw) / 1000;
      const dt = Math.max(0, nowMs - lastNow) / 1000; lastNow = nowMs;
      const smooth = shown === null ? raw : shown * 0.6 + raw * 0.4; // smooth, and slow to move: the number rises at most 3 s and falls at most 4 s per second, so it never jumps
      shown = shown === null ? smooth : Math.min(shown + 3 * dt, Math.max(shown - 4 * dt, smooth));
      return { fraction, seconds: shown, text: etaText(shown) };
    },
  };
}
