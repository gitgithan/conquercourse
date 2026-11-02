import type { CourseData } from '../../course/course';
import type { Shortcut } from '../../sim/shortcuts';

// Shortcuts: routes the designer did not plan (src/sim/shortcuts.ts). Stored with a demo course, or worked out on first request in a worker.
export interface ShortcutList {
  list(): Shortcut[] | null; // null until known
  ensure(): Promise<Shortcut[]>;
}

export function createShortcutList(course: CourseData): ShortcutList {
  let shortcuts: Shortcut[] | null = course.shortcuts ?? null, shortcutWorker: Worker | null = null, shortcutAsk: Promise<Shortcut[]> | null = null;
  function ensure(): Promise<Shortcut[]> {
    if (shortcuts) return Promise.resolve(shortcuts);
    shortcutAsk ??= new Promise<Shortcut[]>((resolve) => {
      try {
        shortcutWorker ??= new Worker(new URL('../../sim/shortcuts-worker.ts', import.meta.url), { type: 'module' });
        const w = shortcutWorker;
        w.onmessage = (e: MessageEvent) => { shortcuts = (e.data.shortcuts as Shortcut[]) ?? []; resolve(shortcuts); };
        w.postMessage({ course });
      } catch { shortcuts = []; resolve(shortcuts); } // no worker here: no shortcut list
    });
    return shortcutAsk;
  }
  return { list: () => shortcuts, ensure };
}
