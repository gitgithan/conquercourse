# Model ledger: what calls which model, and which credit pays (CC-208)

*Written 2026-10-31 from the code on `main` (grep of `functions/`, `src/`, `scripts/`, `pipelines/`, `server/`).*
*The product owner asked: what is using the Meta Model API credit, are the docs right, and why Baseten, an API key or our own model.*

## So what
- Only one thing a player can start spends Meta Model API credit: the character maker.
  - Each character makes one Muse Image call and one SAM 3.1 call from a Modal job that holds the Meta key.
  - Recorded cost: about $0.0125 of Meta credit per character (`docs/community-characters.md`).
  - Whether the preview or live site has the secret set is not recorded in the repo, so whether it runs today is unverified.
- Everything else the Meta credit paid for was our own build-time work: Muse Wonder code review, SAM 3.1 on video frames, vision calls, evaluation runs.
  - The only total we have written down is Muse Wonder at $2.38.
  - No file records the Meta credit balance or the total spent, so "what is using my credit" cannot be answered as one number from the repo.
  - The place to read it is the Meta Model API dashboard, not the repo.
- The live Muse Spark Open features (designer, move tips, upload check, character prompt check; the Course Agent has no player entry since 2026-10-31) are paid from the Baseten credit, not the Meta credit.
- Some of our choices were never compared with the alternatives; section 3 says which, and what a comparison would cost.

## 1. Every call site

Legend for "Who can trigger it":
- **Player** means a person using the site can start it, so it spends credit while we sleep.
- **Owner only** means a script or a pipeline run by us.

Legend for "Credit":
- **Meta** is the Meta Model API credit (`api.meta.ai`, key `META_API_KEY`).
- **Baseten** is the Baseten credit (`inference.baseten.co`, key `BASETEN_API_KEY`).
- **Modal** is the Modal account (GPU seconds).
- Which of Baseten and Modal is paid by a sponsor credit and which by a card is not written in any repo file I read; `docs/research/meta-rules-api.md` lists the sponsor offers, and `data/eval/cc-126-course-agent/README.md` says "the hackathon credits cover" the Baseten price.

### 1a. Live paths (a player action can trigger them)

| Feature | Model | Endpoint or host | Credit | Cost per call, with source | Who can trigger it |
|---|---|---|---|---|---|
| **Character maker, step 1: picture** | Muse Image (`muse-image-1.0`) | `api.meta.ai/v1/images/generations`, called from the Modal job `cc-character-maker` (`pipelines/charmaker/providers/route_a.py`) | **Meta** | about $0.01 a picture (`docs/community-characters.md`) | Player: Characters panel, `/api/character` |
| **Character maker, step 2: cut-out** | SAM 3.1 (`sam-3.1`) | `api.meta.ai/v1/responses`, same Modal job | **Meta** | about $0.0025 a call (`docs/community-characters.md`) | Player, same request |
| Character maker, step 3: mesh | SAM 3D Objects | Modal app `cc-photo-to-object`, class `Lift` | Modal | about $0.005 to $0.04 of GPU time depending on cold start (`docs/community-characters.md`) | Player, same request |
| Character maker, prompt check | Muse Spark Open | Baseten, `/api/character` calls `askModeration` on the text | Baseten | about $0.003 a call for the check (`data/eval/cc-119-moderation/README.md`) | Player |
| Designer and Fix it | Muse Spark Open | Baseten, `functions/api/designer.ts` | Baseten | "well under 1 cent" estimated from token counts in `docs/deploy.md`; not measured per call | Player: World Editor |
| Course Agent (no player entry since 2026-10-31) | Muse Spark Open | Baseten, `functions/api/course-agent.ts` (text only; the photo input was dropped) | Baseten | $0.26 for 40 photo-in runs and 36 model calls (`data/eval/cc-126-course-agent/README.md`) | Nobody: no button in the editor |
| Move tips | Muse Spark Open | Baseten, `functions/api/move-tips.ts` | Baseten | about $0.01 an object (`data/eval/cc-119-move-tips/README.md`) | Player: object cards |
| Upload safety check | Muse Spark Open | Baseten, `askModeration` in `functions/api/moderate.ts`; called by `/api/object-lift`, `/api/segment`, `/api/community-items` and `/api/character` | Baseten | about $0.003 a call (`data/eval/cc-119-moderation/README.md`) | Player: every photo upload and every Share in Community |
| Photo to object, mask and suggestions | SAM 3 (open weights, our copy) | Modal, `pipelines/photo_to_object.py`, via `/api/object-lift` and `/api/segment` | Modal | about 2 cents an object end to end (`docs/pipelines.md`) | Player: Community photo upload |
| Photo to object, lift | SAM 3D Objects | Modal, same app | Modal | same row | Player |
| Street photos | Mapillary | `graph.mapillary.com`, via `/api/photos` and `/api/features` | none we pay (a free token held as a server secret) | not applicable | Player: World Slicer places |
| Building outlines | OpenStreetMap mirrors | via `/api/places`, cached 30 days | none (public servers) | not applicable | Player: a pin on the map |

