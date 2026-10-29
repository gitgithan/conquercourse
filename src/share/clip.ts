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
    const cfg: VideoEncoderConfig = { codec: c.codec, width: CLIP_W, height: CLIP_H, bitrate: 3_000_000, framerate: CLIP_FPS };
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

export interface ClipText { course: string; time: string; address: string }

/** One picture of the clip: the course name and the time on top, the view of the run in the middle, the tagline and the address below. */
export function drawClipFrame(ctx: CanvasRenderingContext2D, view: CanvasImageSource, vw: number, vh: number, t: ClipText): void {
  const TOP = 250, MID = 780; // the middle band is 720 x 780
  ctx.fillStyle = '#101b17'; ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  const srcW = Math.min(vw, vh * (CLIP_W / MID)), srcH = srcW * (MID / CLIP_W); // crop the middle of the view to fill the band
  ctx.drawImage(view, (vw - srcW) / 2, Math.max(0, (vh - srcH) / 2), srcW, srcH, 0, TOP, CLIP_W, MID);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px system-ui, sans-serif'; ctx.fillText(t.course, CLIP_W / 2, 98, CLIP_W - 60);
  ctx.fillStyle = '#7fe0b0'; ctx.font = '800 76px system-ui, sans-serif'; ctx.fillText(t.time, CLIP_W / 2, 190);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 46px system-ui, sans-serif'; ctx.fillText('Train slow. Run fast.', CLIP_W / 2, TOP + MID + 110);
  ctx.fillStyle = '#b9c7c0'; ctx.font = '600 34px system-ui, sans-serif'; ctx.fillText(t.address, CLIP_W / 2, TOP + MID + 180);
}
