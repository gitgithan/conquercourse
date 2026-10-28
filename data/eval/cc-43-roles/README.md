# CC-43: roles for pieces and the Moves window

- **What is here:** screenshots from the editor check on a Vultr VM.
  - `moves-window.png`: the Moves window beside the 3D view, with the ten moves and the selected piece.
  - `layout-1024x640.png`: the side panel fits again at 1024 x 640.
- **Tests:** `tests/roles.test.ts` (20 tests) proves each role with a small world that clears with the role and not without it.
- **Editor check:** the new checks pass (ten moves listed, the coaster is elsewhere, a role is saved, suggestions come back, a suggestion opens the shared preview).
  - `adviceOffered` still fails on the VM (the advice clock is shorter than one proof there; see CC-70).
  - `partnerAnswers` fails on the VM because the design partner key lives on the laptop.
