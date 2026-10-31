import React from 'react';
import { Composition } from 'remotion';
import { CourseIntro, introSeconds } from './CourseIntro';
import { Full3min, type FullData } from './Full3min';
import { Hook20 } from './Hook20';
import { hookSeconds, type HookData } from './lib/hook';
import parkRun from '../data/course-intro/park-run.json';
import hook from '../data/hook/hook20.json';
import hook916 from '../data/hook/hook20.916.json';
import full from '../data/full/full3min.json';
import demoFilm from '../data/demo/demo-film.json';
import { DemoFilm } from './DemoFilm';
import { demoSeconds, type DemoFilmData } from './lib/demo-film';
import type { IntroData } from './types';

const intro = parkRun as IntroData;
const demoData = demoFilm as DemoFilmData;
const hookData = hook as HookData, hookData916 = hook916 as HookData;
const fullData = full as FullData;

// Compositions: the 20 s proof, any course intro (one data file each), the 20 s hook in 16:9 and 9:16, the three-minute skeleton.
export const Root: React.FC = () => (
  <>
    <Composition id="Proof20" component={CourseIntro} width={intro.width} height={intro.height} fps={intro.fps} durationInFrames={Math.round(introSeconds(intro) * intro.fps)} defaultProps={{ data: intro }} />
    <Composition id="CourseIntro" component={CourseIntro} width={intro.width} height={intro.height} fps={intro.fps} durationInFrames={Math.round(introSeconds(intro) * intro.fps)} defaultProps={{ data: intro }} />
    <Composition id="Hook169" component={Hook20} width={hookData.width} height={hookData.height} fps={hookData.fps} durationInFrames={Math.round(hookSeconds(hookData) * hookData.fps)} defaultProps={{ data: hookData }} />
    <Composition id="Hook916" component={Hook20} width={hookData916.width} height={hookData916.height} fps={hookData916.fps} durationInFrames={Math.round(hookSeconds(hookData916) * hookData916.fps)} defaultProps={{ data: hookData916 }} />
    <Composition id="Full3min" component={Full3min} width={fullData.width} height={fullData.height} fps={fullData.fps} durationInFrames={180 * fullData.fps} defaultProps={{ data: fullData }} />
    <Composition id="DemoFilm" component={DemoFilm} width={demoData.width} height={demoData.height} fps={demoData.fps} durationInFrames={Math.round(demoSeconds(demoData) * demoData.fps)} defaultProps={{ data: demoData }} />
  </>
);
