// The picked regions on a photo (CC-248): the list, and what the keys do to it. Pure state, so the keys are tested without a browser.
// A region is a box in photo pixels with a name; the clipboard keeps copies so Ctrl+V can drop them a little to the side.
export interface Region { id: number; box: [number, number, number, number]; label: string; source: 'suggested' | 'manual' }

export class Regions {
  list: Region[] = [];
  selected = new Set<number>();
  private clip: Region[] = [];
  private undoStack: Region[][] = [];
  private next = 1;
  constructor(private width: number, private height: number) {}

  private snap(): void { this.undoStack.push(this.list.map((r) => ({ ...r, box: [...r.box] as Region['box'] }))); if (this.undoStack.length > 50) this.undoStack.shift(); }
  private clamp(b: Region['box']): Region['box'] {
    const w = b[2] - b[0], h = b[3] - b[1];
    const x0 = Math.min(Math.max(b[0], 0), Math.max(0, this.width - w)), y0 = Math.min(Math.max(b[1], 0), Math.max(0, this.height - h));
    return [Math.round(x0), Math.round(y0), Math.round(x0 + Math.min(w, this.width)), Math.round(y0 + Math.min(h, this.height))];
  }

  add(box: Region['box'], label = '', source: Region['source'] = 'manual'): Region {
    this.snap();
    const r: Region = { id: this.next++, box: this.clamp(box), label, source };
    this.list.push(r); this.selected = new Set([r.id]);
    return r;
  }
  /** Clicking a suggested outline picks it; clicking it again drops it. */
  toggle(id: number, several = false): void {
    if (!several) { this.selected = new Set(this.selected.has(id) && this.selected.size === 1 ? [] : [id]); return; }
    if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
  }
  move(id: number, dx: number, dy: number): void {
    const r = this.list.find((x) => x.id === id); if (!r) return;
    this.snap(); r.box = this.clamp([r.box[0] + dx, r.box[1] + dy, r.box[2] + dx, r.box[3] + dy]);
  }
  resize(id: number, box: Region['box']): void {
    const r = this.list.find((x) => x.id === id); if (!r) return;
    this.snap(); r.box = this.clamp([Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])]);
  }
  rename(id: number, label: string): void { const r = this.list.find((x) => x.id === id); if (r) r.label = label; }
  remove(): void {
    if (!this.selected.size) return;
    this.snap(); this.list = this.list.filter((r) => !this.selected.has(r.id)); this.selected.clear();
  }
  copy(): void { this.clip = this.list.filter((r) => this.selected.has(r.id)).map((r) => ({ ...r, box: [...r.box] as Region['box'] })); }
  paste(): Region[] {
    if (!this.clip.length) return [];
    this.snap();
    const off = Math.max(12, Math.round(this.width * 0.02));
    const made = this.clip.map((c) => ({ ...c, id: this.next++, source: 'manual' as const, box: this.clamp([c.box[0] + off, c.box[1] + off, c.box[2] + off, c.box[3] + off]) }));
    this.clip = made.map((r) => ({ ...r, box: [...r.box] as Region['box'] })); // the next paste steps on again
    this.list.push(...made); this.selected = new Set(made.map((r) => r.id));
    return made;
  }
  undo(): void { const prev = this.undoStack.pop(); if (prev) { this.list = prev; this.selected = new Set([...this.selected].filter((id) => prev.some((r) => r.id === id))); } }
  selectAll(): void { this.selected = new Set(this.list.map((r) => r.id)); }

  /** The keys: Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+A, Delete or Backspace, arrows nudge. Returns true when the key was used. */
  key(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): boolean {
    const mod = !!(e.ctrlKey || e.metaKey), k = e.key.toLowerCase();
    if (mod && k === 'c') { this.copy(); return true; }
    if (mod && k === 'v') { this.paste(); return true; }
    if (mod && k === 'z') { this.undo(); return true; }
    if (mod && k === 'a') { this.selectAll(); return true; }
    if (!mod && (k === 'delete' || k === 'backspace')) { this.remove(); return true; }
    const step = e.shiftKey ? 10 : 2, d = ({ arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] } as Record<string, [number, number]>)[k];
    if (!mod && d && this.selected.size) { for (const id of this.selected) this.move(id, d[0], d[1]); return true; }
    return false;
  }
}
