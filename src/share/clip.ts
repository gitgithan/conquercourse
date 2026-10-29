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
export async function createClipEncoder(): Promise<ClipEncoder | null> {
  const W = globalThis as unknown as { VideoEncoder?: typeof VideoEncoder; VideoFrame?: typeof VideoFrame };
  if (!W.VideoEncoder || !W.VideoFrame) return null;
  for (const c of CODECS) {
    const cfg: VideoEncoderConfig = { codec: c.codec, width: CLIP_W, height: CLIP_H, bitrate: 5_000_000, framerate: CLIP_FPS, latencyMode: 'quality', bitrateMode: 'variable' };
    let ok = false;
    try { ok = !!(await W.VideoEncoder.isConfigSupported(cfg)).supported; } catch { ok = false; }
    if (!ok) continue;
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: c.mux, width: CLIP_W, height: CLIP_H, frameRate: CLIP_FPS }, fastStart: 'in-memory' });
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

// The view for the clip is close and side-on, so the runner is easy to see on a phone (CC-137).
export const CLIP_BAND = { top: 250, h: 780 }; // the middle band of the 720 x 1280 frame
export const RUNNER_M = 1.75; // a standing runner, in metres
export const CLIP_RUNNER_FRAC = 0.34; // the runner's height as a share of the 1280-pixel frame; the clip asks for at least a third
const FOV_HALF_TAN = Math.tan((40 / 2) * Math.PI / 180); // the course camera looks 40 degrees from top to bottom

/** The part of the view that drawClipFrame cuts out for the middle band. */
export function clipCrop(vw: number, vh: number): { w: number; h: number } {
  const w = Math.min(vw, vh * (CLIP_W / CLIP_BAND.h));
  return { w, h: w * (CLIP_BAND.h / CLIP_W) };
}
/** How far the side camera must sit from the runner so that the runner is CLIP_RUNNER_FRAC of the frame tall. */
export function clipCameraDistance(vw: number, vh: number): number {
  const bandMetres = (RUNNER_M * CLIP_BAND.h) / (CLIP_RUNNER_FRAC * CLIP_H); // metres the band must show from top to bottom
  return (bandMetres * (vh / clipCrop(vw, vh).h)) / (2 * FOV_HALF_TAN);
}
/** The runner's height in the clip frame, as a share of the frame height, for a camera this far away. */
export function clipRunnerFraction(vw: number, vh: number, distance: number): number {
  const bandMetres = (2 * distance * FOV_HALF_TAN * clipCrop(vw, vh).h) / vh;
  return ((RUNNER_M / bandMetres) * CLIP_BAND.h) / CLIP_H;
}

export interface ClipText { course: string; time: string; address: string }

/** One picture of the clip: the course name and the time on top, the view of the run in the middle, the tagline and the address below. */
export function drawClipFrame(ctx: CanvasRenderingContext2D, view: CanvasImageSource, vw: number, vh: number, t: ClipText): void {
  const TOP = CLIP_BAND.top, MID = CLIP_BAND.h; // the middle band is 720 x 780
  ctx.fillStyle = '#101b17'; ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  const { w: srcW, h: srcH } = clipCrop(vw, vh); // crop the middle of the view to fill the band
  ctx.drawImage(view, (vw - srcW) / 2, Math.max(0, (vh - srcH) / 2), srcW, srcH, 0, TOP, CLIP_W, MID);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px system-ui, sans-serif'; ctx.fillText(t.course, CLIP_W / 2, 98, CLIP_W - 60);
  ctx.fillStyle = '#7fe0b0'; ctx.font = '800 76px system-ui, sans-serif'; ctx.fillText(t.time, CLIP_W / 2, 190);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 46px system-ui, sans-serif'; ctx.fillText('Train slow. Run fast.', CLIP_W / 2, TOP + MID + 110);
  ctx.fillStyle = '#b9c7c0'; ctx.font = '600 34px system-ui, sans-serif'; ctx.fillText(t.address, CLIP_W / 2, TOP + MID + 180);
}
