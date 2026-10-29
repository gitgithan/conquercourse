import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Tag } from './components/Tag';
import { CharacterIntro } from './components/CharacterIntro';
import type { ShotTag } from './lib/tags';

export interface Beat { at: number; seconds: number; name: string; tag: ShotTag; clip: string | null; note?: string; slot?: string }
export interface FullData { fps: number; width: number; height: number; beats: Beat[] }

// The three-minute skeleton: one sequence per beat of docs/demo-script-v2.md. Empty beats are marked, never faked.
export const Full3min: React.FC<{ data: FullData }> = ({ data }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {data.beats.map((b) => (
        <Sequence key={b.name} from={Math.round(b.at * fps)} durationInFrames={Math.round(b.seconds * fps)}>
          {b.slot === 'characterIntro' ? <CharacterIntro clip={b.clip ?? undefined} /> : b.clip ? <OffthreadVideo src={staticFile(b.clip)} /> : (
            <AbsoluteFill style={{ background: '#222a33', color: '#cbd5e1', justifyContent: 'center', alignItems: 'center', font: '600 48px system-ui' }}>TO FILM: {b.name}</AbsoluteFill>
          )}
          <Tag tag={b.tag} note={b.note} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
