// A short clip of a run (CC-129). The run is played again from its keys on a stepped clock (one picture for every four ticks),
// so the clip is the same whatever the speed of the computer. Pictures go to the browser's own video encoder and into an mp4 file.
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export const CLIP_W = 720;
export const CLIP_H = 1280;
export const CLIP_FPS = 30;
export const TICKS_PER_FRAME = 4; // 120 ticks a second / 30 pictures a second
export const TAIL_FRAMES = 45; // hold the last picture for one and a half seconds
export const MAX_CLIP_FRAMES = CLIP_FPS * 20 + TAIL_FRAMES;

/** How many pictures a run of this many ticks makes (the run, then the tail). */
export const clipFrames = (ticks: number): number => Math.ceil(ticks / TICKS_PER_FRAME) + TAIL_FRAMES;
/** A run that would make a clip longer than about 20 seconds is not offered a clip. */
export const clipFits = (ticks: number): boolean => clipFrames(ticks) <= MAX_CLIP_FRAMES;

const CODECS: { codec: string; mux: 'avc' | 'vp9' | 'av1' }[] = [
  { codec: 'avc1.42001f', mux: 'avc' }, // H.264, what a post on X wants
  { codec: 'vp09.00.31.08', mux: 'vp9' },
  { codec: 'av01.0.05M.08', mux: 'av1' },
];

export interface ClipEncoder {
  codec: string;
  add(frame: HTMLCanvasElement | OffscreenCanvas, index: number): Promise<void>;
  finish(): Promise<Blob>;
}

/** An encoder for this browser, or null when it cannot make video (the page then says so in words). */
export async function createClipEncoder(layout: ClipLayout = CLOSE_TALL): Promise<ClipEncoder | null> {
  const W = globalThis as unknown as { VideoEncoder?: typeof VideoEncoder; VideoFrame?: typeof VideoFrame };
  if (!W.VideoEncoder || !W.VideoFrame) return null;
  for (const c of CODECS) {
    const cfg: VideoEncoderConfig = { codec: c.codec, width: layout.w, height: layout.h, bitrate: 5_000_000, framerate: CLIP_FPS, latencyMode: 'quality', bitrateMode: 'variable' };
    let ok = false;
    try { ok = !!(await W.VideoEncoder.isConfigSupported(cfg)).supported; } catch { ok = false; }
    if (!ok) continue;
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: c.mux, width: layout.w, height: layout.h, frameRate: CLIP_FPS }, fastStart: 'in-memory' });
    let failed: unknown = null;
    const enc = new W.VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
    enc.configure(cfg);
    return {
      codec: c.codec,
      async add(canvas, index) {
        if (failed) throw failed;
        const f = new W.VideoFrame!(canvas as CanvasImageSource, { timestamp: Math.round((index * 1_000_000) / CLIP_FPS) });
        enc.encode(f, { keyFrame: index % CLIP_FPS === 0 });
        f.close();
        if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0)); // let the encoder catch up
      },
      async finish() {
        await enc.flush();
        if (failed) throw failed;
        muxer.finalize();
        return new Blob([target.buffer], { type: 'video/mp4' });
      },
    };
  }
  return null;
}

// The view for the clip (CC-137, widened in CC-160). The default shows about 20 m of course across the picture, so the obstacle ahead is in frame;
// `?clipzoom=close` keeps the older close view where the runner is a third of the frame, and `?clipshape=wide` makes a 1280 x 720 picture.
export const RUNNER_M = 1.75; // a standing runner, in metres
export const CLIP_RUNNER_FRAC = 0.34; // close view: the runner's height as a share of the 1280-pixel frame
export const CLIP_VIEW_M = 20; // wide view: metres of course across the picture
export const MARKER_BELOW = 0.08; // a runner smaller than this share of the picture gets a soft ring round them
const FOV_HALF_TAN = Math.tan((40 / 2) * Math.PI / 180); // the course camera looks 40 degrees from top to bottom

export type ClipShape = 'tall' | 'wide';
export interface ClipLayout {
  shape: ClipShape;
  w: number; h: number; // the picture, in pixels
  band: { top: number; h: number }; // where the view of the run goes; the full width of the picture
  viewM: number | null; // metres across the band, or null for the close view (the runner's share of the picture is fixed instead)
}
export const CLOSE_TALL: ClipLayout = { shape: 'tall', w: CLIP_W, h: CLIP_H, band: { top: 250, h: 780 }, viewM: null };
export const VIEW_TALL: ClipLayout = { shape: 'tall', w: CLIP_W, h: CLIP_H, band: { top: 280, h: 640 }, viewM: CLIP_VIEW_M };
export const VIEW_WIDE: ClipLayout = { shape: 'wide', w: 1280, h: 720, band: { top: 70, h: 580 }, viewM: CLIP_VIEW_M };
export const CLIP_BAND = CLOSE_TALL.band; // kept for the older close view

