// A picture behind every course, kept only in this browser (CC-249). Nothing here is ever sent anywhere.
// Pure helpers take the storage as an argument, so a test can pass a fake one; the picture work needs a page.
export const BG_KEY = 'cc.background';
export const BG_W = 1600, BG_H = 900; // stored at the course's 16:9 look, so the scene never stretches it
export const BG_MAX_CHARS = 900_000; // a 1600 x 900 JPEG is about 150 to 400 KB; the browser's storage is about 5 MB
export const backgroundOn = (params: URLSearchParams): boolean => params.get('background') !== '0';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const here = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export const savedBackground = (s: Store | null = here()): string | null => {
  try { const v = s?.getItem(BG_KEY) ?? ''; return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= BG_MAX_CHARS ? v : null; } catch { return null; }
};
/** True when the picture was kept; false when the browser had no room or the picture is too big. */
export const keepBackground = (dataUrl: string, s: Store | null = here()): boolean => {
  if (!s || dataUrl.length > BG_MAX_CHARS || !/^data:image\/jpeg;base64,/.test(dataUrl)) return false;
  try { s.setItem(BG_KEY, dataUrl); return true; } catch { return false; }
};
export const removeBackground = (s: Store | null = here()): void => { try { s?.removeItem(BG_KEY); } catch { /* nothing kept */ } };

/** The centre of the picture, cut to 16:9 and no wider than 1600 px, as a JPEG data address. */
export async function shrinkToBackground(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('That picture would not open. Try a JPEG or PNG.')); i.src = url; });
    const want = BG_W / BG_H, have = img.naturalWidth / img.naturalHeight;
    const sw = have > want ? img.naturalHeight * want : img.naturalWidth, sh = have > want ? img.naturalHeight : img.naturalWidth / want;
    const c = Object.assign(document.createElement('canvas'), { width: BG_W, height: BG_H });
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, BG_W, BG_H);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

/** A small popover under the button: choose a picture, or take it away. Nothing leaves the browser. */
export function openBackgroundMenu(anchor: HTMLElement, repaint: () => void): void {
  document.getElementById('bgmenu')?.remove();
  const box = document.createElement('div');
  box.id = 'bgmenu';
  const r = anchor.getBoundingClientRect();
  box.style.cssText = `position:fixed;z-index:30;left:${Math.max(8, r.right - 260)}px;top:${r.bottom + 6}px;width:260px;padding:10px;background:#101820ee;color:#fff;border:1px solid #fff4;border-radius:8px;font:13px system-ui;display:grid;gap:8px`;
  const say = document.createElement('div');
  say.textContent = savedBackground() ? 'Your picture is behind every course.' : 'Pick a picture to put behind every course.';
  const note = document.createElement('div');
  note.textContent = 'It stays in this browser only. It is never uploaded.';
  note.style.opacity = '.7';
  const file = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  const mk = (text: string, on: () => void) => { const b = document.createElement('button'); b.textContent = text; b.onclick = on; return b; };
  const choose = mk('Choose picture', () => file.click());
  const remove = mk('Remove background', () => { removeBackground(); repaint(); box.remove(); });
  remove.hidden = !savedBackground();
  file.onchange = async () => {
    const f = file.files?.[0]; if (!f) return;
    try {
      say.textContent = 'Working…';
      const ok = keepBackground(await shrinkToBackground(f));
      if (!ok) { say.textContent = 'This browser has no room to keep that picture.'; return; }
      repaint(); box.remove();
    } catch (e) { say.textContent = (e as Error).message; }
  };
  const close = mk('Close', () => box.remove());
  box.append(say, note, choose, remove, close, file);
  document.body.append(box);
}
