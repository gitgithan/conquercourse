import { describe, expect, it } from "vitest";
import { askPartner, MAX_TOKENS } from "../functions/api/design-partner";
import { cleanLayout, cleanReply, layoutPrompt, nearestRecorded, RECORDED } from "../src/labs/systemdesign/partner-core";
import { REAL } from "../src/labs/systemdesign/judge";

// System design partner: a fake model only. No paid call is made here.
type Sent = { max_tokens: number; messages: { content: string }[] };
const fake = (reply: string | null, ok = true) => {
  const f = (async (_u: unknown, init: RequestInit) => { f.last = JSON.parse(String(init.body)) as Sent; return { ok, status: ok ? 200 : 500, json: async () => ({ choices: [{ message: { content: reply } }] }) } as Response; }) as typeof fetch & { last?: Sent };
  return f;
};
describe("design partner", () => {
  it("accepts only known blocks and a capped, cleaned note", () => {
    expect(cleanLayout({ scenario: "photo", blocks: ["pages", "nope"] })).toBeNull();
    expect(cleanLayout({ scenario: "x", blocks: ["pages"] })).toBeNull();
    expect(cleanLayout({ scenario: "photo", blocks: [] })).toBeNull();
    const l = cleanLayout({ scenario: "photo", blocks: ["pages"], note: "<script>x</script> " + "a".repeat(300) })!;
    expect(l.note.length).toBeLessThanOrEqual(120); expect(l.note).not.toContain("<");
  });
  it("sends one system and one user message, a big token limit, and the judge's lines", async () => {
    const f = fake("Pros: a. Cons: b.");
    const r = await askPartner("k", { scenario: "photo", blocks: ["browser", "keyinpage"], note: "hello" }, f);
    expect(r).toEqual({ status: 200, body: { reply: "Pros: a. Cons: b." } });
    expect(f.last!.max_tokens).toBe(MAX_TOKENS); expect(MAX_TOKENS).toBeGreaterThanOrEqual(4000);
    expect(f.last!.messages).toHaveLength(2);
    expect(f.last!.messages[1].content).toContain("FAIL: Keys stay out of the browser");
  });
  it("answers 400 for a bad layout, 502 for an empty or failed model, 504 on a timeout", async () => {
    expect((await askPartner("k", { scenario: "photo", blocks: ["zzz"] }, fake("x"))).status).toBe(400);
    expect((await askPartner("k", { scenario: "photo", blocks: ["pages"] }, fake(null))).status).toBe(502);
    expect((await askPartner("k", { scenario: "photo", blocks: ["pages"] }, fake("x", false))).status).toBe(502);
    expect((await askPartner("k", { scenario: "photo", blocks: ["pages"] }, (async () => { throw new Error("abort"); }) as unknown as typeof fetch)).status).toBe(504);
  });
  it("strips markup from the reply and caps it", () => {
    expect(cleanReply("<b>Pros:</b> **fine** [x](y)")).not.toMatch(/[<>*\[\]]/);
    expect(cleanReply("a".repeat(5000)).length).toBe(900);
  });
  it("picks the nearest recorded example, and the real design matches itself", () => {
    expect(nearestRecorded([...REAL]).id).toBe("real");
    expect(nearestRecorded(["browser", "pages", "keyinpage", "sam3"]).id).toBe("key-in-page");
    expect(RECORDED.length).toBeGreaterThanOrEqual(5);
    expect(layoutPrompt({ scenario: "photo", blocks: ["pages"], note: "" })).not.toContain("Student note");
  });
});
import { askDesignPartner } from "../src/labs/systemdesign/partner-client";
describe("design partner, page side", () => {
  const L = { scenario: "photo", blocks: ["browser", "pages", "keyinpage", "sam3"], note: "" };
  const resp = (status: number, body: unknown) => (async () => ({ ok: status < 400, status, json: async () => body }) as Response) as unknown as typeof fetch;
  it("shows the live reply when it comes", async () => expect(await askDesignPartner(L, resp(200, { reply: "Pros: x." }))).toEqual({ kind: "live", text: "Pros: x." }));
  it("falls back to a recorded example, and says why, on 429, 503, an empty reply, an error and a timeout", async () => {
    for (const f of [resp(429, {}), resp(503, {}), resp(200, {}), (async () => { throw new Error("net"); }) as unknown as typeof fetch, ((_u: unknown, i: RequestInit) => new Promise((_r, no) => i.signal!.addEventListener("abort", () => no(new Error("abort"))))) as unknown as typeof fetch]) {
      const a = await askDesignPartner(L, f, 20);
      expect(a.kind).toBe("recorded"); expect(a.why!.length).toBeGreaterThan(5); expect(a.text).toContain("key");
    }
  });
});
