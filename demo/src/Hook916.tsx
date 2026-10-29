import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import { Caption } from './CourseIntro';
import { Sequence } from 'remotion';
import { bedVolume } from './lib/music';
import { Tag } from './components/Tag';
import type { IntroData } from './types';

// The 20 s 9:16 hook: the first clip of the intro data, cropped to the middle, big captions, same music.
export const Hook916: React.FC<{ data: IntroData }> = ({ data }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <OffthreadVideo src={staticFile(data.clips[0].src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <Tag tag={data.clips[0].tag} note={data.clips[0].note} />
      {data.captions.slice(0, 3).map((c) => (
        <Sequence key={c.text} from={Math.round(c.from * fps)} durationInFrames={Math.round((c.to - c.from) * fps)}>
          <Caption text={c.text} seconds={c.to - c.from} />
        </Sequence>
      ))}
      <Audio src={staticFile(data.music.src)} volume={(f) => bedVolume(data.music, data.duck, f / fps, 20)} />
    </AbsoluteFill>
  );
};
