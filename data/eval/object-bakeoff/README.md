# CC-55: object bake-off (SAM 3D, TRELLIS.2, Pixal3D; Tripo waiting on credits)

*Serves the world: which source gives the objects that collide and look right.*

## Result
- **TRELLIS.2 and Pixal3D were not run.**
  - Both load Meta's DINOv3 image encoder (`facebook/dinov3-vitl16-pretrain-lvd1689m`) when they start.
  - That repository is gated: a person must log in to Hugging Face and accept the DINOv3 License.
  - The `sam-hf` account does not have that access (probe below: `GatedRepoError`, 403).
  - Nobody accepts a licence for the product owner, so both models stopped here.
- **TRELLIS.2 also loads `briaai/RMBG-2.0`** (gated, no access).
  - It can be skipped by giving the model a cut-out with transparency (we already have SAM 3 masks).
  - Its licence is non-commercial, so it should stay out of the game either way.
- **Pixal3D's `main` branch is built on the TRELLIS.2 backbone**, so it has the same gate.
- **Tripo was not run on objects**, as agreed (no new paid steps, and Tripo's trial credits do not work through the API).
  - No Tripo object run exists from before: Tripo made only the two Rookies.
- **So the only object source with results is SAM 3D Objects** (CC-38).
  - Its nine results went through the mesh census (CC-50), see `sam3d-census.json`.

## Probe (CPU only, nothing downloaded, nothing accepted)
| Repository | Access with the existing `sam-hf` account |
|---|---|
| microsoft/TRELLIS.2-4B (MIT) | yes |
| microsoft/TRELLIS-image-large | yes |
| TencentARC/Pixal3D (MIT) | yes |
| facebook/dinov3-vitl16-pretrain-lvd1689m (DINOv3 License) | **no, gated** |
| briaai/RMBG-2.0 | **no, gated** |
| tencent/Hunyuan3D-2.1 (Tencent Community License) | yes, but the licence excludes the EU, UK and South Korea |
| stabilityai/stable-fast-3d | no, gated |

## Census of the SAM 3D results
- Eight of nine pass; park06 (a 33 m slab) is refused for size, as we judged by eye in CC-38 (it was never shipped).
- The census found no other defect above 1% of triangles.
- Photo-box proportions are in the file, but a photo box is not a true measurement (perspective), so they are not a pass line.
- Sizes of the shipped objects come from typical heights (`scale_source`), not from any model, so there is no real-world size to score a new model against.

## Cost
- Modal: three CPU-only probe runs, a few seconds each, under $0.01.
- GPU: none.

## Update 2026-10-28: SAM 3D vs Tripo, stopped at the Tripo quote
- **So what:** the Tripo side needs credits we do not have; the product owner decides whether to top up.
- **Balance:** 60 credits (read-only check, no task created); one credit is $0.01.
- **Price:** one textured object costs about 110 credits (what the Rookies cost), so six objects are about 660 credits.
  - The cheapest listed run (a plain model, 10 credits) for six objects is 60 credits, all of the balance.
- **Rule we set:** go ahead only when the total is at most 300 credits and at most 25% of the balance, so the run did not start.
- **SAM 3D side:** all six objects already have results (CC-38), so it needed no new Modal run ($0).
- **Terms, as far as public pages show (the Tripo pricing and terms pages refused my fetch, 403):**
  - Tripo's help page says paid users have full rights to use and sell what they generate.
  - It says free-user outputs stay with Tripo (stricter than its blog, which reads CC BY 4.0 as allowing commercial use with credit).
  - Nothing found about whether API outputs follow the same plan rules, or about the collaboration program; the product owner should check both in the program's paperwork.
- **To unblock:** top up about 660 credits ($6.60) or run three objects (about 330 credits, just over our own 300 cap, so the cap needs a new decision).

## Access re-check (2026-10-28, after the product owner requested DINOv3 access)
- **So what:** TRELLIS.2 and Pixal3D still cannot run, because the account behind the `sam-hf` secret has no DINOv3 access yet.
- **Result of the CPU probe** (`pipelines/objbake/probe_access.py`, no GPU, nothing downloaded or accepted):
  - open to us: `microsoft/TRELLIS.2-4B`, `microsoft/TRELLIS-image-large`, `TencentARC/Pixal3D`, `tencent/Hunyuan3D-2.1`
  - still 403: `facebook/dinov3-vitl16-pretrain-lvd1689m`, `briaai/RMBG-2.0`, `stabilityai/stable-fast-3d`
- **Which account:** the secret belongs to the Hugging Face user `gitgithan`; the access request has to come from that account, or the secret has to be swapped for a token of the account that was approved.
- **Likely cause:** approval for gated Meta repos can take a while, or the request was made from another account.
- **Next:** run the probe again after approval; if DINOv3 shows "yes", TRELLIS.2 and Pixal3D run on one Modal GPU (cap $10) with a plain crop or SAM 3 mask instead of RMBG-2.0.
- **Cost of this check:** about $0 (two CPU runs).

## Update 2026-10-28: TRELLIS.2 and Pixal3D ran (DINOv3 access granted)
- **So what:** the full write-up is in `docs/world-slice.md` ("Object bake-off (CC-55)"); TRELLIS.2 draws thin rails best, SAM 3D Objects is the safest to ship, Pixal3D is not ready.
- **Access:** the probe now says `yes` for DINOv3 on the `sam-hf` account; `briaai/RMBG-2.0` and `stabilityai/stable-fast-3d` are still `no`, and neither was needed.
- **Inputs:** `inputs/*.png` are RGBA cut-outs from the SAM 3 masks of CC-38 (a plain box crop for the railing, whose mask covers 1%).
- **Runs:** `pipelines/objbake/modal_app.py` (one L40S, xformers attention, a stand-in for RMBG-2.0, 100,000 faces and a 1,024 texture); `outputs/trellis2.json` and `outputs/pixal3d.json` hold seconds and the cost estimate.
- **Cost:** about $0.31 (TRELLIS.2) plus $0.34 (Pixal3D) plus about $0.8 for one stalled Pixal3D run, and image builds (CPU); well under the $10 cap.
- **Census and sheets:** `open-models-census.json`, `sheet-3q.png`, `sheet-side.png`.
- **GLBs:** 54 MB in `../conquercourse-assets/objbake/` with `SHA256SUMS`, not in git.
