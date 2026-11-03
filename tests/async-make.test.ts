import { describe, expect, it } from 'vitest';
import { addJob, findJob, readJobs, removeJob, JOB_LIFE_MS, type Store } from '../src/community/job-store';
import { restoreWork, snapshotWork, workSignature } from '../src/community/session-store';
import { chipText } from '../src/ui/job-chip';

const mem = (): Store => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } }; };

describe('waiting jobs (CC-133)', () => {
  it('keeps a job, finds it, and removes it', () => {
    const s = mem(), now = 1_000_000;
    addJob(s, { kind: 'lift', id: 'a1', startedAt: now, photoSha: 'abcdef12', areaId: 3 }, now);
    expect(findJob(readJobs(s, now), 'lift', 'abcdef12', 3)?.id).toBe('a1');
    expect(findJob(readJobs(s, now), 'lift', 'abcdef12', 4)).toBeUndefined();
    removeJob(s, 'a1', now);
    expect(readJobs(s, now)).toEqual([]);
  });
  it('drops old jobs', () => {
    const s = mem();
    addJob(s, { kind: 'segment', id: 'b2', startedAt: 0, photoSha: 'abcdef12' }, 0);
    expect(readJobs(s, JOB_LIFE_MS + 1)).toEqual([]);
  });
  it('survives a missing store and bad data', () => {
    expect(readJobs(null)).toEqual([]);
    const s = mem(); s.setItem('cc.pendingJobs', '{nope');
    expect(readJobs(s)).toEqual([]);
  });
});

describe('saved Make screen (CC-133)', () => {
  const photo = { image: 'data:image/jpeg;base64,xx', thumb: 'data:image/jpeg;base64,yy', width: 10, height: 10, sha256: 'abcdef1234567890' };
  const work = { step: 'make', photo, fs: { hasPhoto: true }, kinds: new Map(), names: new Map(), made: { pieces: [] }, madeAreas: [2], cands: [], people: [], ticked: [], areas: [], segMsg: '' } as never;
  it('round-trips through JSON, including pieces already made', () => {
    const snap = snapshotWork(work, 5);
    const back = restoreWork(JSON.parse(JSON.stringify(snap)), 6);
    expect(back?.madeAreas).toEqual([2]);
    expect(back?.photo?.sha256).toBe(photo.sha256);
  });
  it('is empty without a photo and expires after a day', () => {
    expect(snapshotWork({ ...(work as object), photo: null } as never, 5)).toBeNull();
    expect(restoreWork(JSON.parse(JSON.stringify(snapshotWork(work, 5))), 5 + 25 * 3_600_000)).toBeNull();
  });
  it('signature changes when a piece is made', () => {
    expect(workSignature(work)).not.toBe(workSignature({ ...(work as object), madeAreas: [2, 3] } as never));
  });
});

describe('job chip words', () => {
  it('says what is going on', () => {
    const j = { kind: 'lift', id: 'x', startedAt: 0, photoSha: 'abcdef12' } as const;
    expect(chipText(j, 'running')).toContain('Making');
    expect(chipText(j, 'done')).toContain('Ready');
  });
});
