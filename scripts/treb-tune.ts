// One candidate of the bar demo: npx tsx scripts/treb-tune.ts barX barY towerX0 towerTop counterweight  -> prints "ok width_ms"
import { readFileSync } from "node:fs";
import { searchIdealRun } from "../src/sim/ideal";
import { releaseWindow } from "../src/sim/launch-window";
const [bx, by, tx, tt, cw] = process.argv.slice(2).map(Number);
const c = JSON.parse(readFileSync("public/assets/demo/launch-bar.course.json", "utf8"));
c.plan = undefined;
c.holds = [{ x: bx, y: by }];
c.terrain.platforms[1] = { x0: tx, x1: tx + 10, top: tt };
c.finishX = tx + 6;
c.trebuchet = { x: 0, counterweight: cw };
const r = searchIdealRun(c);
const w = r.cleared ? releaseWindow(c, r) : null;
const nb = r.cleared ? searchIdealRun({ ...c, holds: [] }).cleared : false;
console.log(process.argv.slice(2).join(","), r.cleared ? (nb ? "ok-nobar-too" : "ok") : "no", w ? Math.round(w.widthMs) : 0);