/** The layout for this page address: `?clipzoom=close` is the old close view, `?clipshape=wide` is the 16:9 picture. */
export function clipLayoutFor(search: string): ClipLayout {
  const p = new URLSearchParams(search);
  if (p.get('clipzoom') === 'close') return CLOSE_TALL;
  return p.get('clipshape') === 'wide' ? VIEW_WIDE : VIEW_TALL;
}

/** The part of the view that drawClipFrame cuts out for the band. */
export function clipCrop(vw: number, vh: number, layout: ClipLayout = CLOSE_TALL): { w: number; h: number } {
  const w = Math.min(vw, vh * (layout.w / layout.band.h));
  return { w, h: w * (layout.band.h / layout.w) };
}
/** Metres from top to bottom of the band. */
function bandMetres(layout: ClipLayout): number {
  return layout.viewM !== null ? (layout.viewM * layout.band.h) / layout.w : (RUNNER_M * layout.band.h) / (CLIP_RUNNER_FRAC * layout.h);
}
/** How far the side camera must sit from the runner for the band to show this many metres (the close view: so the runner is CLIP_RUNNER_FRAC of the frame tall). */
export function clipCameraDistance(vw: number, vh: number, layout: ClipLayout = CLOSE_TALL): number {
  return (bandMetres(layout) * (vh / clipCrop(vw, vh, layout).h)) / (2 * FOV_HALF_TAN);
}
/** The runner's height in the clip frame, as a share of the frame height, for a camera this far away. */
export function clipRunnerFraction(vw: number, vh: number, distance: number, layout: ClipLayout = CLOSE_TALL): number {
  const metres = (2 * distance * FOV_HALF_TAN * clipCrop(vw, vh, layout).h) / vh;
  return ((RUNNER_M / metres) * layout.band.h) / layout.h;
}
/** Metres of course across the picture, for a camera this far away. */
export function clipViewMetres(vw: number, vh: number, distance: number, layout: ClipLayout = CLOSE_TALL): number {
  const metres = (2 * distance * FOV_HALF_TAN * clipCrop(vw, vh, layout).h) / vh;
  return (metres * layout.w) / layout.band.h;
}

export interface ClipText { course: string; time: string; address: string }
/** The runner on the view, in the view's own pixels; a soft ring is drawn round them when they are small in the picture. */
export interface ClipMarker { x: number; y: number; r: number }

/** One picture of the clip: the course name and the time on top, the view of the run in the middle, the tagline and the address below. */
export function drawClipFrame(ctx: CanvasRenderingContext2D, view: CanvasImageSource, vw: number, vh: number, t: ClipText, layout: ClipLayout = CLOSE_TALL, marker?: ClipMarker): void {
  const TOP = layout.band.top, MID = layout.band.h, W = layout.w;
  ctx.fillStyle = '#101b17'; ctx.fillRect(0, 0, W, layout.h);
  const { w: srcW, h: srcH } = clipCrop(vw, vh, layout); // crop the middle of the view to fill the band
  const sx = (vw - srcW) / 2, sy = Math.max(0, (vh - srcH) / 2);
  ctx.drawImage(view, sx, sy, srcW, srcH, 0, TOP, W, MID);
  if (marker) { // a soft ring, so a small runner is still the first thing the eye finds
    const k = W / srcW, cx = (marker.x - sx) * k, cy = TOP + (marker.y - sy) * k, r = Math.max(14, marker.r * k);
    ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, W, MID); ctx.clip();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  if (layout.shape === 'wide') { // two thin bars: the name and the time on top, the tagline and the address below
    ctx.font = '700 34px system-ui, sans-serif'; ctx.fillText(`${t.course}  ·  ${t.time}`, W / 2, 48, W - 60);
    ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText('Train slow. Run fast.', W / 2 - 230, TOP + MID + 46);
    ctx.fillStyle = '#b9c7c0'; ctx.font = '600 28px system-ui, sans-serif'; ctx.fillText(t.address, W / 2 + 250, TOP + MID + 46);
    return;
  }
  ctx.font = '700 44px system-ui, sans-serif'; ctx.fillText(t.course, W / 2, 98, W - 60);
  ctx.fillStyle = '#7fe0b0'; ctx.font = '800 76px system-ui, sans-serif'; ctx.fillText(t.time, W / 2, 190);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 46px system-ui, sans-serif'; ctx.fillText('Train slow. Run fast.', W / 2, TOP + MID + 110);
  ctx.fillStyle = '#b9c7c0'; ctx.font = '600 34px system-ui, sans-serif'; ctx.fillText(t.address, W / 2, TOP + MID + 180);
}
