import React from 'react';
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Tag } from './components/Tag';
import { EndCard } from './components/Cards';
import { bedVolume } from './lib/music';
import type { IntroData } from './types';

// One data file makes one course intro: clips with tags, burnt-in captions, a music bed that ducks, and the end title.
export const introSeconds = (d: IntroData) => d.clips.reduce((n, c) => n + c.seconds, 0) - d.crossfade * (d.clips.length - 1);

export const CourseIntro: React.FC<{ data: IntroData }> = ({ data }) => {
  const { fps } = useVideoConfig(), total = introSeconds(data);
  let at = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {data.clips.map((c, i) => {
        const from = at; at += c.seconds - data.crossfade;
        return (
          <Sequence key={c.src} from={Math.round(from * fps)} durationInFrames={Math.round(c.seconds * fps)}>
            <FadeEdges seconds={c.seconds} fade={i === 0 ? 0 : data.crossfade}>
              <OffthreadVideo src={staticFile(c.src)} />
              <Tag tag={c.tag} model={c.model} note={c.note} />
            </FadeEdges>
          </Sequence>
        );
      })}
      {data.captions.map((c) => (
        <Sequence key={c.text} from={Math.round(c.from * fps)} durationInFrames={Math.round((c.to - c.from) * fps)}>
          <Caption text={c.text} seconds={c.to - c.from} />
        </Sequence>
      ))}
      <Sequence from={Math.round((total - data.endSeconds) * fps)} durationInFrames={Math.round(data.endSeconds * fps)}>
        <EndCard title={data.title} lines={[data.line]} seconds={data.endSeconds} />
      </Sequence>
      <Audio src={staticFile(data.music.src)} startFrom={Math.round(data.music.start * fps)} volume={(f) => bedVolume(data.music, data.duck, f / fps, total)} />
    </AbsoluteFill>
  );
};

// A later clip fades in over the one before it (the cross-fade); the first clip starts at once.
const FadeEdges: React.FC<{ seconds: number; fade: number; children: React.ReactNode }> = ({ fade, children }) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  return <AbsoluteFill style={{ opacity: fade > 0 ? interpolate(t, [0, fade], [0, 1], { extrapolateRight: 'clamp' }) : 1 }}>{children}</AbsoluteFill>;
};

export const Caption: React.FC<{ text: string; seconds: number }> = ({ text, seconds }) => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  const a = interpolate(t, [0, 0.25, seconds - 0.25, seconds], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56, opacity: a }}>
      <div style={{ font: '700 44px system-ui', color: '#fff', background: 'rgba(17,17,17,.75)', padding: '6px 22px', borderRadius: 6 }}>{text}</div>
    </AbsoluteFill>
  );
};
