# Meta Global AI Developer Hackathon: rules, Meta Model API, open weights

- **Researched:** 2026-10-27 (hacking began 2026-10-26).
- **Method:** public pages fetched without signing in; the Cerebral Valley pages are JavaScript apps, so the rules text came from the rich-text JSON embedded in the HTML of the [waiver page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver).
- **Meta docs:** every page has a Markdown twin (`https://dev.meta.ai/docs/<page>.md`), indexed at [dev.meta.ai/llms.txt](https://dev.meta.ai/llms.txt).
- **No paid calls were made.**
  - The only calls to `api.meta.ai` were an unauthenticated CORS preflight (`OPTIONS`) and `GET /v1/status`, which needs no key.
- **Labels:**
  - **[official]** = quoted from a Meta or Cerebral Valley page.
  - **[owner-relayed]** = text the product owner pasted from the participant dashboard or email (behind sign-in, so I could not re-fetch it).
  - **[unverified]** = not confirmed.

## 1. Rules

### Where the rules live
- **Event page [official]:** [cerebralvalley.ai/e/meta-ai-developer-hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), with a Markdown copy at [/meta-ai-developer-hackathon.md](https://cerebralvalley.ai/e/meta-ai-developer-hackathon.md).
- **Official Rules and waiver [official]:** [/waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver), titled "Hackathon Terms & Conditions ("Official Rules") and Event Waiver", dated October 25, 2026.
- **Meta's copy of the event page [official]:** [dev.meta.ai/events/global-hackathon](https://dev.meta.ai/events/global-hackathon).
  - It repeats the dates, tracks and themes.
  - It has no bonus prizes, no banned list and no submission format.
- **Participant dashboard and submit form:** [/hackathon/submit](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) needs sign-in.
  - The rule summary and bonus prizes below come from it via the owner **[owner-relayed]**.

### Eligibility [official, waiver]
- "Participants must be at least 18 years old to join the Hackathon and the age of majority in the applicant's jurisdiction of residence."
- **Countries:** open worldwide "except in countries where local law prohibits participation or the receipt of an award".
  - Excluded: anyone targeted by US, EU, UN or UK sanctions or export controls, and anyone "organized or located in Belarus, China, Russia, Ukraine, Syria", Crimea, Donetsk, Luhansk, Cuba, North Korea or Iran.
- **Excluded people:** "Employees, contractors, and interns of Meta and Cerebral Valley, government-affiliated individuals", their immediate families and anyone in the same household.
- **Accepted applicants only:** applications closed Oct 25, 11:59 PM ET, capped at 20,000.
- **Virtual only:** "participation is virtual only."

### Tracks and judging [official, waiver]
- "There are two (2) tracks. A participant may apply for one (1) track only, and a project submission may be entered in one (1) track only."
- **Indie Developer track:** "Open to individual builders and students, teams of up to four (4)".
  - "The Representative shall identify all other team members in the project submission."
  - **Prizes:** $400,000 in total, split $150k / $100k / $75k / $50k / $25k.
- **Startup track:** "Open to technical founders building a product. The startup Representative must be an active employee of the startup".
  - **Prizes:** $550,000 in total, split $250k / $150k / $75k / $50k / $25k.
- **Track blurbs on the event page [official]:**
  - Indie is "Judged on creativity, technical ambition, and whether it works."
  - Startup is "Judged on technical execution and whether it holds up in production."
- **The scored criteria (same for both tracks) [official]:**
  - "Impact (30%) — the real-world potential of the Project, who benefits, how much it matters, whether it could become something people use, and whether it fits one of the problem statements".
  - "Use of Meta AI Tooling (25%) — how creatively the team used Meta's AI tooling, whether they went beyond a basic integration, and whether they surfaced unexpected capabilities".
  - "Technical Depth & Execution (20%) — whether the engineering is sound and thoughtfully refined and the Project demonstrates real craft".
  - "Demo (25%) — whether the Project has a working, impressive demo, whether the product holds up live, and the quality of the demo video."
- **Judges:** "Finalists will be chosen by a panel of Organizers selected judges ("Judges"). The judges' selections are final and binding."
- **Dates [official]:**
  - Judging runs Nov 4–8.
  - Nov 9 is the "Closing ceremony - live finals and winners announced".
  - Bonus and public-vote prizes are "announced on or about November 10, 2026".
  - The owner's screenshot gives Nov 16 for the Community Vote winner **[owner-relayed]**.

### Themes (problem statements) [official, event page]
- "**Build for Your World.** Bring Meta's models into your domain. Solve a problem you know firsthand, free up time and mental space, and make something possible that wasn't before."
- "**Push the Frontier.** Use Meta's models to tackle challenges in software, robotics, manufacturing, energy, materials and beyond. Give a machine a new capability, accelerate a scientific experiment, or unlock a better way to understand and control a physical system. Show us what becomes possible when these models meet the real world."

### New work only, and disclosing earlier work
- **[owner-relayed] (dashboard text, pasted 2026-10-26):**
  - "New work only. Everything you present has to be built during the hackathon, Oct 26 to Nov 4."
  - "Identify your contributions. Your demo has to show only the features, code and functionality your team built during the event. Judges need to be able to tell what's new. If they can't, the project is disqualified."
- **[official, waiver] ownership warranty:** the Submission must be "(a) ... their (or their applicable team's or organization's) original work product; (b) ... solely owned by the Participant ... and (c) does not violate the intellectual property or other proprietary rights ... of any other person or entity."
- **[official] outside help:** "Participants may contract with a third party for technical assistance, provided the Submission components remain the Participant's own work and the Participant owns all rights to them."
- **[official] open source:** "Participants may also include open source software or hardware, provided applicable open source licenses are followed and the Submission enhances or builds upon the underlying open source product."
- **[unverified]** No official text says *how* to disclose earlier work.
  - Nothing names a field on the form, a changelog or a git tag.
  - The waiver itself has no "new work only" clause; that rule exists only in the dashboard text.
  - A safe reading: start a fresh public repo after Oct 26, 12:00 PM ET, list any reused open-source code with its licence, and label new features in the video.

### Required Meta model use
- **[official, waiver]:** "Participants build with Meta AI products, including Muse Spark, Glimmer, SAM 3, and any other Meta AI products identified on the Event page."
- **[official, event page]:** "Use the Muse Spark series, Muse Wonder, Muse Image and SAM 3.1 through Meta Model API, run Meta open weights models, and code faster with Muse Code coding agent."
- **[unverified]** No minimum is stated (how many models or calls).
  - Use of Meta tooling is 25 % of the score, and the themes say "use Meta's models", so in practice Meta models must be central.
- **Credits [official, waiver]:** "Participants selected to participate in the Hackathon will receive $150 in Meta Model API credits, valid for a 10-day development window."
  - The linked "Credit Terms" PDF on fbcdn returned "Bad URL hash", so I could not read it **[unverified]**.

### Banned project categories [owner-relayed]
- "Banned projects. Disqualified if they break legal, ethical or platform policies, or use code, data or assets you don't have the rights to."
- "Also avoid the generic stuff such as AI medical or health advice, Basic RAG apps, Simple image analyzers, "AI for education" chatbots, Job application screeners, Nutrition coaches, Personality analyzers, Sports analyzers or coaches".
- **[official] Code of Conduct:** the Organizers may disqualify anyone "whose behavior is disruptive, abusive, discriminatory, demeaning, or otherwise inconsistent with the spirit of the Hackathon".

### Submission requirements
- **[official]** "Participants will submit their project to Cerebral Valley's portal at https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit."
- **[official]** "Nov 4: Project submissions due by 9:00 PM ET".
  - The Markdown page says "submissions due Nov 5, 2026 UTC", which is the same moment (Nov 5, 02:00 UTC).
- **[owner-relayed]**
  - "Public repo. Your submitted repository must be public."
  - "Demo video. 3 minutes, required on the submission. It's one of the main things judges score."
  - "Public repo, working demo video link, every team member added."
  - "One person submits for the team."
- **[unverified]** Whether 3 minutes is a hard maximum or a target is not stated in the text I have.
  - Treat ≤ 3:00 as the limit.
- **[unverified]** The video host (YouTube, Loom and so on) and the form's other fields (write-up, Meta models used, track) are not visible without signing in.

### The five bonus prizes [owner-relayed, from a screenshot, 2026-10-26; recorded in memory]
- **[official] framing:** "The Organizers may award additional prizes of up to $50,000 in the aggregate for bonus awards recognizing standout projects or community achievements."
  - "Those categories may include, without limitation, a community vote award, most viral project award, or other unique or notable project categories".
  - "Additional prizes do not reduce the track prizes above."
- **Most Viral: $20K.** Most likes, reposts and comments on the X post of the demo, counted by Nov 8, 11:59 PM ET.
- **Best Build on Meta Open Weights: $10K.** A build on Muse Glimmer or Muse Spark Open, run on your own hardware or through partner inference, verified by the infrastructure partner.
- **Community Vote: $10K.** Votes in the project gallery, one per verified account; the winner is announced Nov 16.
- **Best Agentic Use-Case: $5K.** Judged on autonomy, effectiveness and practical usefulness.
- **Best Creative Build: $5K.** Uses Muse Image or Muse Wonder; judged on originality, execution and use of the model.
- **[unverified]** I could not re-read the exact wording, since it sits behind sign-in.
  - The criteria above are the owner's screenshot as summarised in memory, not verbatim quotes.
  - Note: a Cerebral Valley GLM event used this Most Viral wording: "Reach, shares, likes, comments, and overall engagement all count" ([llms-full.txt](https://cerebralvalley.ai/llms-full.txt)).

### AI-generated media, third-party assets, IP, publicity [official, waiver]
- **No rule on AI-generated media.**
  - The only constraints are the IP warranty and the banned "assets you don't have the rights to" **[owner-relayed]**.
  - So generated assets are fine if the tool's terms grant you the rights (for example, paid tiers for commercial rights).
- **The licence you grant:** "Entrant grants the Organizers ... a perpetual, irrevocable, worldwide, royalty-free, and non-exclusive license to use, reproduce, adapt, modify, publish, distribute ... the Submission for any purpose without restriction".
- **You keep ownership:** "the entrant retains ownership of all intellectual and industrial property rights (including moral rights) in and to the Submission."
- **No confidentiality:** "none of the Organizers can agree to obligations of confidentiality, non-use or non-disclosure ... your Materials will not be considered confidential or proprietary".
  - So keep private footage and private repos out of anything shared.
- **Recording:** the event may be recorded, and participants consent to the use of their "name, likeness, voice, image, chat messages, screen shares, and submissions in any media, worldwide, in perpetuity".
- **Payout:** prizes are paid in USD through Tremendous, after a W-9 or W-8BEN, "within 30 days" of verification.
- **Governing law:** California, with courts in San Francisco.

## 2. Meta Model API

### Basics [official]
- **Base URL:** `https://api.meta.ai/v1`.
- **Auth:** `Authorization: Bearer $MODEL_API_KEY`.
  - Keys look like `LLM_<id>_<secret>` ([authentication](https://dev.meta.ai/docs/authentication.md)).
- **Three wire formats on the same models** ([protocols](https://dev.meta.ai/docs/protocols.md)):
  - Responses `POST /v1/responses`;
  - Chat Completions `POST /v1/chat/completions`;
  - Anthropic-compatible Messages `POST /v1/messages` (base host `https://api.meta.ai`).
- **SDKs:** the OpenAI SDK, the Anthropic SDK, LangChain and LiteLLM all work ([sdks](https://dev.meta.ai/docs/sdks.md)).
- **Other endpoints:**
  - `GET /v1/models`;
  - Files `POST /v1/files`: 1 GiB per upload, 50 MB inline, 100 GiB per team, no expiry by default ([file handling](https://dev.meta.ai/docs/file-handling.md));
  - `GET /v1/status` (no auth).
- **Geography:** "Model availability can vary by country" ([Geographic Use Policy](https://dev.meta.ai/legal/geographic-use-policy)).
  - Muse Wonder is not available in South Korea ([models](https://dev.meta.ai/docs/models.md)).
- **CORS / browser use:**
  - The docs say "Keep keys out of client code: mobile and browser code is visible to users. Proxy requests through a server you control." ([authentication](https://dev.meta.ai/docs/authentication.md)).
  - Measured 2026-10-26: a preflight `OPTIONS /v1/responses` from origin `http://localhost:5173` returned `access-control-allow-origin: *`, `access-control-allow-headers: *`, `access-control-allow-methods: GET,POST,DELETE,OPTIONS`.
  - So browser calls are technically possible, but a key in the page would leak.
  - Use a server proxy (our dev-server partner plugin pattern).

### Models and prices ([pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits.md)) [official]

| Model ID | What | Price | Rate limit (per team) |
|---|---|---|---|
| `muse-wonder-1.0` | Frontier agentic, coding, computer use; preview; 1,048,576 ctx | $4.00 in / $0.20 cached / $20.00 out per 1M tokens; no Contributor mode | 3,000 RPM, 4M TPM |
| `muse-spark-1.3` | Latest Spark, "Recommended for new work"; 1,048,576 ctx; text/image/video/audio/PDF in | $1.25 in / $0.15 cached / $4.25 out per 1M | 3,000 RPM, 4M TPM |
| `muse-spark-1.2`, `muse-spark-1.1` | Earlier Spark versions (1.1 is Standard mode only) | same as 1.3 | 3,000 RPM, 4M TPM |
| `muse-spark-1.3-contributor`, `muse-spark-1.2-contributor` | Same model; your content may train Meta models | $0.10 in / $0.002 cached / $0.20 out per 1M | **150 RPM**, 3M TPM |
| `muse-image-1.0` | Image generation and editing (agentic: web/image search, code) | **$0.01 per image** (search included) | 150 RPM |
| `muse-voice-transcribe-1.0` | Speech to text, diarization, 25 languages | $0.18 per hour of audio | 256 concurrent streams; 16,000 streams/hour |
| `sam-3.1` | Segmentation of images and video | **$2.50 per 1,000 images; $0.20 per 1,000 video frames, minimum 50 frames per video request** | 3,000 RPM |

- **Extra charges:**
  - "Web search grounding: $2.50 per 1,000 search queries" on text models.
  - "No long-context premium".
  - Prompt caching is automatic.
- **Background responses:** 600 submissions per minute.
- **Retries:** exponential backoff with jitter; respect `Retry-After`; read the `x-ratelimit-*` headers.
- **Contributor-mode trade-off:** about 12 × cheaper input and 21 × cheaper output, but 150 RPM, and "use your content ... to train future Meta models".
  - Don't send minors' or private footage through `-contributor`.
- **Spark 1.3 caveat:** "Audio understanding in Muse Spark 1.3 is not fully supported"; use 1.2 or Voice Transcribe for audio.
- **[unverified] Latency:** no published latency figures for any model.
  - The reasoning page warns: "expect an initial latency before the first visible content chunk in streaming mode".

### Reasoning effort / fast mode ([reasoning](https://dev.meta.ai/docs/reasoning.md)) [official]
- **Levels:** `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`.
  - "`none` ... **Not supported by Muse Wonder or Muse Spark**: returns `HTTP 400`."
  - `"max"` works only on `muse-wonder-1.0` and `muse-spark-1.3`, not on `-contributor`.
- **Where to set it:**
  - Chat Completions: top-level `reasoning_effort`.
  - Responses: `reasoning.effort`.
- **Fastest option:** "For direct-answer tasks ... set `reasoning_effort` to `"low"` for faster responses at lower cost."
  - `"minimal"` is the shortest pass.
- **Muse Image** has its own `reasoning_strength`: `"high"` (the default, several refinement passes) or `"low"` ("returns after a single pass").
  - The price is the same either way.

### Structured JSON output ([structured output](https://dev.meta.ai/docs/structured-output.md)) [official]
- **Chat Completions:** `response_format: {type: "json_schema", json_schema: {...}}`.
- **Responses:** `text.format`.
- **How it works:** "decoding itself is constrained" (not post-processing).
  - `strict` defaults to `false`.
- **Not allowed:** recursive schemas (`HTTP 400`).
- **Limits:** nesting depth 10, 5,000 properties, 120,000 characters, 1,000 enum values.
- **Also available:** tool calling, tool search and search grounding.

### SAM 3.1 ([overview](https://dev.meta.ai/docs/sam/overview.md), [segmenting](https://dev.meta.ai/docs/sam/segmenting.md), [reading output](https://dev.meta.ai/docs/sam/reading-segmentation.md), [client libraries](https://dev.meta.ai/docs/sam/client-libraries.md)) [official]
- **Endpoint:** `POST /v1/responses` with `model: "sam-3.1"` (not Chat Completions).
- **Input:** "Attach an image with an `input_image` part or a clip with an `input_video` part."
  - Either as `image_url` / `video_url` ("a public URL or a base64 data URL") or as a `file_id` from the Files API.
  - Video must be MP4 or MOV with H.264, H.265 or MPEG-4: "VP9 and WebM are not accepted".
  - Up to 15,000 frames (about 10 minutes) per request.
- **Two prompt types** (never both in one request):
  - **Text:** "a short noun phrase that names one concrete object" ("yellow school bus").
    - "Name one concept per request; to segment several object types, send several requests."
  - **Boxes and points:** written in the output token grammar, with your own object ids.
    - Example: `<0f>1<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>,2<|point;x=..;y=..;w=..;h=..|>-<|point;...|>`.
    - A `-` before a point makes it negative.
    - Up to 16 prompted objects.
- **Video tracking:**
  - It "tracks up to 16 objects per frame".
  - `metadata.propagation_direction` is `forward`, `backward` or `both` (the default); it applies to box and point prompts.
  - Stable object ids across frames, but "don't rely on the id across an object's entry, exit, or full occlusion".
- **Output:** special-token text streamed in the `output_text` lane, one line per frame.
  - Example: `<0f>0<|box;x1=353;y1=382;x2=453;y2=427;w=537;h=561|><|mask;x=0;y=0;data=46,101,~...|>`.
  - **Boxes** are in source pixels.
  - **Masks** are "height then width" rasters encoded in **base85** (not base64).
    - `~` marks lossless (the default); `!` marks `one_bit` (set via `metadata.mask_encoding`).
  - **[unverified]** In the examples the mask raster matches the box size (46 × 101 for a 101 × 46 box).
    - So the mask probably covers the box, not the full frame; let the parser handle placement.
  - **Confidence:** `metadata.include_confidence: "true"` (a string) adds `c` from 0 to 1.
  - Frame indices can skip frames and are not always in order.
  - "Zero matches is a valid outcome": the result is an empty `output_text`.
- **Parsers:** `@meta-sam/parser` (TypeScript, zero dependencies), with `parseImageStream` and `decodeMaskToRaster` (returns a row-major `Uint8Array` of 0/1).
  - Also `@meta-sam/graphics` (Canvas 2D overlays) and Python `meta_sam_parser` (raster, COCO RLE, SVG path).
- **Determinism:** "Results can vary slightly between runs of the same request".
  - Streaming is recommended but not required.
- **Scope:** "SAM 3.1 locates the objects you name; it doesn't answer questions or reason about a scene."
  - The docs suggest pairing it with Muse Spark.
  - Cookbooks: [SAM API basics](https://dev.meta.ai/docs/cookbook/sam-api-basics.md), [video to sticker pack](https://dev.meta.ai/docs/cookbook/video-to-sticker-pack.md), [headlocked captions](https://dev.meta.ai/docs/cookbook/headlocked-speech-bubble-captions.md) (Voice + SAM).

### Muse Image ([guide](https://dev.meta.ai/docs/image-generation.md), [generate](https://dev.meta.ai/docs/api-reference/images/create-image.md), [edit](https://dev.meta.ai/docs/api-reference/images/edit-image.md)) [official]
- **Single-shot generation:** `POST /v1/images/generations` with `{model: "muse-image-1.0", prompt, n}`.
- **Single-shot edits:** `POST /v1/images/edits`.
  - Either a JSON `images: [{image_url | file_id}]` body or multipart (the OpenAI SDK `images.edit`).
  - "compose several inputs" is supported.
  - `mask`, `input_fidelity` and `partial_images` return 400.
- **Multi-turn editing:** the Responses API, with reference images as `input_image` parts.
  - See the cookbooks [anchored image series](https://dev.meta.ai/docs/cookbook/anchored-image-series.md) and [image editing](https://dev.meta.ai/docs/cookbook/image-editing-with-reasoning.md).
- **Parameters:**
  - `n` from 1 to 10;
  - `size` such as `"1536x1024"`, which sets the aspect ratio only (up to 16:1);
  - `output_format` is `webp` (the default), `png` or `jpeg`;
  - `tool_enablement` has `enable_image_search`, `enable_web_search` and `enable_shell`.
- **Response:** `data[].b64_json` (the default) or `url`.
  - `background` is always `opaque`, so there is no transparent output.

### Muse Voice Transcribe ([speech to text](https://dev.meta.ai/docs/speech-to-text.md), [transcribe](https://dev.meta.ai/docs/api-reference/voice/transcribe.md)) [official]
- **Endpoints:**
  - realtime `wss://api.meta.ai/v1/asr/realtime`;
  - file `POST /v1/asr/transcribe` (multipart, **WAV only**, ≤ 10 minutes, ≤ 32 MB).
- **What you get:** turn-level timestamps.
- **What you don't get:** word-level timestamps, speech synthesis.

## 3. Open-weights models

| Model | Size | Licence | Meta docs |
|---|---|---|---|
| **Muse Glimmer** (`meta-models/Muse-Glimmer-30B`) | 30B dense (29.6B), text + image in, 128K default ctx | **Apache 2.0**, not gated on HF | [muse-glimmer](https://dev.meta.ai/docs/muse-glimmer.md), [deploy](https://dev.meta.ai/docs/muse-glimmer/deploy.md) |
| **Muse Spark Open** (`meta-models/Muse-Spark-Open-816B-A42B`) — it exists | 816B MoE, 42B active; text/image/audio/video in; 1,048,576 ctx; BF16 ≈ 1.65 TB (8 × B300), NVFP4 ≈ 537 GB (one 4-GPU Blackwell node) | **Muse Model License** + Acceptable Use Policy; gated (manual) on HF | [muse-spark-open](https://dev.meta.ai/docs/muse-spark-open.md), [deploy](https://dev.meta.ai/docs/muse-spark-open/deploy.md) |

### Hosting by sponsor

| Provider | Muse Spark Open | Muse Glimmer |
|---|---|---|
| **Baseten** | Serverless "Model APIs": `meta-models/muse-spark-open` at `https://inference.baseten.co/v1`; $1.25 in / $0.15 cached / $4.25 out per 1M ([library](https://www.baseten.co/library/muse-spark-open)) | Library page `meta-models/Muse-Glimmer-30B`: "Deploy now", BF16 on one H100 via vLLM, so a **dedicated deployment** billed per GPU time; no per-token price shown ([library](https://www.baseten.co/library/muse-glimmer-30b)) |
| **Fireworks** | Serverless `accounts/fireworks/models/muse-spark-open` at `https://api.fireworks.ai/inference/v1`; $1.25 / $0.15 / $4.25 per 1M ([model page](https://fireworks.ai/models/fireworks/muse-spark-open)) | `accounts/fireworks/models/muse-glimmer-30b`: **serverless "Not Supported"**; serverless access ended Sept 25, 2026; on-demand (dedicated) deployments only ([model page](https://fireworks.ai/models/fireworks/muse-glimmer-30b)) |
| **Modal** | Shared Endpoint `meta-models/Muse-Spark-Open-816B-A42B` (NVFP4), OpenAI-compatible; $1.25 / $0.15 / $4.25 per 1M ([library](https://modal.com/library/meta/muse-spark-open)) | **Dedicated Endpoint** only: `modal endpoint create --model meta-models/Muse-Glimmer-30B`, billed by GPU-second; BF16 and NVFP4 pages ([BF16](https://modal.com/library/meta/muse-glimmer-30b-bf16)) |
| Together AI (not a sponsor) | Serverless `meta-models/muse-spark-open` | **Serverless** `meta-models/Muse-Glimmer-30B`: $0.35 in / $0.04 cached / $1.50 out per 1M; the only hosted Glimmer provider in Meta's docs |

- **Sponsor credits [official, event page]:** all are for "select participants" and must be claimed; not guaranteed.
  - "Baseten is offering $100 in credits and 2M TPM rate limits to select participants to use Meta's open-weights models."
  - "Modal is offering $100 in credits to select participants to use Meta's open-weights models through Endpoints in addition to their serverless GPUs, sandboxes, and tools for LLM training."
  - "Fireworks is offering $25 in credits to select participants to use Meta's open-weight models along with a workshop from Sinan Ozdemir".
- **Implication for "Best Build on Meta Open Weights":**
  - The cheapest sponsor route is Muse Spark Open on Baseten, Fireworks or Modal serverless, at the same per-token price as hosted Muse Spark.
  - Glimmer on the sponsors needs a dedicated GPU (H100-class per hour).
  - On our own Modal GPU, Glimmer fits one GPU (4-bit 24–32 GB), and Modal can "verify" it as the infrastructure partner **[unverified]**.
- **Third-party Glimmer prices** (aggregators, $0.30–0.35 in / $1.50 out) are **[unverified]**.

## 4. Other Meta tools named for the event
- **Muse Code [official]:** "Meta's coding agent for the terminal and CI, built for Muse Spark".
  - Install with `curl -fsSL https://dev.meta.ai/install.sh | sh`; the binary is `muse`.
  - Pay-as-you-go or subscriptions; subscriptions default to Contributor mode.
  - Muse Wonder Full is only in Muse Code (Power and Maximum plans) ([muse-code](https://dev.meta.ai/docs/muse-code.md), [pricing](https://dev.meta.ai/docs/pricing-rate-limits.md)).
  - Named on the event page: "code faster with Muse Code coding agent".
  - **[unverified]** Whether using Muse Code to build counts toward "Use of Meta AI tooling".
- **Glimmer:** named in the waiver ("Muse Spark, Glimmer, SAM 3"); see section 3.
- **SAM 3 / SAM 3.1 open weights:** `facebook/sam3`, `facebook/sam3.1` on HF, gated (manual), licence "other" (SAM License).
  - SAM 3.1 is also hosted on the Model API.
- **SAM 3D Objects / SAM 3D Body:** **not on the Model API** and **not named on any event page**.
  - Open weights only: `facebook/sam-3d-objects` and `facebook/sam-3d-body-dinov3`, gated (manual), licence "other".
  - They count as "Meta open weights models" under the event page's "run Meta open weights models" **[unverified interpretation]**.
- **MapAnything:** not named for the event.
  - `facebook/map-anything` is **CC BY-NC 4.0**, so it is non-commercial.
  - `facebook/map-anything-apache` is **Apache 2.0**; use that one.
- **What Meta says it wants [official]:**
  - "Show us what becomes possible when these models meet the real world."
  - Make "something possible that wasn't before".
  - Judging rewards going "beyond a basic integration" and having "surfaced unexpected capabilities".
  - **[owner-relayed]** The "Push the Frontier" dashboard wording names "Muse Spark, Glimmer, SAM 3 or other Meta models on hard problems in software, robotics, manufacturing, energy or science".
- **Workshops:** "Oct 27 – Nov 4: Live workshops from Meta and partners, plus office hours on Discord".
  - **[unverified]** The schedule is behind sign-in or on Discord.
