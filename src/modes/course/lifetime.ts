// Resources belong to one course, even though the document and renderer outlive it.
export class CourseLifetime {
  readonly controller = new AbortController();
  readonly cleanups: (() => void)[] = [];
  get closed(): boolean { return this.controller.signal.aborted; }
  own(cleanup: () => void): void { if (this.closed) cleanup(); else this.cleanups.push(cleanup); }
  close(): void {
    if (this.closed) return;
    this.controller.abort();
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try { cleanup(); } catch (e) { console.warn('Course cleanup failed', e); }
    }
  }
  watchDOM(doc: Document): void {
    const before = new Set<Node>([...doc.body.childNodes, ...doc.head.childNodes]);
    const owned = new Set<Node>();
    const collect = (records: MutationRecord[]) => { for (const r of records) for (const n of r.addedNodes) if (!before.has(n)) owned.add(n); };
    const observer = new MutationObserver(collect);
    observer.observe(doc.body, { childList: true }); observer.observe(doc.head, { childList: true });
    this.own(() => {
      collect(observer.takeRecords()); observer.disconnect();
      for (const n of owned) {
        // Shared app chrome and keyed style sheets outlive individual courses.
        if (n instanceof Element && (n.hasAttribute('data-course-persistent') || (n.tagName === 'STYLE' && n.id))) continue;
        n.parentNode?.removeChild(n);
      }
    });
  }
}
let active: CourseLifetime | null = null;
export const courseLifetime = (): CourseLifetime | null => active;
export const activateCourse = (life: CourseLifetime): void => { active = life; };
export function courseListen<K extends keyof WindowEventMap>(target: EventTarget, type: K, listener: (event: WindowEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
export function courseListen(target: EventTarget, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void;
export function courseListen(target: EventTarget, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void {
  const life = active;
  if (life?.closed) return;
  const opts = typeof options === 'boolean' ? { capture: options } : options;
  target.addEventListener(type, listener, { ...opts, ...(life ? { signal: life.controller.signal } : {}) });
}
export function courseTimeout(fn: () => void, ms: number): number {
  const life = active;
  const id = window.setTimeout(() => { if (!life?.closed) fn(); }, ms);
  life?.own(() => clearTimeout(id)); return id;
}
export function courseInterval(fn: () => void, ms: number): number {
  const id = window.setInterval(fn, ms); active?.own(() => clearInterval(id)); return id;
}
export function courseObserve(observer: ResizeObserver, node: Element): void {
  observer.observe(node); active?.own(() => observer.disconnect());
}
