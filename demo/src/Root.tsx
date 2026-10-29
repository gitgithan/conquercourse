import React from 'react';
import { Composition } from 'remotion';
import { CourseIntro, introSeconds } from './CourseIntro';
import { Full3min, type FullData } from './Full3min';
import { Hook916 } from './Hook916';
import parkRun from '../data/course-intro/park-run.json';
import full from '../data/full/full3min.json';
import type { IntroData } from './types';

const intro = parkRun as IntroData;
const fullData = full as FullData;

// Compositions: the 20 s proof, any course intro (one data file each), the 9:16 hook, the three-minute skeleton.
export const Root: React.FC = () => (
  <>
    <Composition id="Proof20" component={CourseIntro} width={intro.width} height={intro.height} fps={intro.fps} durationInFrames={Math.round(introSeconds(intro) * intro.fps)} defaultProps={{ data: intro }} />
    <Composition id="CourseIntro" component={CourseIntro} width={intro.width} height={intro.height} fps={intro.fps} durationInFrames={Math.round(introSeconds(intro) * intro.fps)} defaultProps={{ data: intro }} />
    <Composition id="Hook916" component={Hook916} width={1080} height={1920} fps={intro.fps} durationInFrames={20 * intro.fps} defaultProps={{ data: intro }} />
    <Composition id="Full3min" component={Full3min} width={fullData.width} height={fullData.height} fps={fullData.fps} durationInFrames={180 * fullData.fps} defaultProps={{ data: fullData }} />
  </>
);
