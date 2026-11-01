// Cuts a picked box out of the person's photo for a piece's small picture (kept from the wallpaper code, CC-249, which is gone).
/** Cuts the box out of the photo (photo pixels) and returns a JPEG data address no wider than 640 px. */
export async function cropToThumb(photo: string, box: [number, number, number, number]): Promise<string> {
  const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('The photo would not open.')); i.src = photo; });
  const w = box[2] - box[0], h = box[3] - box[1], k = Math.min(1, 640 / w);
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) });
  c.getContext('2d')!.drawImage(img, box[0], box[1], w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
