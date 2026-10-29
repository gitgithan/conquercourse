import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface CalloutData { text: string; idea?: string; from: number; to: number; dx?: number; dy?: number }
// A point on the screen in pixels; for game footage it comes from the 3D anchor projected through the real camera (scripts/film.mjs --track).
export type Point = [number, number];

// Callout with a leader line. `at` is a fixed point (a photo) or a function of the frame (tracked footage).
export const Callout: React.FC<{ data: CalloutData; at: Point | ((frame: number) => Point | null) }> = ({ data, at }) => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const a = interpolate(t, [data.from, data.from + 0.4, data.to - 0.4, data.to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const p = typeof at === 'function' ? at(frame) : at;
  if (!p || a <= 0) return null;
  const [x, y] = p, bx = x + (data.dx ?? 90), by = y + (data.dy ?? -90);
  const len = Math.hypot(bx - x, by - y), ang = Math.atan2(by - y, bx - x);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a, fontFamily: 'system-ui' }}>
      <div style={{ position: 'absolute', left: x, top: y, width: len * Math.min(1, a * 1.5), height: 3, background: '#ffd23f', transformOrigin: '0 50%', transform: `rotate(${ang}rad)` }} />
      <div style={{ position: 'absolute', left: x - 8, top: y - 8, width: 16, height: 16, borderRadius: '50%', background: '#ffd23f', boxShadow: '0 0 18px 8px rgba(255,210,63,.65)' }} />
      <div style={{ position: 'absolute', left: bx, top: by - 24, background: 'rgba(17,17,17,.82)', color: '#fff', borderLeft: '5px solid #ffd23f', padding: '6px 14px', borderRadius: 4, whiteSpace: 'nowrap' }}>
        <div style={{ font: '700 26px system-ui' }}>{data.text}</div>
        {data.idea ? <div style={{ font: '400 18px system-ui', opacity: 0.9 }}>{data.idea}</div> : null}
      </div>
    </div>
  );
};

// Reads the per-frame points the game wrote (frames[i] = {id: [x, y]}) for one label id.
export const trackAt = (frames: Array<Record<string, Point>>, id: string) => (frame: number): Point | null => frames[Math.min(frame, frames.length - 1)]?.[id] ?? null;
