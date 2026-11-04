// System design Lab: the page side of the design partner. One ask, one answer. If the live call fails, is slow or is rate-limited, a stored example is shown and labelled.
import { nearestRecorded } from "./partner-core";
import { recordedForDesign, type BriefId, type Design } from "./pipeline";

export interface PartnerAnswer { kind: "live" | "recorded"; text: string; why?: string }
export const CLIENT_TIMEOUT_MS = 26_000;

export type PartnerAsk = { scenario: string; blocks: string[]; note: string } | { brief: BriefId; design: Design; note: string };
export async function askDesignPartner(layout: PartnerAsk, fetcher: typeof fetch = fetch, timeoutMs = CLIENT_TIMEOUT_MS): Promise<PartnerAnswer> {
  const recorded = (why: string): PartnerAnswer => ({ kind: "recorded", text: "design" in layout ? recordedForDesign(layout.design, layout.brief) : nearestRecorded(layout.blocks).text, why });
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetcher("/api/design-partner", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(layout) });
    if (res.status === 429) return recorded("You asked a few times already, so the live partner is resting.");
    if (!res.ok) return recorded("The live partner is not available here right now.");
    const data = (await res.json()) as { reply?: string };
    return data.reply ? { kind: "live", text: data.reply } : recorded("The live partner gave no answer.");
  } catch { return recorded("The live partner was too slow."); } finally { clearTimeout(t); }
}
