import React from 'react';
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Tag } from './components/Tag';
import { EndCard } from './components/Cards';
import { CharacterIntro } from './components/CharacterIntro';
import { bedVolume } from './lib/music';
import { hookSeconds, type HookData, type HookShot } from './lib/hook';

const WHIP = 6; // frames a whip takes
export const Hook20: React.FC<{ data: HookData }> = ({ data }) => {
  const { fps } = useVideoConfig(), beat = (60 / data.music.bpm) * fps, total = hookSeconds(data);
  let at = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {data.shots.map((s, i) => {
        const from = Math.round(at * beat), len = Math.round((at + s.beats) * beat) - from;
        at += s.beats;
        const next = data.shots[i + 1];
        return (
          <Sequence key={s.name} from={from} durationInFrames={len + (next?.into === 'whip' ? WHIP : 0)}>
            <Moving shot={s} len={len} fps={fps} incoming={s.into === 'whip'} outgoing={next?.into === 'whip'} characterIntro={data.characterIntro} data={data} />
          </Sequence>
        );
      })}
      <Audio src={staticFile(data.music.src)} startFrom={Math.round(data.music.start * fps)} volume={(f) => bedVolume(data.music, [], f / fps, total)} />
    </AbsoluteFill>
  );
};

// One shot with its arrival (cut, whip or flash), its slow push, its tag and its caption.
const Moving: React.FC<{ shot: HookShot; len: number; fps: number; incoming: boolean; outgoing: boolean; characterIntro?: string; data: HookData }> = ({ shot, len, fps, incoming, outgoing, characterIntro, data }) => {
  const f = useCurrentFrame();
  const slideIn = incoming ? interpolate(f, [0, WHIP], [1, 0], { extrapolateRight: 'clamp' }) : 0;
  const slideOut = outgoing ? interpolate(f, [len, len + WHIP], [0, 1], { extrapolateLeft: 'clamp' }) : 0;
  const move = slideIn > 0 ? slideIn : -slideOut, blur = Math.abs(move) * 28;
  const zoom = 1 + (shot.push ?? 0) * (f / len);
  const flash = shot.into === 'flash' ? interpolate(f, [0, 4], [1, 0], { extrapolateRight: 'clamp' }) : 0;
  const t = f / fps;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${move * 22}%) scale(${zoom})`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>
        {shot.kind === 'end' ? <EndCard title={data.title} lines={[data.line]} seconds={len / fps} />
          : shot.kind === 'character' ? <CharacterIntro clip={characterIntro} />
          : <OffthreadVideo src={staticFile(shot.src!)} startFrom={Math.round((shot.from ?? 0) * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {shot.kind === 'end' ? null : <Tag tag={shot.tag} model={shot.model} note={shot.note} />}
      </AbsoluteFill>
      {shot.caption ? (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 64, opacity: interpolate(t, [0, 0.15, len / fps - 0.15, len / fps], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <div style={{ font: '800 54px system-ui', color: '#fff', background: 'rgba(17,17,17,.7)', padding: '6px 24px', borderRadius: 8, textAlign: 'center' }}>{shot.caption}</div>
        </AbsoluteFill>
      ) : null}
      {flash > 0 ? <AbsoluteFill style={{ background: '#fff', opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};
