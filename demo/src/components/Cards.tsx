import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Tag } from './Tag';

const fade = (t: number, len: number) => interpolate(t, [0, 0.4, len - 0.4, len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// Title or name card. `still` is an optional Muse Image picture in the media folder (tagged META).
export const TitleCard: React.FC<{ title: string; line: string; still?: string; seconds: number }> = ({ title, line, still, seconds }) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  return (
    <AbsoluteFill style={{ background: '#101418', opacity: fade(t, seconds), justifyContent: 'center', alignItems: 'center', fontFamily: 'system-ui' }}>
      {still ? <Img src={staticFile(still)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} /> : null}
      <div style={{ color: '#fff', textAlign: 'center' }}>
        <div style={{ font: '800 96px system-ui' }}>{title}</div>
        <div style={{ font: '500 40px system-ui', color: '#ffd23f', marginTop: 12 }}>{line}</div>
      </div>
      {still ? <Tag tag="META" model="Muse Image" /> : <Tag tag="GFX" />}
    </AbsoluteFill>
  );
};

// End card: where to play, what each model did, the credits.
export const EndCard: React.FC<{ title: string; lines: string[]; seconds: number }> = ({ title, lines, seconds }) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  return (
    <AbsoluteFill style={{ background: '#101418', opacity: fade(t, seconds), justifyContent: 'center', alignItems: 'center', fontFamily: 'system-ui', color: '#fff' }}>
      <div style={{ font: '800 64px system-ui', marginBottom: 20 }}>{title}</div>
      {lines.map((l) => <div key={l} style={{ font: '400 30px system-ui', opacity: 0.92, marginTop: 6 }}>{l}</div>)}
      <Tag tag="GFX" />
    </AbsoluteFill>
  );
};
