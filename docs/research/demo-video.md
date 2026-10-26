# Demo video research: tools, rules, what wins, recommended toolchain

*Researched 2026-10-27 by web search.*
*Most price and licence figures come from third-party pages; each is marked, and every one should be checked on the vendor's own page before use.*
*Nothing was signed up for, bought or posted.*

## Bottom line
- Make the 3-minute video almost entirely from **real product capture** (Playwright films of the real build, plus OBS for anything interactive), assembled in **code** (Remotion, free for a team of up to 3).
- Use generative video only for clearly labelled bridges, and prefer **Meta's own models** (Muse Image stills, which also count toward the Best Creative Build bonus); Muse Video is still not public.
- Narration: the product owner's own voice is safest and free; ElevenLabs only on a paid plan (the free plan is non-commercial and needs attribution).
- Captions from **Muse Voice Transcribe** (on the owner's key) turn the video's own subtitles into a Meta-tooling beat.
- Every physics or AI result shown must be a screen recording of the running build; generated b-roll may set the scene but must never stand in for a result.

## 1. Tools

### Meta's own models (most valuable: Use of Meta AI tooling is 25 %)
- **Muse Image** launched 2026-07-07 in the Meta AI app, on meta.ai, in Instagram Stories (US) and in WhatsApp (some countries) ([Meta AI blog](https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/)).
  - Good for this demo: stylised stills (a park re-imagined as a course, title cards, thumbnails), consistent-style character sheets, and the "photo of a park → course" concept art.
  - It ranks second on Arena for text-to-image and editing, and builds an image from several references (same blog).
  - Every image carries Meta's invisible **Content Seal** watermark (same blog).
  - The owner's key on api.meta.ai lists `muse-image-1.0` (project memory, 2026-10-26), so it can be scripted; the public blog doesn't describe an API.
  - Price: free in the Meta AI app; API usage comes out of the hackathon's Meta credits.
  - The bonus prize *Best Creative Build* ($5K) rewards use of Muse Image or Muse Wonder (owner's screenshot of the prize list, 2026-10-26).
- **Muse Video** is only a preview: "coming soon to creators and Meta AI", with no date, API or commercial terms ([Meta AI blog](https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/), [Crypto Briefing on the closed beta](https://cryptobriefing.com/meta-muse-video-closed-beta/), [flowith](https://flowith.io/ai-models/meta-muse-video/)).
  - Meta itself says it is still working on "physically accurate fast motion", which is exactly what a ninja-warrior demo shows, so don't count on it.
- **Vibes** (AI video feed in the Meta AI app, since Sept 2025) makes short clips and remixes; the first version used partner models (Midjourney, Black Forest Labs) ([TechCrunch](https://techcrunch.com/2025/09/25/meta-launches-vibes-a-short-form-video-feed-of-ai-slop), [Influencer Marketing Hub](https://influencermarketinghub.com/meta-ai-video-feed)).
  - Commercial terms for its output weren't found; it's fine for a labelled bridge shot, but don't advertise it as Meta tooling, since the model may be a partner's.
- **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`, on the owner's key) can transcribe the voiceover into the subtitle file.

### General generative video (b-roll, stylised shots)
- **Google Gemini Omni Flash / Veo**
  - The Veo 3.1 *preview* models were shut down in the Gemini API on 2026-10-22; Google now points to `gemini-omni-1.1-flash`, or to GA Veo on its enterprise platform ([Gemini API video docs](https://ai.google.dev/gemini-api/docs/video)).
  - Omni Flash, launched at I/O on 2026-05-19, makes clips of up to about 10 s with native audio and edits them in conversation ([Decrypt](https://decrypt.co/368393), [Let's Data Science](https://letsdatascience.com/news/google-launches-gemini-omni-to-create-video-assets-8c79e4b5)).
  - Price: paid tier only, about $0.10 per second at 720p ([Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)); also in the Gemini app and Flow for AI Plus, Pro and Ultra subscribers, and reportedly free in YouTube Create ([Android Authority](https://www.androidauthority.com/p-3668469)).
  - Watermark: invisible SynthID.
  - Good at: photoreal outdoor b-roll with sound.
  - Risk: realistic generated children in a park are a trust and safety problem (see section 2).
- **OpenAI Sora**: **gone**.
  - The app closed 2026-04-26 and the API on 2026-09-24 ([The Decoder](https://the-decoder.com/openai-sets-two-stage-sora-shutdown-with-app-closing-april-2026-and-api-following-in-september/), [Engadget](https://engadget.com/ai/openai-is-shutting-down-its-sora-video-generation-app-211023358.html)).
- **Runway Gen-4.5**
  - Free: 125 one-time credits, watermarked, no Gen-4.5 and no commercial licence.
  - Standard: about $12–15 a month for roughly 25–52 s of Gen-4.5 ([Creatify](https://creatify.ai/blog/runway-pricing-(2026)-plans-credits-and-what-you-ll-actually-pay), [Magic Hour](https://magichour.ai/blog/runway-gen-45-pricing), [Argil](https://www.argil.ai/blog/runway-pricing-plans-5c7fc)).
  - Good at: video-to-video restyling (for example, turning a capture into a painted look), but not needed here.
- **Kling 3.0**
  - Free: about 66 credits a day, 720p, watermarked, not cleared for commercial use.
  - Standard: about $6.49–6.99 a month, 1080p, no watermark ([CloudZero](https://www.cloudzero.com/blog/kling-ai-pricing/), [Atlas Cloud](https://www.atlascloud.ai/blog/guides/kling-ai-pricing)).
  - Clips of 3–15 s; Motion Control takes a reference video's motion, with sources split between 15 s and 30 s ([LTX Studio](https://ltx.studio/blog/kling-3-0), [Each Labs](https://www.eachlabs.ai/kling/kling-v3/kling-v3-standard-motion-control)).
  - Good at: athletic motion; but generated motion would compete with our own physics-driven motion, which is the product's point.
- **Luma Dream Machine (Ray3)**
  - Free tier is unclear (images only, or about 30 watermarked non-commercial generations a month).
  - Plus: about $30 a month with commercial use; a 10 s 1080p Ray3.14 clip costs about 800 credits ([Luma help page](https://lumalabs.ai/learning-hub/dream-machine-support-pricing-information), [gptprompts.ai](https://gptprompts.ai/ai-pricing/luma-ai-pricing)).
  - Commercial use reportedly covers only output made during an active paid subscription ([Techpresso](https://academy.techpresso.co/reviews/is-luma-dream-machine-worth-it)).
- **Higgsfield**
  - Free plan: no commercial rights and reportedly no video.
  - Paid plans from about $19, $47 and $99 a month ([Creatify](https://creatify.ai/blog/higgsfield-pricing-(2026)-plans-and-what-you-ll-actually-pay), [Krea](https://www.krea.ai/blog/what-is-higgsfield-ai-pricing-free-plan-and-alternatives-in-2026)).
  - Good at: camera-move presets; not needed here.
- **Pika**: no current 2026 pricing or terms found; treat as unverified.

### Voice and music
- **ElevenLabs**
  - Free plan: non-commercial with attribution; paid plans carry commercial rights ([ElevenLabs billing docs](https://elevenlabs.io/docs/overview/administration/billing.md)).
  - Starter: about $5–6 a month ([dupple, read 2026-10-10](https://dupple.com/learn/is-elevenlabs-free), [BIGVU](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/)).
  - Eleven Music also needs a paid plan for commercial use (same sources).
  - Self-serve plans reportedly exclude film, TV and games, which need an enterprise deal (same sources); check before using it in a game trailer.
- **Suno**
  - Free output: non-commercial.
  - Since 2026-09-03 (one source): 7 lifetime downloads on free; Pro ($8 a month) 20 a month; Premier ($24 a month) 60 a month.
  - After the Warner deal, paid plans grant "commercial rights" rather than ownership ([Music in Africa](https://www.musicinafrica.net/magazine/suno-adjusts-ai-music-ownership-terms-after-warner-music-partnership), [Dubspot](https://blog.dubspot.com/ai-music-licensing-explained-2026)).
- **Udio**: downloads have been off since the UMG deal (Oct 2025, "walled garden") ([Digital Music News](https://www.digitalmusicnews.com/2025/10/31/udio-downloads-disabled-umg-deal/), [RouteNote](https://routenote.com/blog/udio-stops-user-downloads-after-umg-deal-heres-why/)); unusable for a video.
- **Safest free path**: the owner's own voice, and a royalty-free music library.
  - Pixabay Music is listed in the repo's licence check (DAV-256) only for footage, so check its music terms before use.

### Editing, captions and screen capture
- **Remotion** (React to MP4, code-driven): free for individuals and companies of up to 3 people, commercial use included; licences start at 4+ people ($25 per seat a month) ([Remotion licence](https://www.remotion.dev/docs/license/pricing), [FAQ](https://www.remotion.dev/docs/license-pricing-compliance/faq)).
  - It has Three.js and caption packages, which suit a TypeScript/three.js repo: shots become versioned code, re-render after every build, and the vertical cuts are a second composition ([Remotion vs Motion Canvas](https://www.remotion.dev/docs/compare/motion-canvas)).
- **Motion Canvas**: open source, made for hand-tuned explanatory animation (same comparison; the exact licence is not confirmed here).
  - Good for one "how it's built" diagram animation; Remotion covers that too.
- **Descript**: transcript-based editing.
  - Free: 60 media minutes a month, watermarked export.
  - Hobbyist: $16–24 a month ([Sonix, a competitor](https://sonix.ai/resources/descript-pricing/)).
  - Good for cutting the voiceover by text; the watermark rules out the free tier for the final export.
- **CapCut**
  - US terms of service dated 2026-04-15, with TikTok USDS JV as the counterparty ([terms](https://dreamina.capcut.com/clause/terms-of-service)).
  - Its stock materials are licensed for "personal and non-commercial use" ([Materials License](https://www.capcut.com/clause/material-license-agreement)), and its user-content licence is broad ([Techloy](https://www.techloy.com/capcuts-latest-terms-of-service-raises-big-questions-about-content-ownership/)).
  - Pro reportedly rose to about $19.99 a month, with 1080p+ export paywalled ([SocialRails](https://socialrails.com/free-tools/capcut-video-downloader)).
  - Fine for quick vertical captions, but avoid its stock music and effects.
- **Screen Studio**: Mac-only; $29 a month, or about $9 a month billed yearly, with no free plan ([Trainn, 2026-08-12](https://trainn.co/blog/what-is-screen-studio/), [Screenhance](https://screenhance.com/blog/best-screen-studio-alternatives-2026)).
  - **Not usable here** (WSL/Linux).
  - Alternatives: OBS (free), or the repo's own Playwright films, with cursor zooms done in Remotion.

## 2. Rules and risks
- **Hackathon page** ([event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)): submissions are due 2026-11-04 at 9 pm ET, judging runs 11-04 to 11-08, and finals are on 11-09.
  - The indie track is judged on creativity, technical ambition and "whether the project works".
  - The public page says **nothing about AI-generated footage, disclosure, or video length**.
  - The Official Rules and the waiver page ([waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver)) render only after login, so read them there.
  - The scoring line "Demo 25 %: working, holds up live, video quality" (project notes, from the waiver page) rewards real capture.
- **Past Cerebral Valley Meta events** banned previous projects and capped teams at 4 ([Cerebral Valley Notion](https://cerebralvalley.notion.site/Meta-Hackathon-Event-Details-Hackers-2732d46e36fc4f1dadb61f5ac422a239), as summarised in search results); check whether the 2026 rules say the same about pre-existing work.
- **No rule found that bans generated footage**; the risk is the judges' trust.
  - Write a one-line disclosure in the video description and a small on-screen tag on any generated shot ("Illustration, Muse Image").
- **X**
  - Since about March 2026 X has a voluntary "Made with AI" label that the creator sets ([Medianama](https://www.medianama.com/2026/03/223-x-made-with-ai-labels-india-tightens-deepfake-rules/), [exchange4media](https://www.exchange4media.com/digital-news/x-rolls-out-ai-content-labels-as-it-seeks-to-stabilise-advertising-revenue-152469.html)).
  - X can still add its own label or limit reach under its Synthetic and Manipulated Media policy ([roboin](https://roboin.io/article/en/2026/03/03/what-made-with-ai-mean-on-x-and-when-they-appear.md)).
  - The only hard penalty found covers unlabelled AI videos of armed conflict, which lose revenue sharing ([Engadget](https://engadget.com/social-media/x-to-require-ai-labels-on-armed-conflict-videos-from-paid-creators-citing-times-of-war-183631400.html)).
  - The help centre page returned 403, so its current text wasn't read.
  - Recommendation: set the label if any generated shot appears; it costs nothing and stops "fake demo" replies.
- **Children**: photoreal AI children playing in a park are a reputational risk (deepfake worries, platform filters) and can't be checked against reality.
  - Real children on film need parental consent.
  - The stylised in-game rookies can play the "kids", and licensed real footage (adults, Pexels, already licence-checked in DAV-256; Marey 1900, public domain) can carry the real-world beats.
- **Licences**: most free tiers (Runway, Kling, Luma, Higgsfield, ElevenLabs, Suno) are **non-commercial and watermarked**.
  - A prize entry and a viral promo post are arguably commercial; don't base the video on free-tier output from these tools.
- **The product's own claim**: the pitch is "physics keeps every model honest".
  - A generated athlete clip in the same video undercuts that unless it is visibly framed as "what generic AI video gets wrong", which could itself be a strong beat: Meta says Muse Video still struggles with fast motion, and our simulator could measure it.

## 3. What wins hackathon demo videos
- **Show the product in the first seconds**; skip the intro and the team slide ([hackathon.com tips](https://tips.hackathon.com/article/creating-the-best-demo-video-for-a-hackathon-what-to-know), [AngelHack](https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/)).
- **Timing for 3 minutes**: about 30 s on the problem and a one-line solution, about 90 s or more of demo, the rest on how it works and the impact ([Reskilll, 2026](https://blogs.reskilll.com/hackathon-demo-presentation-tips-pitch-3-minutes-win-2026/)).
  - Say *what* it does before *how*; the demo shows the how (same source).
- **Show the thing working**, not slides; good sound matters more than polish (same sources).
- **Plan for failure**: script and cache the demo path, and keep a recorded fallback (Reskilll).
- **Past Meta/Llama winners** are mostly impact-led products (an indigenous-language translator, an offline maths tutor, a medication-error EMR) ([lablab pan-LATAM](https://lablab.ai/blog/llama-impact-pan-latam-hack-summary), [Brand Times](https://www.brandtimes.com.ng/?p=33953)).
  - They lead with who benefits, which matches Impact at 30 %.
  - No individual winner video could be watched from here (the Rome recap links to YouTube: [lablab Rome](https://lablab.ai/ai-articles/llama-impact-hack-rome-summary)).
- **The 5-second hook for this product**: a real park photo dissolving into the playable course, or real footage with the game's exact trajectory locking onto it.
  - Both are "real world → game" in one image, with no words needed.
- **On X** ([NemoVideo](https://www.nemovideo.com/blog/best-ai-video-editor-x-twitter-low-views-specs), [Vizup](https://www.tryvizup.com/blog/x-ad-specs-2026-image-video-and-carousel-sizes), [Kapwing](https://www.kapwing.com/resources/social-media-video-aspect-ratios-and-sizes-the-2025-guide/)):
  - Video autoplays muted, so burnt-in captions are required.
  - Hook in the first second.
  - Standard accounts can post up to 140 s.
  - 9:16 or 1:1 for the feed; 30–60 fps, H.264 MP4 (avoid 24 fps and variable frame rates).
  - Put the text hook in the post and the link in a reply.
  - Test 15 s against 30 s.

## 4. Recommendation

### Toolchain (4 core tools plus 1 optional; everything free or already paid)
1. **Capture: Playwright films of the real build** (already in the repo; retime to the game clock, since software-GPU video runs in slow motion), plus **OBS** for any live, hand-driven segment.
2. **Assemble: Remotion** (free for up to 3 people): one composition at 16:9 for 3 min, and 9:16 and 1:1 compositions that reuse the same shots for X; captions, zooms, labels and the pipeline diagram as code, in the repo.
3. **Meta stills: Muse Image** (owner's API key or the Meta AI app): title card, thumbnail, the "park → course" concept frame, and a style-matched end card; tag each one "Muse Image".
4. **Voice and captions**: the owner records the voiceover (free, authentic, no licence questions); **Muse Voice Transcribe** makes the subtitle file, and Remotion burns it in.
   - Say on screen "captions by Muse Voice Transcribe" as a small Meta-tooling credit.
5. **Optional, only if money is approved**: ElevenLabs Starter (about $5–6 a month, commercial) for a cleaner narration, or a paid music track.
   - Muse Video, if it opens before Nov 4, for at most two labelled bridge shots.

### Shot list approach (3:00)
- Tag each shot **REAL** (captured from the running build or licensed real footage), **META** (labelled Muse Image or Muse Video) or **GFX** (Remotion text and diagrams); aim for at least 85 % REAL.

| Time | Shot | Source | Must be real? |
|---|---|---|---|
| 0:00–0:05 | Hook: real park photo → the course appears, ninja already running | REAL (the photo → course feature) | Yes |
| 0:05–0:20 | Problem in one line ("Physics class never happens in your own park") over real footage of the park | REAL footage + GFX caption | Footage real; a Muse Image still is acceptable if labelled |
| 0:20–0:50 | Race the course: ghosts, splits, a near miss | REAL capture | Yes |
| 0:50–1:20 | Discover: four jumps, the player finds ×2 speed → ×4 height, no formula | REAL capture | Yes |
| 1:20–1:50 | Real move filmed → SAM 3 privacy blur → SAM 3D Body skeleton → measured; the game's exact physics overlaid on the real footage | REAL footage + REAL pipeline output | Yes: this is the technical-depth and Meta-tooling proof |
| 1:50–2:10 | Lab partner on Meta models, graded by the simulator | REAL capture of the partner panel | Yes |
| 2:10–2:30 | Impact: teacher view; any browser, any park | REAL capture + GFX | Yes |
| 2:30–2:50 | How it's built: one animated diagram (Meta models in, physics checks out) | GFX | No |
| 2:50–3:00 | End card: name, link, "built with Muse, SAM 3", "Made with AI" note | META still + GFX | No |

### Vertical cuts for X (15–30 s, 9:16, burnt-in captions)
- **Cut A, "your park becomes a course"** (15 s): park photo → course → ninja run → end card.
- **Cut B, "the game's physics on a real jump"** (20 s): the real clip with the simulated trajectory locking on; this is the most shareable "how is that real" beat.
- **Cut C, "find the law yourself"** (30 s): four jumps fan out; the player answers ×4.
- Each one opens on motion with no title; text hook in the post, link in a reply; set the "Made with AI" label if a META shot appears.

### Honesty rules for the edit
- Every result (a measurement, a physics overlay, a grade, model output) is a capture of the running build, never generated or mocked.
- Cuts and speed changes are fine, but write "sped up ×2" on screen when the speed changes.
- A pre-processed step (for example, a SAM 3D Body job on Modal) shows a "processed earlier" tag, as already planned in `docs/demo-plan.md`.
- No photoreal AI people or children; the stylised rookies carry the "kids" role.
- The video description lists every generative tool and which shots used it.
