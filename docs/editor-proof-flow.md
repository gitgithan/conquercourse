# Design Partner suggestions and simulator proof

- Updated 2026-11-04.
- The Design Partner proposes edits; the TypeScript simulator supplies every clearance verdict.
- Preview, the applied editor lane and Play use the same course builder and share complete simulator results.

## Choose the action and engine

| Old label | New label | Engine | What happens |
| --- | --- | --- | --- |
| Fix it | Find a repair | Simulator · game physics | Searches for layout or device changes and tests them. Review any result before Apply. |
| What should I change? | Ask AI for ideas | AI · Muse Spark Open | Suggests object moves from the course and question. The simulator checks the exact preview. |
| Suggest Fix / Suggest More | Ask AI for repair ideas / Ask AI for more ideas | AI · Muse Spark Open | Sends a ready-written question to the model. |
| Ask | Send to AI | AI · Muse Spark Open | Sends the question in the input box. |
| Make it easier | Make it easier | Simulator · game physics | Searches for a wider press window. |
| Look for routes you did not plan | Find shortcut routes | Simulator · game physics | Simulates alternate routes that skip obstacles. |

- The toolbar menu is Improve because it includes both simulator tools and AI ideas.
- Every menu action shows its engine, when to use it and what to expect.
- The menu opens below the toolbar and navigation, above the help panel, keeping its explanations readable.
- The shared panel says Course help; the Muse Spark Open badge sits beside the AI input, rather than above simulator tools.
- Proposal headers name the source of the edits; the separate simulator verdict describes the exact preview.
- Verify Suggestions would imply checking a fixed proposal, while Find a repair searches for changes itself.
- Verification already happens automatically in Preview; no extra verification button is needed.
- Labels and explanations share one source in [editor-actions.ts](../src/ui/editor-actions.ts).
- Action IDs, prompts, engines and proof handoff are unchanged.
- The selected-pieces checkbox names its actual scope: simulator platform-layout repair, rather than AI ideas or every device/bar search.

```mermaid
flowchart TD
  MENU["Improve · choose an engine"] --> REPAIR["Find a repair<br/>Simulator · game physics"]
  MENU --> IDEAS["Ask AI for ideas<br/>Muse Spark Open"]
  REPAIR --> SEARCH["Search for and test changes"]
  IDEAS --> AI["Suggest object moves from course and question"]
  AI --> SHOW["Preview suggested changes"]
  SEARCH --> PREVIEW["Exact proposed course"]
  SHOW --> PREVIEW
  PREVIEW --> CHECK["Simulator checks or reuses matching proof"]
  CHECK --> VERDICT["Simulator verdict · separate from edit source"]
  VERDICT --> APPLY["User chooses Apply"]
```

## What changed in the editor

- Send to AI shows that the Partner has suggested changes that are not checked yet.
- The UI shows concrete edits instead of displaying the model's free-text answer as a clearance claim.
- Preview suggested changes builds a preview without moving the current pieces.
- Apply stays disabled while the simulator is checking the preview.
- A successful check says "Simulator verified: this lane can clear."
- A failed search says it did not find a clear run; it does not claim the course is impossible.
- Apply is available after a completed positive or negative check.
- Apply and try it is available only after a positive check.
- A stopped or failed preview check supplies no proof and leaves Apply disabled.
- Switching a change off invalidates the preview proof until that exact selection has been checked.
- Switching back to an already checked selection reuses its result.
- Apply updates the main simulator verdict immediately from the matching proof.
- Play receives the same successful run and timing windows instead of searching again.
- Editing a physics input or a device setting requires a check for the new course.

```mermaid
flowchart TD
  A["Ask AI for ideas · Muse Spark Open"] --> B["Suggested edits: not checked"]
  B --> C["Preview suggested changes"]
  C --> D["Preview the current world with those edits"]
  D --> E["Simulator checks the exact course<br/>Apply disabled"]
  E -->|"Clear run and plan found"| F["Simulator verified<br/>Apply or Apply and try it"]
  E -->|"No clear run found"| G["Search did not find a clear run<br/>Apply or Find a repair from here"]
  E -->|"Check could not finish"| H["Not verified<br/>Apply disabled"]
  F --> I["Apply changes"]
  G --> I
  I --> J["Matching result updates the editor immediately"]
  J --> K["Play reuses the successful run, when present"]
  D -->|"Toggle a suggested edit"| D
```

