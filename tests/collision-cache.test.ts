import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGlbMesh } from "../src/slice/glb";
import { DEFAULT_VOXEL } from "../src/labs/collision/collision-core";
import { packView, runView, unpackView } from "../src/labs/collision/stages-view";

// The cached stages for the default voxel size must equal a fresh run, or the default view would show old numbers.
const buf = readFileSync("public/assets/objects/monkey-bars-saienji-cc0.glb");
const mesh = readGlbMesh(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const cached = JSON.parse(readFileSync("public/assets/demo/collision-stages.default.json", "utf8"));

describe("Collision Lab cache", () => {
  it("the file equals a fresh run at the default voxel size", () => {
    const fresh = runView(mesh, DEFAULT_VOXEL);
    expect(cached).toEqual(packView(fresh));
    expect(unpackView(cached)).toEqual(fresh);
  });
  it("is small, so the default view needs no big download", () => {
    expect(readFileSync("public/assets/demo/collision-stages.default.json").length).toBeLessThan(120_000);
  });
});
