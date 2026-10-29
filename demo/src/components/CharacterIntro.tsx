import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

// SLOT: character intro shot. Another agent builds the ninja-warrior entry movement.
// When its clip exists, put the file name in the data file ("characterIntro": "clips/character-intro.mp4") and it plays here, unchanged.
// Until then the slot shows a clearly marked placeholder, so nobody mistakes it for a finished shot.
export const CharacterIntro: React.FC<{ clip?: string }> = ({ clip }) =>
  clip ? <OffthreadVideo src={staticFile(clip)} /> : (
    <AbsoluteFill style={{ background: '#1b2430', justifyContent: 'center', alignItems: 'center', color: '#9fb3c8', font: '600 44px system-ui' }}>
      CHARACTER INTRO (slot): the ninja-warrior entry shot goes here
    </AbsoluteFill>
  );
