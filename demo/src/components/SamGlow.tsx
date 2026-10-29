import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// The glow around an object that SAM 3 found in a real photo. `box` is [x0, y0, x1, y1] in photo pixels (public/assets/park/*.objects.json).
// A mask image can replace the box later: pass `maskSrc` and it is drawn with a glow filter instead.
export const SamGlow: React.FC<{ box: [number, number, number, number]; photo: [number, number]; frame: [number, number]; from: number; label: string }> = ({ box, photo, frame, from, label }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps;
  const k = Math.max(frame[0] / photo[0], frame[1] / photo[1]), ox = (frame[0] - photo[0] * k) / 2, oy = (frame[1] - photo[1] * k) / 2;
  const pulse = 0.65 + 0.35 * Math.sin(t * 5), a = interpolate(t, [from, from + 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = ox + box[0] * k, y = oy + box[1] * k;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a }}>
      <div style={{ position: 'absolute', left: x, top: y, width: (box[2] - box[0]) * k, height: (box[3] - box[1]) * k, border: '3px solid #ffd23f', borderRadius: 6, boxShadow: `0 0 ${30 * pulse}px ${10 * pulse}px rgba(255,210,63,.7), inset 0 0 ${30 * pulse}px rgba(255,210,63,.3)` }} />
      <div style={{ position: 'absolute', left: x, top: y - 40, font: '700 24px system-ui', color: '#111', background: '#ffd23f', padding: '2px 10px', borderRadius: 4 }}>{label} · found by SAM 3</div>
    </div>
  );
};