### 1b. Build time or owner only (a player cannot trigger them)

| Job | Model | Endpoint or host | Credit | Cost, with source |
|---|---|---|---|---|
| Code review of the simulator | Muse Wonder (`muse-wonder-1.0`) | `api.meta.ai/v1/chat/completions`, `scripts/wonder-review.mjs` | **Meta** | $2.38 for the run (`docs/hackathon.md`, `data/eval/cc-wonder-review/README.md`) |
| Photo triage comparison | Muse Wonder and Muse Spark Open | `scripts/triage_v2.py`: Wonder on the Meta API, Spark Open on Baseten | **Meta** and Baseten | Wonder "2 to 3 times" the Spark Open cost per photo (`data/eval/cc-145-triage-v2/README.md`); no dollar total read |
| Video ingest: segment obstacles | SAM 3.1 | `api.meta.ai` through `server/sam-proxy.mjs`, `pipelines/ingest_video.py` | **Meta** | the code assumes $2.50 per 1,000 images (`SAM_PER_IMAGE`); a measured total per clip is in each run's `run.json` where kept |
| Video ingest: vision calls | Muse Spark 1.3 (`muse-spark-1.3`) | `api.meta.ai`, `pipelines/ccpipe/vision.py` | **Meta** | the code assumes $0.06 a call (`META_CALL_USD`); list price $1.25 in and $4.25 out per million tokens |
| SAM 3.1 spike on park photos | SAM 3.1 | `pipelines/sam31_park.py` through the proxy | **Meta** | in `data/eval/sam31-park/`; not re-read here |
| Course drafts in bulk | Muse Spark Open | Baseten, `scripts/bulk-courses-ask.ts` | Baseten | about $1.6 for 100 calls (`data/eval/cc-122-bulk-courses/README.md`) |
| Photo triage, feedback clustering, evals | Muse Spark Open | Baseten, `scripts/photo-triage.ts`, `scripts/feedback-cluster.ts`, `scripts/course-agent-eval.ts` | Baseten | about $0.1 for the photo triage (`data/eval/cc-123-photo-triage/README.md`); the others not read |
| Body from video, 3D objects, privacy masks | SAM 3D Body, SAM 3D Objects, SAM 3 (open weights) | Modal apps in `pipelines/` | Modal | per run in each experiment README; not summed |
| Generated motion | Kimodo with a Llama 3 text encoder | Modal, `pipelines/kimodo_*.py` | Modal | "5-20 s on an L4" (`docs/experiments.md`); not summed |
| Music loops | MusicGen medium | Modal, `pipelines/music_loops.py`, `music_film*.py` | Modal | not measured in a file I read |
| Rookie meshes | Tripo | Tripo web service; `TRIPO_API_KEY` slot is a stub in `src/characters/providers.ts` | Tripo credits (60 left per `docs/community-characters.md`) | about 110 credits a character (`docs/lessons.md`) |

### 1c. Not in the repo's code
- EgoBlur is **not used** in production.
  - `docs/pipelines.md` says it could replace or join SAM 3 once its weights are obtained.
  - What the code does for people in an uploaded photo: SAM 3 finds people, faces and licence plates on Modal, then people are blurred and faces and plates pixelated before the lift model sees the photo (`pipelines/ccpipe/privacy.py`, called from `pipelines/photo_to_object.py`).
  - Anything SAM 3 does not find stays visible.
- Fireworks is named in `docs/spec/SPEC.md` for "simulated students", but no code calls it.
- The fallback "Muse Spark on the Meta API" for the designer is named in SPEC section 7, but no function falls back to it: each function calls Baseten only.
- Muse Voice Transcribe and Muse Code are named in the film plan; the repo has no call to them.

## 2. Why this host, feature by feature

Facts come from repo files, named in each bullet.
Anything marked **assumption** has no written reason in the repo.

