// Server proxy for SAM 3.1: the key stays here, the browser sends a photo and one noun phrase.
// Run: set -a; . ~/.config/ninja/meta.env; set +a; node server/sam-proxy.mjs
import http from "node:http";

const PORT = Number(process.env.SAM_PROXY_PORT || 8787);
const BASE = process.env.META_BASE_URL || "https://api.meta.ai/v1";
const KEY = process.env.META_API_KEY;
const MAX_BODY = 8 * 1024 * 1024;
const PHRASE = /^[a-z][a-z -]{1,40}$/;
if (!KEY) throw new Error("META_API_KEY is not set");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("body too large"), { status: 413 })); req.destroy(); }
      else parts.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parts).toString()));
    req.on("error", reject);
  });
}

// body: { image: "data:image/jpeg;base64,...", phrase: "bench" } -> { status, ms, raw }
async function segment({ image, phrase }) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "sam-3.1",
      input: [{ type: "message", role: "user", content: [
        { type: "input_text", text: phrase },
        { type: "input_image", image_url: image }] }],
      metadata: { include_confidence: "true" },
    }),
  });
  return { status: r.status, ms: Math.round(performance.now() - t0), raw: await r.text() };
}

http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method !== "POST" || req.url !== "/segment") return send(404, { error: "POST /segment only" });
    const body = JSON.parse(await readBody(req));
    if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) return send(400, { error: "image must be a data URL" });
    if (typeof body.phrase !== "string" || !PHRASE.test(body.phrase)) return send(400, { error: "phrase must be one short noun phrase" });
    send(200, await segment(body));
  } catch (e) {
    send(e.status || 500, { error: String(e.message || e) });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`sam proxy on 127.0.0.1:${PORT}`));