## Data flow

- The only Design Partner system prompt is `SYSTEM` in [the server API](../functions/api/designer.ts).
- The server appends the world description and conversation when it calls Muse Spark Open.
- [designer.ts](../src/slice/designer.ts) builds that world description and validates returned edits; it contains no second prompt.
- [helper.ts](../src/modes/editor/helper.ts) turns accepted model edits into a proposal and a preview snapshot.
- [lane.ts](../src/modes/editor/lane.ts) builds both preview and live courses through `courseFor`.
- [search.ts](../src/modes/editor/search.ts) gives preview and live checks independent workers with a shared result store.
- A stored result contains the clearance verdict, successful run, timing windows and routes returned by the simulator.
- The result key serializes the search input, including terrain, movement parameters and active device settings.
- Source metadata, hazard appearance and designer-marked shortcuts are excluded from that key.
- The store holds at most 24 checked course variants for the current editor session.
- Apply compares the preview course with the checked course before changing the world.
- The applied course must match a stored result before the UI says its verified run is ready.
- [verify.ts](../src/modes/editor/verify.ts) stops an obsolete live search and publishes a matching result without starting a new search.
- `withProof` attaches the successful run and timing windows when the course is sent to Play.
- Cancelled workers and late preview answers cannot overwrite a newer preview.
- A positive worker response without a run plan is rejected rather than displayed as verified.

```mermaid
flowchart LR
  INPUT["Server SYSTEM<br/>world description and conversation"] --> AI
  AI["Muse Spark Open<br/>proposed edits"] --> P["Proposal and preview snapshot"]
  W["Current editor pieces<br/>lane and active device settings"] --> P
  P --> B["courseFor<br/>shared course builder"]
  W --> B
  B --> K["Exact search-input key"]
  K --> R{"Matching full result?"}
  R -->|"No"| S["TypeScript simulator worker"]
  S --> C["Shared store<br/>verdict, run, windows, routes"]
  R -->|"Yes"| C
  C --> V["Preview verdict"]
  V --> A["Apply and rebuild the live course"]
  A --> K
  C --> M["Main simulator verdict"]
  C --> PLAY["Play with the same successful run"]
```

## Only devices currently added are checked

- Preview checks the current setup after the proposed edits, including a device's proposed position.
- It does not add devices or try configurations that are absent from the editor.
- When more than one device is present, the existing Play precedence is preserved: trebuchet, drone, recoil launcher or cannon, then elastic band.

| Added device | Settings included in the shared course |
| --- | --- |
| Trebuchet | Counterweight, arm setting, pin angle and pivot position |
| Drone | Payload, battery, pad position and pad length |
| Launcher or cannon | Kind, projectile mass, muzzle speed, pad position and pad length |
| Elastic band | Current stiffness and the existing band defaults |
| None | The ordinary lane with no device added |

## Checks and evidence

- [Proof handoff tests](../tests/editor-proof-handoff.test.ts) replay a real simulator plan and verify reuse, changed-input invalidation, cancellation and missing-plan rejection.
- [Device tests](../tests/editor-preview-devices.test.ts) compare preview and live courses for each currently supported device.
- [Verdict tests](../tests/editor-verify.test.ts) check that a matching proof updates the main verdict without another search.
- [Live browser check](../scripts/partner-proof-check.mjs) calls the actual Muse Spark Open endpoint and uses actual simulator workers.
- The browser check verifies disabled Apply during checking, reuse after toggling, immediate Apply and reuse in Play.

- [Live run record](../data/eval/partner-proof-handoff/README.md) records the two real model calls and their validation results.
- Screenshots: [checking](evidence/partner-proof/checking.jpg), [verified](evidence/partner-proof/verified.jpg), [applied](evidence/partner-proof/applied.jpg).

## Make it easier proof source

- The current lane proof includes full `timingWindows` for selecting the hardest obstacle, alongside the filtered positional `windows` used by the drawing.
- Make it easier reads that proof and evaluates changed courses in cancellable workers.
- The winner's complete proof is inserted into the same cache used by Preview, Apply and Play.
- No additional winner search is needed when the proposed course matches.
- [Before/after, blockers and measurements](easier-search.md).

## Action attribution pictures

- [Improve menu with engine labels](evidence/editor-action-engines-menu.jpg).
- [Course help with model attribution beside the AI input](evidence/editor-action-engines-panel.jpg).