### 2a. Live Muse Spark Open features: Baseten serverless
- **Why Spark Open at all:**
  - The "Best Build on Meta Open Weights" prize wants a build on Muse Spark Open or Muse Glimmer through partner inference (`docs/research/meta-rules-api.md`, prize list).
  - The designer and checks are text and image tasks that a hosted model does well.
- **Why Baseten rather than the Meta API's own Muse Spark:**
  - The per-token price is the same on both: $1.25 in and $4.25 out per million (`docs/research/meta-rules-api.md`, provider table and the Muse Spark 1.3 line in `docs/research/muse-wonder.md`), so price is not a reason.
  - `functions/api/designer.ts` says the hackathon Baseten key works only with this one model; so the key choice and the model choice come together.
  - The Meta API credit is a $150 allowance for a 10-day window (`docs/research/meta-rules-api.md`); Baseten is a separate sponsor credit.
    - **Assumption:** keeping live player traffic off the Meta credit was part of the reason.
    - No file says so; the file that does say something is SPEC section 7, which lists Baseten first because of the prize.
  - SPEC risk table says Muse Spark on the Meta API took about 40 s with reasoning; Spark Open also reasons first (`functions/api/designer.ts` leaves 4,000 tokens for it).
    - So latency is not shown to be better on Baseten; it was never compared.
- **Why serverless on Baseten rather than our own deployment of Spark Open:**
  - Size, from `docs/research/meta-rules-api.md`: 816B parameters in total, 42B active, 537 GB at NVFP4 on a 4-GPU Blackwell node, 1.65 TB at BF16 on 8 GPUs.
  - Baseten, Fireworks and Modal all sell it serverless at the same token price, so a single answer costs a fraction of a cent (section 1a).
  - A node of that size by the hour is only worth it at steady, high traffic; our traffic is a few test sessions.
  - The hourly price of such a node is not in the repo, so the break-even point is **not measured**.
  - **Assumption:** the prize's "verified by the infrastructure partner" is easiest to meet on a partner's own serverless endpoint.
- **What is weak about the current choice, in plain words:**
  - Players' uploaded photos go to a third-party host (Baseten) for the safety check.
    - SPEC section 7 forbids sending private photos to Meta's cheaper contributor models because Meta may train on them.
    - Baseten's own data terms are **not recorded** in the repo, so whether that matches our privacy promise is unverified.
  - One host and one key: if Baseten is down or the credit ends, every live feature answers 503 (`functions/api/*.ts` check for the key), and the SPEC fallback was never built.
  - The credit has a limit; the Baseten balance is not recorded in the repo either.

### 2b. Safety check: Spark Open now, a small classifier as the other choice
- **Today:**
  - A reasoning model of the size above reads each photo and answers ok, review or block (`functions/api/moderate.ts`).
  - Measured: 19 of 19 safe photos ok, 7 of 7 text-only unsafe cases caught, 4 of 4 near misses not blocked, about $0.003 a call (`data/eval/cc-119-moderation/README.md`).
  - Not tested: real harmful images (`docs/meta-ai-pipelines.md`, section 4b).
  - It fails closed: any error becomes review.
- **Why it was chosen:**
  - It was already wired and paid for, and one prompt handles pictures and captions.
  - **Assumption:** speed to build, not a comparison, was the reason; no file compares it with a classifier.
- **The product owner's view (2026-10-31):**
  - Baseten with an over-powered model is the most convenient, because a small guard model would need its own GPU deployment on Modal.
  - That holds only if the guard model is not already served by someone.
  - Costed trade-off:
    - Stay on Spark Open: no new deployment, one key, about $0.003 a call, 2 to 3 s a call on the text cases, but a very large reasoning model for a yes/no job.
    - Guard model on Workers AI: no GPU of ours, because Cloudflare serves `@cf/meta/llama-guard-3-8b` (`docs/research/infra.md`, with a free daily allowance); it reads text only there.
    - Guard model on Baseten: **unknown**; one short web search found no Baseten listing of a Llama Guard model, so it may need our own GPU after all.
    - Picture-reading guard (Llama Guard 4): the search showed it hosted by Together AI, DeepInfra, Groq and OpenRouter, and did not show it on Cloudflare or Baseten; **unverified**.
    - Own GPU on Modal: the hourly price is not in the repo, so not costed.
  - So the owner's view is right for pictures today, because no cheaper host is confirmed that reads them.
  - It is weaker for caption-only checks (the character prompt check), where Workers AI serves a text guard with no GPU of ours.
  - Next step if wanted: test the Workers AI guard on the text-only cases first.
  - The full call-by-call list is in [llm-calls.md](llm-calls.md).
