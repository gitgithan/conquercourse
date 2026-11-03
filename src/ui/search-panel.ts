import { createEta } from '../modes/course/search-eta';

// The progress panel for a live ideal-run search (CC-133): title, what it is looking at, a bar, the time left and a Cancel button.
export interface SearchPanelHandle {
  note(label: string, step: number, of: number): void;
  done(cleared: boolean): void; // finished: hides at once, or says plainly that no way through was found
  close(): void; // cancelled or failed
}

const css = 'position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:60;width:min(420px,calc(100vw - 32px));box-sizing:border-box;display:grid;gap:6px;padding:12px 14px;border-radius:10px;background:rgba(23,32,29,.92);color:#fff;font:14px/1.35 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35)';

export function openSearchPanel(onCancel: () => void, now: () => number = () => performance.now()): SearchPanelHandle {
  document.getElementById('search-progress')?.remove();
  const box = document.createElement('div'); box.id = 'search-progress'; box.style.cssText = css; box.setAttribute('role', 'status');
  const title = document.createElement('strong'); title.textContent = 'Working out the best run for your course'; title.style.fontSize = '15px';
  const line = document.createElement('span'); line.id = 'search-line'; line.textContent = 'Getting ready…';
  const track = document.createElement('div'); track.style.cssText = 'height:8px;border-radius:4px;background:rgba(255,255,255,.22);overflow:hidden';
  track.setAttribute('role', 'progressbar'); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100'); track.setAttribute('aria-valuenow', '0');
  const fill = document.createElement('div'); fill.id = 'search-fill'; fill.style.cssText = 'height:100%;width:2%;background:#5fd6bd;transition:width .4s ease'; track.append(fill);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px';
  const eta = document.createElement('span'); eta.id = 'search-eta'; eta.style.opacity = '.85'; eta.textContent = 'a few seconds left';
  const cancel = document.createElement('button'); cancel.id = 'search-cancel'; cancel.textContent = 'Cancel';
  cancel.style.cssText = 'font:inherit;border:1px solid #fff;background:transparent;color:#fff;border-radius:8px;padding:3px 12px;cursor:pointer';
  cancel.onclick = () => { onCancel(); box.remove(); }; // hides at once; the search stops at its next batch
  row.append(eta, cancel); box.append(title, line, track, row); document.body.append(box);
  const calc = createEta(); let timer = 0, last = { step: 1, of: 1 };
  const refresh = () => { const v = calc.note(last.step, last.of, now()); fill.style.width = `${Math.max(2, Math.round(v.fraction * 100))}%`; track.setAttribute('aria-valuenow', String(Math.round(v.fraction * 100))); eta.textContent = v.text; };
  return {
    note(label, step, of) { last = { step, of }; line.textContent = `Looking at: ${label} (${step} of ${of})`; refresh(); },
    done(cleared) {
      window.clearTimeout(timer);
      if (cleared) { box.remove(); return; }
      title.textContent = 'No way through was found'; line.textContent = 'This course could not be cleared, so there is no best run to show.';
      track.remove(); eta.textContent = ''; cancel.textContent = 'Close'; cancel.onclick = () => box.remove();
      timer = window.setTimeout(() => box.remove(), 7000);
    },
    close() { window.clearTimeout(timer); box.remove(); },
  };
}
