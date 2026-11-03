# Editor proof handoff: live model check

- Date: 2026-11-04.
- Result: the simulator's preview proof reaches Apply and Play without another ideal-run search.
- The [run record](run.json) contains the input world, call count, checks and evidence paths.

## Inputs and dependencies

- The editor contained one built-in ground block and no devices.
- The request asked Muse Spark Open to move that block 0.5 m further along without changing its other settings.
- The actual `/api/designer` endpoint called Muse Spark Open on Baseten.
- The browser used the actual TypeScript simulator workers.
- The existing device-parity tests separately checked ordinary lanes, trebuchets, drones, launchers, cannons and elastic bands.
- No player data, photos or secrets were included in the test request.

## What passed

- Both live calls returned a concrete edit for the existing block.
- The UI presented the edit as unverified until the simulator finished.
- Apply remained disabled during checking, including when its handler was invoked directly.
- A completed positive result included a successful run before being shown as verified.
- Switching the proposed change off and back on reused the checked selection.
- Apply immediately updated the main simulator verdict from the matching proof.
- Play received the same successful run without starting another ideal-run search.
- Each browser run made two ideal-run searches: the original course and the proposed course.
- Apply and Play each made zero additional ideal-run searches.
- The final run had no browser page errors.

## Evidence

- [Checking, with Apply disabled](../../../docs/evidence/partner-proof/checking.jpg).
- [Simulator-verified preview](../../../docs/evidence/partner-proof/verified.jpg).
- [Applied, with the verified run ready](../../../docs/evidence/partner-proof/applied.jpg).
- [Reproducible live browser check](../../../scripts/partner-proof-check.mjs).
- [UX and data-flow diagrams](../../../docs/editor-proof-flow.md).

## Cost and limits

- Two real Muse Spark Open calls were made, with a maximum of 4,000 output tokens per call.
- The stated total budget estimate was about US$0.05.
- Baseten listed US$1.25 per million input tokens and US$4.25 per million output tokens when checked: [pricing](https://www.baseten.co/pricing/).
- These calls used the configured Baseten account rather than Meta Model API credit.
- The remaining Baseten credit and actual billed cost were not verified.
- The app endpoint does not return provider token usage or billing information.
- This live case covers a plain course; device coverage comes from builder-parity regression tests.
- A failed search means no clear run was found, rather than a proof that no run is possible.
