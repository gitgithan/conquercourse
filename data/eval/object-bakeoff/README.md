# CC-55: object bake-off (stopped at a licence gate)

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
