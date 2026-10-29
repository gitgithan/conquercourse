import { describe, expect, it } from 'vitest';
import { askTip } from '../functions/api/move-tips';
import { MOVES, parseTip } from '../src/slice/move-tips';
import { MOVE_ORDER, REAL_MOVE } from '../src/slice/piece-info';

const reply = (content: string | null, status = 200) => (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })) as unknown as typeof fetch;

describe('move tips: the list of moves', () => {
  it('is the same list the editor groups real objects by', () => {
    expect([...MOVES]).toEqual(MOVE_ORDER);
    for (const m of Object.values(REAL_MOVE)) expect(MOVES as readonly string[]).toContain(m);
  });
});

describe('move tips: reading the model', () => {
  it('reads moves and an idea', () => {
    expect(parseTip('{"moves":["vault","jump"],"idea":"A bench to hop over or leap onto, so a runner picks a line."}')).toEqual({ moves: ['vault', 'jump'], idea: 'A bench to hop over or leap onto, so a runner picks a line.' });
  });
  it('drops moves that are not on the list, keeps the order, removes repeats, allows three', () => {
    expect(parseTip('{"moves":["teleport","Vault","vault","swing","roll","jump","climb"],"idea":"x y z"}')!.moves).toEqual(['vault', 'hang', 'jump']);
  });
  it('gives no tip when no move is left or the answer is broken', () => {
    expect(parseTip('{"moves":["fly"],"idea":"A thing to look at in a course."}')).toBeNull();
    expect(parseTip('{"moves":"vault"}')).toBeNull();
    expect(parseTip('I think vault')).toBeNull();
    expect(parseTip('{"moves":["vault"')).toBeNull();
  });
  it('drops an idea that coaches the body, has numbers or is too short, but keeps the moves', () => {
    for (const idea of ['You should bend your knees and push off hard.', 'It is 2 m tall so p = mv matters.', 'Cool', '']) {
      const t = parseTip(JSON.stringify({ moves: ['jump'], idea }));
      expect(t).toEqual({ moves: ['jump'], idea: '' });
    }
  });
});

describe('move tips: the function', () => {
  it('returns a tip, or null when the model fails', async () => {
    expect((await askTip('k', { name: 'bench' }, reply('{"moves":["vault"],"idea":"A bench makes a runner choose to hop or leap."}'))).body.tip?.moves).toEqual(['vault']);
    expect((await askTip('k', { name: 'bench' }, reply('nope'))).body.tip).toBeNull();
    expect((await askTip('k', { name: 'bench' }, reply(null, 500))).status).toBe(502);
    expect((await askTip('k', {})).status).toBe(400);
    expect((await askTip('k', { name: 'bench', image: 'http://x/y.jpg' })).status).toBe(400);
  });
});

describe('move tips: when the model spends its whole budget thinking', () => {
  it('asks once more with more room and uses that answer', async () => {
    let n = 0;
    const sizes: number[] = [];
    const f = (async (_u: string, init: RequestInit) => { sizes.push(JSON.parse(String(init.body)).max_tokens); return new Response(JSON.stringify({ choices: [{ message: { content: n++ ? '{"moves":["vault"],"idea":"A long table makes a runner pick a side."}' : null } }] })); }) as unknown as typeof fetch;
    const r = await askTip('k', { name: 'picnic table' }, f);
    expect(sizes[1]).toBeGreaterThan(sizes[0]);
    expect(r.body.tip?.moves).toEqual(['vault']);
  });
  it('shows no tip when both answers are empty', async () => {
    expect((await askTip('k', { name: 'picnic table' }, reply(null))).body).toEqual({ tip: null });
  });
});
