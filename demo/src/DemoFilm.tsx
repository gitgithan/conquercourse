import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Tag } from './components/Tag';
import { bedVolume } from './lib/music';
import { demoSeconds, type DemoFilmData, type DemoShot } from './lib/demo-film';

// The owner's cut (CC-209, docs/film-craft.md): Earth to street map, the World Slicer, the World Editor, the Training course run, the lache cliffhanger, fast beats, the two rookies.
export const DemoFilm: React.FC<{ data: DemoFilmData }> = ({ data }) => {
  const { fps } = useVideoConfig(), beat = (60 / data.music.bpm) * fps, total = demoSeconds(data);
  let at = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {data.shots.map((s) => {
        const from = Math.round(at * beat), len = Math.round((at + s.beats) * beat) - from;
        at += s.beats;
        return (
          <Sequence key={s.name} from={from} durationInFrames={len}>
            <ShotView shot={s} len={len} fps={fps} data={data} />
          </Sequence>
        );
      })}
      <Audio src={staticFile(data.music.src)} startFrom={Math.round(data.music.start * fps)} volume={(f) => bedVolume(data.music, [], f / fps, total)} />
    </AbsoluteFill>
  );
};

const clipStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

const ShotView: React.FC<{ shot: DemoShot; len: number; fps: number; data: DemoFilmData }> = ({ shot, len, fps, data }) => {
  if (shot.kind === 'playnow') return <PlayNow shot={shot} />;
  if (shot.kind === 'credits') return <Credits data={data} />;
  return (
    <AbsoluteFill>
      {shot.parts ? shot.parts.map((p, i) => {
        const pFrom = Math.round(shot.parts!.slice(0, i).reduce((n, q) => n + q.dur, 0) * fps);
        return (
          <Sequence key={i} from={pFrom} durationInFrames={Math.round(p.dur * fps)}>
            <OffthreadVideo src={staticFile(shot.src!)} startFrom={Math.round(p.from * fps)} muted style={clipStyle} />
          </Sequence>
        );
      }) : <OffthreadVideo src={staticFile(shot.src!)} startFrom={Math.round((shot.from ?? 0) * fps)} muted style={clipStyle} />}
      {shot.kind === 'lache' ? <LacheDim len={len} line={data.line} /> : null}
      <Tag tag={shot.tag} note={shot.note} />
    </AbsoluteFill>
  );
};

// The cliffhanger: the flight is still in the air when the picture dims into the logo card, so nobody sees the catch (docs/film-craft.md).
const LacheDim: React.FC<{ len: number; line: string }> = ({ len, line }) => {
  const f = useCurrentFrame();
  const dark = interpolate(f, [len * 0.38, len * 0.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logo = interpolate(f, [len * 0.5, len * 0.68], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#14181f', opacity: dark, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: logo, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        <Img src={staticFile('brand/conquercourse-logo.svg')} style={{ width: 620 }} />
        <div style={{ font: '300 38px Helvetica, Arial, sans-serif', letterSpacing: 6, color: '#f4f1ea' }}>{line}</div>
      </div>
    </AbsoluteFill>
  );
};

// The end card: both rookies running, PLAY NOW set like the logo wordmark (off-white and orange, Helvetica 800).
const PlayNow: React.FC<{ shot: DemoShot }> = ({ shot }) => {
  const f = useCurrentFrame();
  const rise = interpolate(f, [6, 30], [26, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = interpolate(f, [6, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panel = (src: string) => (
    <div style={{ width: '50%', height: '100%', overflow: 'hidden' }}>
      <OffthreadVideo src={staticFile(src)} startFrom={54} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.45)' }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#14181f' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {panel(shot.left!)}
        {panel(shot.right!)}
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(20,24,31,.25) 0%, rgba(20,24,31,0) 30%, rgba(20,24,31,0) 52%, rgba(20,24,31,.94) 80%)' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64, opacity: fade, transform: `translateY(${rise}px)` }}>
        <div style={{ font: '800 96px Helvetica, Arial, sans-serif', letterSpacing: 2 }}>
          <span style={{ color: '#f4f1ea' }}>PLAY </span><span style={{ color: '#ff9a3c' }}>NOW</span>
        </div>
      </AbsoluteFill>
      <Tag tag={shot.tag} note={shot.note} />
    </AbsoluteFill>
  );
};

const Credits: React.FC<{ data: DemoFilmData }> = ({ data }) => (
  <AbsoluteFill style={{ background: '#14181f', justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
      <Img src={staticFile('brand/conquercourse-logo.svg')} style={{ width: 430 }} />
      <div style={{ font: '300 27px Helvetica, Arial, sans-serif', letterSpacing: 5, color: '#f4f1ea' }}>{data.line}</div>
      <div style={{ textAlign: 'center', font: '15px Helvetica, Arial, sans-serif', lineHeight: 2, color: '#8d96a3' }}>
        {data.credits.map((c) => <div key={c}>{c}</div>)}
      </div>
    </div>
    <Tag tag="GFX" />
  </AbsoluteFill>
);