- **The other choice, not tried:**
  - A small guard model built for this job, for example Llama Guard 3 on Cloudflare Workers AI (`@cf/meta/llama-guard-3-8b`, listed with a free daily allowance in `docs/research/infra.md`).
  - Facts: it is a text model in that note; whether a picture version exists on Workers AI is **not researched**.
  - Likely gains: lower cost and delay, a fixed answer format, and no reasoning budget to run out.
  - Likely losses: pictures may need a second model, and our near-miss cases (a person in the background, a private place) may need tuning.
  - Cost to try: about half a day; run the same cases in `data/eval/cc-119-moderation/inputs/cases.json` and compare the table; money is near zero on the free allowance.
  - Do this before leaning on the check for real harmful images, because that is the case nobody has tested.

### 2c. Character maker: Meta API credit, by design
- Muse Image is a closed model that only the Meta API serves, so the picture step has to use an API key (SPEC section 7; `docs/character-pipeline.md`).
- SAM 3.1 is the API version of SAM; we already run the open SAM 3 on Modal for photos (`pipelines/photo_to_object.py`).
  - **Better option not tried:** use our Modal SAM 3 for the character cut-out as well.
  - Gain: the live Meta spend per character falls from about $0.0125 to about $0.01, and one fewer thing depends on the key.
  - Risk: the mask quality on cartoon pictures was only measured for SAM 3.1 (7 of 8 good masks, `docs/community-characters.md`).
  - Cost to try: a few hours to switch the step and rerun the same 8 prompts.
- Muse Image has no open replacement in the repo; open image models were **not researched**.
  - Cost to try: a research pass first (about half a day), because quality on a T-pose character is the whole point.
- Tripo is the paid alternative that was tested for the Rookies; it costs about 110 credits a character and the slot is a stub (`docs/lessons.md`, `src/characters/providers.ts`).
- The limits that cap how much Meta credit players can use are in the private notes folder, not here.

### 2d. Open weights on Modal vs an API key, for the build-time models
- **SAM 3D Body, SAM 3D Objects, Kimodo, DINOv3, Llama 3 encoder, MusicGen:**
  - They are open weights with no Meta API endpoint, so they run on Modal (SPEC section 7: "gated open weights, not on the Meta Model API").
  - There was no API-key option for these; the choice was Modal or another GPU host.
  - Other GPU hosts (our Vultr machines) were used for some experiments; a cost comparison between them is **not measured** in one place.
- **SAM 3 and SAM 3.1:**
  - SAM 3 weights run on Modal for player photos, where we need privacy blurring and a job we control.
  - SAM 3.1 through the API is used only for build-time video frames and the character cut-out.
  - **Assumption:** the API was used first because it needs no GPU, and Modal SAM 3 was added when photo uploads needed it; nothing was ever compared for quality or price.
- **Muse Wonder:** closed, API only; used once as a code reviewer, not in the game (`docs/research/muse-wonder.md`).

## 3. Better options we have not tried

| Idea | What it could fix | What it would cost to try | Status |
|---|---|---|---|
| Small guard model for the upload check | cost, delay, fixed output; the check is currently unproven on real harmful images | about half a day, near-zero money | not tried |
| Our Modal SAM 3 for the character cut-out | less Meta credit per character, one fewer key use | a few hours | not tried |
| The built fallback from Baseten to the Meta API Muse Spark | live features survive a Baseten outage or a spent credit | about half a day; spends Meta credit when used | SPEC promised it; not built |
| Spark Open in our own Modal endpoint | no third-party host for player photos; the prize's "own hardware" route | a Modal endpoint for a 4-GPU class model; hourly price not in the repo | not tried, not priced |
| A smaller hosted model (Muse Glimmer 30B) for the checks | cheaper and faster, Apache 2.0 licence | Glimmer is dedicated-GPU only on the sponsors (`docs/research/meta-rules-api.md`); the only serverless host listed there is Together AI, which is not a sponsor | not tried |
| Measuring latency of Baseten Spark Open against Meta API Muse Spark on the same 10 designer prompts | answers "is Baseten faster" with data | an hour, a few cents | not tried |
| Recording credit balances in a file after each paid run | answers "what is using my credit" from the repo | minutes per run | not done |
