# Designer single prompt check

- Date: 2026-11-04.
- The sole Design Partner system prompt is `SYSTEM` in [the server API](../../../functions/api/designer.ts).
- The unused client prompt was removed after merging its optional-field and no-edit instructions into that live prompt.
- The [live browser check](../../../scripts/partner-proof-check.mjs) asked the real Muse Spark Open model to move an existing block 0.5 m along the lane.
- The model returned `[{"piece":1,"dx":0.5}]`, omitting unchanged fields.
- The actual simulator verified the preview, and Apply and Play reused that successful run.
- One paid Baseten request was made, with an estimated budget under US$0.03 and no Meta Model API credit used.
- Actual billing was not measured because the app endpoint does not return provider token usage or billing.
- The [run record](run.json) contains the result summary; the raw response stays outside git.
