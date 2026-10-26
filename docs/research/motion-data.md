# Open motion data and footage for ConquerCourse (checked 2026-10-27)

*Scope: human motion for a parkour / ninja-warrior game retargeted onto the 30-joint SOMA skeleton (Kimodo), published in a public repo, maybe commercial later.*
*Not legal advice.*
*Nothing was downloaded, nobody signed up, nothing was paid.*
*"Checked" means the licence page was read today; "unverified" means only a secondary source or memory.*

## Bottom line
- Only a handful of mocap sources allow **both** commercial use **and** publishing derived motion in a public repo: CMU, 100STYLE (CC BY 4.0), HDM05 (CC BY-SA 3.0, share-alike), and Kimodo's own generated output (NVIDIA Open Model License).
- Everything big and famous (AMASS, HumanML3D, Motion-X, GRAB, BEHAVE, PROX, Nymeria, LAFAN1, Bandai Namco, AIST++) is non-commercial or bans redistribution.
- The parkour-specific mocap that exists (LAAS Parkour, PARC / Beyond Capture, BONES-SEED's few vaults) either has no stated licence or bans public upload.
- So for vaults, rolls, wall moves, rope swing, salmon ladder, trampoline and rolling log, the realistic route is **openly licensed video or self-filmed video → our video-to-motion pipeline → plausibility gate**.
- Biggest gaps (no open mocap and little or no open video): salmon ladder, rolling log, warped wall, tic-tac, rope swing with release, parkour roll.

## Licence rules of thumb for this project
- **Public repo + maybe commercial** needs: commercial use allowed, modification allowed, redistribution of derivatives allowed.
- CC BY and CC0 / public domain pass.
- CC BY-SA passes, but the derived motion files must themselves be released CC BY-SA (fine for an open repo; keep them as separate files with their own licence note).
- Any NC (non-commercial) or ND (no-derivatives) licence fails for a product that may go commercial, and ND fails even for the hackathon because retargeting is a derivative.
- "Research only, no redistribution" licences (all Max Planck / MPI datasets) fail even for the hackathon repo.
- A licence for code (MIT, Apache, BSD in a GitHub repo) says nothing about the data unless the README says so.

## 1. Motion-capture datasets

### CMU Graphics Lab Motion Capture (already in use)
- **Moves:** run, sudden stop, standing and long jumps, run-and-leap, jump over a stool, jump up to grab, playground climb / hang / swing / drop, pull-up, grip bar and swing, ladder, steps and stairs, uneven terrain, balance beam (89_06), one-leg balance (49_18–20), cartwheels (49_06–08, 87_05, 88_07), backflips (87_03, 88_01), jump onto a platform (88_02), hang on ropes (49_21).
- **Missing:** vaults, rolls, wall runs, tic-tac, rope swing, trampoline, salmon ladder.
- **Licence:** "may be copied, modified, or redistributed without permission"; credit requested ([FAQ](http://mocap.cs.cmu.edu/faqs.php); quote already recorded in `docs/motion-library.md`).
- **Access:** open download, ASF/AMC or C3D at 120 fps; per-trial files are small.
- **Verdict:** best open source; already mined (28 trials); the trials listed above as not yet imported are the next easy wins (89_06 beam, 49_18 balance, 88_02 jump onto platform, 13_35 step-up, 83_27 stairs, 36_37 hop on uneven terrain).

### 100STYLE (Ian Mason, Edinburgh)
- **Moves:** walking and running forwards, backwards and sideways, idles and transitions in 100 styles (e.g. TwoFootJump, Skip, Hop, Stiff, Crouched).
- **Covers:** run, plus style variety for run-ups and idles; no obstacles.
- **Licence:** CC BY 4.0, commercial use allowed with credit "The 100STYLE Dataset - Ian Mason" ([official page](https://www.ianxmason.com/100style/), checked).
- **Access:** open zip, BVH, 60 fps Xsens, 28-bone skeleton, over 4 M frames.
- **Verdict:** usable now for run cycles and a few hop styles.

### HDM05 (MPI / Bonn)
- **Moves (from its class list, unverified in detail):** hops on one and two legs, jump down, cartwheel, lie down and stand up, stairs, kicks.
- **Licence:** CC BY-SA 3.0 per the official site, cite the technical report ([HDM05](https://resources.mpi-inf.mpg.de/HDM05/index.html); page returned 403 to our fetcher, licence read from the search snippet of the official page).
- **Access:** open, C3D and ASF/AMC, about 3 hours.
- **Verdict:** usable with share-alike; small value for parkour (drops, hops).

### Kimodo generated motion (NVIDIA)
- **Licence:** Kimodo-SOMA-RP models are under the [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/): "Models are commercially usable" and "NVIDIA claims no ownership rights in outputs" (checked); model card: [Kimodo-SOMA-RP-v1.1](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1).
- The SMPL-X variant is non-commercial ([Kimodo-SMPLX-RP-v1](https://huggingface.co/nvidia/Kimodo-SMPLX-RP-v1)).
- **Limit:** its training labels show 0 hangs and 6 vaults (devlog 2026-10-25), so it cannot invent rope, bar or vault motion well.

### BONES-SEED (Bones Studio; the public subset behind Kimodo)
- **Moves:** 142,220 motions, 288 h at 120 fps, categories include advanced and unusual locomotion, stunts, climbing, jumping ([HF card](https://huggingface.co/datasets/bones-studio/seed)); very few hangs or vaults (see above).
- **Format:** SOMA uniform and proportional BVH (our skeleton, no retarget needed), plus Unitree G1 CSV.
- **Licence ([BONES-SEED License](https://bones.studio/info/seed-license), checked):** only non-profit academic research or startups under USD 1 M revenue; "uploading to public repositories on Hugging Face, GitHub" is banned; no competing dataset or generative model that substitutes the data; credit "Motion Data by Bones Studio".
- **Verdict:** **cannot go in a public repo**; at most private reference or rendered animation with raw data not extractable; needs the product owner's own agreement.

### LAAS Parkour MoCap database (CNRS LAAS, 2020)
- **Moves:** safety vault, kong vault, pull-up, muscle-up; 65 sequences, 5 experts, with hand and foot contact forces and a static side-ish RGB video with faces blurred ([site](https://gepettoweb.laas.fr/parkour/), checked).
- **Format:** C3D at 400 Hz plus force data at 2 kHz; MP4 videos.
- **Licence:** none stated, only "© 2020"; so all rights reserved by default.
- **Verdict:** the best real vault data anywhere; **email the authors for written permission (CC BY would be ideal)** before any use; also a perfect physics-vs-law test set (contact forces).

### PARC (Xu, Shi, Yin, Peng; SIGGRAPH 2025)
- **Moves:** vaulting, climbing, running on bumpy ground, on/off platforms, stairs, with terrain; about 14 min of original capture credited to Beyond Capture Studios, then augmented ([paper](https://arxiv.org/html/2505.04002v1)).
- **Licence:** code BSD-3-Clause ([repo LICENSE](https://github.com/mshoe/PARC)); the Hugging Face data card says MIT ([mxucg/PARC](https://huggingface.co/datasets/mxucg/PARC/blob/main/README.md)) but does not say whether Beyond Capture agreed to that.
- **Format:** PARC's own motion_lib pickles (needs their loader), MotionScope viewer.
- **Verdict:** promising for vault and climb-up; ask the authors to confirm the data licence covers the Beyond Capture source before publishing anything derived.

### AMASS and the sets built on it
- **AMASS:** non-commercial research, education or art only; no copying or sharing except one archive copy ([licence](https://amass.is.tue.mpg.de/license.html), checked); per-source licences are not listed on that page.
- **HumanML3D:** cannot even be distributed; you rebuild it from AMASS ([repo](https://github.com/EricGuo5513/HumanML3D)).
- **Motion-X:** CC BY-NC-SA plus each sub-dataset's own licence ([paper](https://arxiv.org/pdf/2307.00818)).
- **HUMANISE:** synthetic scenes built on AMASS motion, so it inherits AMASS limits (unverified).
- **Verdict:** none usable; also note many AMASS sub-sets (e.g. CMU) are usable from their **original** source, not via AMASS.

### Human–object and human–scene datasets
- **GRAB** (grasping objects): non-commercial, no redistribution ([licence](https://grab.is.tue.mpg.de/license.html), checked).
- **BEHAVE** (carrying objects): non-commercial research, no redistribution ([licence](https://virtualhumans.mpi-inf.mpg.de/behave/license.html), checked).
- **PROX** (people in scanned rooms): non-commercial, no redistribution ([licence](https://prox.is.tue.mpg.de/license.html), checked).
- **OMOMO** (15 objects, 10 h): no data licence stated; code repo MIT; SMPL-H/X body models needed, which are non-commercial ([project](https://lijiaman.github.io/projects/omomo/), [repo](https://github.com/lijiaman/omomo_release)).
- **TRUMANS** (15 h in 100 indoor scenes; actions: lie down, squat, objects): no data licence stated; Google-Form access ([project](https://jnnan.github.io/trumans/), [utils](https://github.com/jnnan/trumans_utils)).
- **Verdict:** none covers our obstacle moves anyway (they are indoor furniture and hand-held objects).

### Meta datasets
- **Nymeria** (300 h, 264 people, Xsens at 240 Hz, everyday activities, about 80 TB): CC BY-NC 4.0 data licence ([licence file](https://github.com/facebookresearch/nymeria_dataset), [HF card](https://huggingface.co/datasets/projectaria/Nymeria)); "Data and code may not be used for commercial purposes".
- **Ego-Exo4D** (bouldering is one of 8 scenarios; 17 triangulated body joints; about 14 TiB; license signed online, about 48 h approval, 14-day AWS keys) ([docs](https://docs.ego-exo4d-data.org/getting-started/), [overview](https://docs.ego-exo4d-data.org/overview/)).
  - Its licence lets models, annotations and techniques derived from it be used commercially, but "all or any portion of the data contained within the Database may not appear in or be visible in any program, dataset, or product" ([Ego-Exo4D licence PDF](https://ego4d-data.org/pdfs/Ego-Exo4D-Model-License.pdf), checked).
  - Extracted joint tracks are a grey zone between "annotation" and "data"; not worth the risk for a public repo.
- **Verdict:** neither covers parkour; Nymeria is out; Ego-Exo4D bouldering could only train a model, not ship motion.

### Other libraries
- **Mixamo (Adobe):** free with an Adobe account, royalty-free in commercial games, but "the only thing you can't do is distribute the raw character and animation files" (Adobe FAQ as quoted on [Adobe community](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400); official FAQ page not reachable today).
  - It has climbing, hanging, shimmy, braced hang, jump, fall-to-roll and vault-like clips (from memory, verify in the library).
  - A public repo of retargeted Mixamo files is risky; usable only baked into a built game, not as files in the repo.
- **Rokoko free motion library** (150 moves): commercial use allowed per [CG Channel](https://www.cgchannel.com/?p=113569); redistribution terms not found (unverified).
- **LAFAN1 (Ubisoft):** uneven-terrain locomotion, jumps, fall and get up; CC BY-NC-ND 4.0 ([repo](https://github.com/ubisoft/ubisoft-laforge-animation-dataset), checked): out.
- **Bandai Namco Research motion datasets:** CC BY-NC 4.0 ([repo](https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset), checked): out.
- **AIST++:** dance only; AIST Dance DB terms say academic research only and "Use for commercial purposes is not permitted without prior written consent from AIST" ([terms](https://aistdancedb.ongaaccel.jp/terms_of_use/), checked): out.
- **KIT Whole-Body Motion Database:** has beam walks (e.g. motion 678 with handrail, 377 forward walk over a beam) ([listing](https://motion-database.humanoids.kit.edu/list/motions/?page=109)); licence not stated on the pages read; ask before use.
- **SFU Motion Capture Database:** site unreachable today; licence and contents unverified ([site](https://mocap.cs.sfu.ca/)).
- **EgoHTR (2026, terrain traversal, 55 sequences):** no data licence stated yet ([arXiv](https://arxiv.org/abs/2607.13472), [project](https://egohtr.github.io)); watch it.

## 2. Openly licensed video

### Site terms (short)
- **Wikimedia Commons:** each file has its own licence (PD, CC0, CC BY, CC BY-SA); credit the author and licence; CC BY-SA derived motion must stay BY-SA.
- **US government (DVIDS, NASA, Navy, Army):** works by federal employees are generally not copyrighted; DVIDS asks for the line "The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement", no implied endorsement, publicity rights of people shown remain, obscure military markings in commercial use ([DVIDS copyright](https://www.dvidshub.net/about/copyright), checked).
- **Pexels:** free, modification allowed, manual download only (no scripts; API program paused); already analysed in `data/eval/footage-pexels-pixabay/README.md`.
- **Pixabay:** modification allowed, but its terms ban automatic collection "including without limitation for machine learning purposes" ([terms](https://pixabay.com/service/terms/)); grey zone for running pose models; list only.
- **Mixkit (Envato):** Video Free License allows commercial use without credit; no resale or making items available to third parties as they are; no AI/ML clause found in its [terms](https://mixkit.co/terms/) today, but check the per-item licence page ([licences](https://mixkit.co/license/)).
- **Coverr:** free commercial use and modification, but "may not be used to train AI algorithms, build AI models, or serve as part of a dataset" ([licence](https://coverr.co/license), checked); running a pose model for motion is arguably not training, but avoid; its parkour page also mixes in AI-generated clips.
- **Videvo:** now redirects to Freepik's terms; clips are a mix of free licence and CC BY 3.0 per clip; not checked further.
- **Internet Archive:** licences are whatever the uploader typed; many are re-uploads with false CC0 tags (e.g. a "Jackass" compilation marked CC0); trust only government or Prelinger items with clear provenance.
- **YouTube Creative Commons (CC BY 3.0):** the licence is fine, but YouTube's terms forbid downloading without a YouTube-provided button or the owner's permission; prefer copies already imported to Commons with a reviewed licence (e.g. "Rope climbing" below).

### Concrete clips (licence read from Commons metadata today unless noted)
- [Parkour - climb stairs.ogv](https://commons.wikimedia.org/wiki/File:Parkour_-_climb_stairs.ogv): wall run-up and climb-up on a wall nearly twice his height, filmed from several angles; CC BY 2.0, Marco Gomes; 640×480, 10 s (already listed in `video_source.py`).
- [Tuto 0001.ogv](https://commons.wikimedia.org/wiki/File:Tuto_0001.ogv): French parkour tutorial (likely vaults, landings, rolls; view to confirm); public domain, Habeas; 5.6 min (already listed).
- [Saut en longueur par Sweeney (1900)](https://commons.wikimedia.org/wiki/File:Saut_en_longueur_par_Sweeney_(champion_americain)_%C3%A0_la_station_physiologique_(1900).webm): running long jump, Marey's physiological station, static side camera; public domain.
- [Saut en hauteur par un athlète américain (Schonfield) (1900)](https://commons.wikimedia.org/wiki/File:Saut_en_hauteur_par_un_athl%C3%A8te_am%C3%A9ricain_(Schonfield)_(1900).webm): high jump, static side view; public domain, Marey.
- [Saute d'un athlète (Sweeney) par dessus une barre (1900)](https://commons.wikimedia.org/wiki/File:Saute_d%27un_athl%C3%A8te_(Sweeney)_par_dessus_une_barre_(1900).webm): jump over a bar; public domain, Marey (licence assumed same series, verify).
- [Saut de haie par Alvin Kraenzlein (1900)](https://commons.wikimedia.org/wiki/File:Saut_de_haie_par_l%27americain_Alvin_Kraenzlein_(1900).webm): hurdle, side view; public domain, Marey.
- [Women's Long Jump Final, Universiade 2015](https://commons.wikimedia.org/wiki/File:Women%27s_Long_Jump_Final_-_28th_Summer_Universiade_2015.webm): run-up, take-off, landing; CC BY 3.0, FISUTV; broadcast camera pans.
- [Men's Triple Jump, Universiade 2015](https://commons.wikimedia.org/wiki/File:Men%27s_Triple_Jump.webm): hops and bounds; CC BY 3.0, FISUTV.
- [Rope climbing.webm](https://commons.wikimedia.org/wiki/File:Rope_climbing.webm): legless rope climb in a gym; CC BY 3.0, Kit Laughlin (from YouTube, reviewed); 720p, 60 s.
- [Pull-ups - exercise demonstration video.webm](https://commons.wikimedia.org/wiki/File:Pull-ups_-_exercise_demonstration_video.webm): pull-up, clean background; CC BY 3.0, FitnessScape; 6 s.
- [Navy-seal-buds-training-pull-ups.ogv](https://commons.wikimedia.org/wiki/File:Navy-seal-buds-training-pull-ups.ogv): pull-up technique; public domain, US Navy.
- [Slacklining 001.webm](https://commons.wikimedia.org/wiki/File:Slacklining_001.webm): balance walk on a slackline; CC BY-SA 4.0, Ocdp; 1600×900, 32 s.
- [Outdoor trampoline jumping.webm](https://commons.wikimedia.org/wiki/File:Outdoor_trampoline_jumping.webm): garden trampoline bounce; CC BY-SA 4.0, GolhaMedia; 1440p, 20 s (confirm adult).
- [Vaulting-gymnastics.webm](https://commons.wikimedia.org/wiki/File:Vaulting-gymnastics.webm): gymnastics vault (hands-on-box flight, close to a kong); CC BY-SA 4.0, Lionel Aubert; 8 s (confirm adult).
- [EVD-judo-005.ogv](https://commons.wikimedia.org/wiki/File:EVD-judo-005.ogv): judo; may contain breakfalls and rolls (view to confirm); CC BY-SA 2.5 co; 320×240.
- [Indoor Bouldering V3 Rock Spot.webm](https://commons.wikimedia.org/wiki/File:Indoor_Bouldering_V3_Rock_Spot.webm): bouldering climb, the uploader filming himself; CC BY-SA 3.0; vertical, low resolution.
- [Urban Climbing and Bouldering review.webm](https://commons.wikimedia.org/wiki/File:Urban_Climbing_and_Bouldering_review.webm): buildering, ledge hangs, climb-ups; CC BY 3.0, DTS; 3 min (skip any rooftop parts).
- [FC-11 Obstacle Course - B-Roll Part 1](https://commons.wikimedia.org/wiki/File:FC-11_Obstacle_Course_-_B-Roll_Part_1.ogv) and [Part 2](https://commons.wikimedia.org/wiki/File:FC-11_Obstacle_Course_-_B-Roll_Part_2.ogv): military obstacle course (walls, ropes, bars); public domain, US Army; only 240×180.
- [Best of the Best Competition Obstacle Course](https://commons.wikimedia.org/wiki/File:Best_of_the_Best_Competition_Obstacle_Course_(1025220).webm): obstacles, 1080p, 60 s; public domain, US Air Force.
- [B-Roll: Multinational partners train together at obstacle course](https://commons.wikimedia.org/wiki/File:B-Roll-_Multinational_partners_train_together_at_obstacle_course_during_Justified_Accord_(952559).webm): obstacles incl. bars; public domain, US Army; 720p.
- [Human Research Obstacle Course B-roll (NASA)](https://commons.wikimedia.org/wiki/File:Human_Research_Obstacle_Course_B-roll_(Astronaut-Obstacle-Courses_preflight).webm): astronauts on a fitness obstacle course; public domain, NASA Ames; 720p.
- [Navy SEAL BUD/S obstacle course](https://commons.wikimedia.org/wiki/File:Navy-seal-buds-training-obstacle-course.ogv): first-person, so not for pose, but shows rope, wall and log obstacles for level design; public domain.
- [DVIDS: Army Reserve Best Warrior obstacle course, 2017](https://www.dvidshub.net/video/531663/obstacle-course): 12.5 min B-roll including a "swing, stop and jump" rope obstacle; public domain (per search result; view to confirm).
- [DVIDS: USARPAC Best Squad Competition 2026 obstacle course](https://www.dvidshub.net/video/1015656/usarpac-best-squad-competition-2026-obstacle-course): 4.5 min B-roll; public domain.
- [Antique rope swing, Kizhi 2022](https://commons.wikimedia.org/wiki/File:Antique_rope_swing_Kizhi_2022.webm): swing physics (pendulum) reference; public domain.
- [Mixkit: Man jumping from a wall](https://mixkit.co/free-stock-video/man-jumping-from-a-wall-21756/) and [Parkour across benches](https://mixkit.co/free-stock-video/parkour-across-benches-21757/): Mixkit Video Free License; the other Mixkit parkour clips are titled "teenager" and should be skipped.
- **Pexels, new candidates (Pexels License; view each for adult, side-on, static):**
  - [Man jumping on the trampoline 6571883](https://www.pexels.com/video/man-jumping-on-the-trampoline-6571883/), [A man jumping at the trampoline 6572680](https://www.pexels.com/video/a-man-jumping-at-the-trampoline-6572680/), [A man practicing gymnastic trampoline 6572688](https://www.pexels.com/video/a-man-practicing-gymnastic-trampoline-6572688/), [A woman jumping on a trampoline 6571901](https://www.pexels.com/video/a-woman-jumping-on-a-trampoline-6571901/).
  - [A man walking on the tightrope 8492946](https://www.pexels.com/video/a-man-walking-on-the-tightrope-8492946/) and the same series up to 8492954 (slackline balance walk).
  - [Athlete rope climbing 6254849](https://www.pexels.com/video/athlete-rope-climbing-6254849/).
  - [Exciting rope swing over lake adventure 38858579](https://www.pexels.com/video/exciting-rope-swing-over-lake-adventure-38858579/) (rope swing with release; check age and camera).
  - [A man leaping from wall to walls 6002065](https://www.pexels.com/video/a-man-leaping-from-wall-to-walls-6002065/) and [A man climbing through walls 6002056](https://www.pexels.com/video/a-man-climbing-through-walls-6002056/) (Mary Taylor series, same athlete as the processed clips; possible tic-tac and climb-up).
  - [Outdoor park workout man performing box jumps 35054875](https://www.pexels.com/video/outdoor-park-workout-man-performing-box-jumps-35054875/) (step-up / jump-up, landing).
  - [Athlete long jump at outdoor track event 31229030](https://www.pexels.com/video/athlete-long-jump-at-outdoor-track-event-31229030/).
  - [Air Force ROTC air assault course 18922304](https://www.pexels.com/video/air-force-rotc-air-assault-course-18922304/) (obstacle course).
  - Plus the 18 parkour candidates already in `data/eval/footage-pexels-pixabay/manifest.json`.
- **Skipped on purpose:** Muybridge's *Animal Locomotion* sequences on Commons are public domain, side-on and in front of a measured grid (great for scale), but most athletes are nude and some subjects are boys; not suitable for a public educational game.
- **Skipped on purpose:** Internet Archive "parkour" items under CC BY 3.0 (re-uploaded YouTube videos) are rooftop and metro stunts; safety framing rules them out.

## 3. Gap analysis
*Legend: **OK** = open mocap we can publish; **video** = openly licensed footage only; **gap** = neither, or only restricted data.*

| Move | Open mocap (publishable) | Open video | Restricted only | Status |
|---|---|---|---|---|
| Run | CMU 09_xx, 16_35; 100STYLE FR | many | — | OK |
| Sprint | none labelled "sprint" (CMU runs are jogs) | FISU long-jump run-ups; Pexels track clips | BONES-SEED | video |
| Sudden stop | CMU 16_08, 16_57 | — | — | OK |
| Standing jump | CMU 16_05, 13_11; HDM05 hops | Pexels box jumps | — | OK |
| Running long jump | CMU 75_15, 83_42–50 | Marey 1900, FISU 2015 | — | OK |
| Precision jump | CMU 36_37 (hop on uneven terrain) only | Pexels 6002472 (processed) | LAFAN1 | video |
| Step-up | CMU 13_35, 83_27, 88_02 | Pexels box jumps | — | OK |
| Drop and soft landing | CMU 01_07, 01_11, 01_13; HDM05 jump down | Tuto 0001 | — | OK (low drops) |
| Roll | none | Tuto 0001, judo (to confirm) | LAFAN1 fall/get up; Mixamo fall-to-roll | **gap** |
| Kong vault | none | Pexels 32109501 (processed); gymnastics vault | LAAS (ask), PARC (ask), BONES-SEED | **gap** (ask LAAS) |
| Speed vault | none | Pexels candidates; Tuto 0001 | LAAS safety vault, PARC | **gap** |
| Lazy vault | none | Tuto 0001 (to confirm) | LAAS safety vault (closest) | **gap** |
| Tic-tac | none | Pexels 6002065 (to confirm) | — | **gap** |
| Wall run | none | Parkour - climb stairs (CC BY) | PARC climb | video (one clip) |
| Cat leap / ledge hang | CMU 13_10, 14_07 (jump to grab); 01_xx hangs | Urban climbing review | Mixamo braced hang | partial |
| Climb-up | CMU 01_02–08 (playground climb), 88_02 | Parkour - climb stairs; urban climbing | LAAS muscle-up, PARC | partial |
| Warped wall run-up and grab | none | none found (military inclined walls only) | — | **gap** |
| Rope swing (catch, swing, release) | CMU 49_21 hang only | DVIDS "swing, stop and jump"; Pexels lake swing | — | **gap** (mocap) |
| Monkey bars / bar swing | CMU 01_03, 01_09, 43_02, 43_03 | Pexels 6002530 (processed), 6002479 | — | OK |
| Salmon ladder | none | none | — | **gap (total)** |
| Trampoline bounce | none | Pexels 6571883 etc.; Commons trampoline | — | video |
| Balance walk | CMU 89_06 (beam), 49_18–20 | Slacklining 001; Pexels tightrope series; rail 6002485 | KIT beam (ask) | OK |
| Rolling log | none | none | — | **gap (total)** |

- **Asks worth one email each:** LAAS Parkour authors (vaults with contact forces), PARC authors (confirm data licence covers Beyond Capture), KIT (beam walks).
- **Stylise instead of capture:** salmon ladder (pull-up plus a bar hop driven by the simulator), rolling log (balance walk with quick steps on a rotating body), warped wall (sprint plus jump-to-grab from CMU, angled), as `docs/motion-scope.md` already allows for some stations.

## 4. Self-filming guide (for the product owner, an adult)

### Safety first
- Film only moves you can already do comfortably; this is for recording, not learning new skills.
- Warm up for 10 minutes; stop at any pain.
- Use grass, sand or gym mats; never film over concrete for drops, rolls or vaults.
- Have an adult friend as spotter for anything off the ground (they stay out of frame, or consent to being in it).
- Keep every height low: feet never more than about 50 cm off the ground for hangs and drops.
- A parkour or ninja gym during an empty slot, with the gym's written permission and a coach, is the safest place for vaults, rolls, warped wall and rope swing.

### Camera
- Tripod, not hand-held; camera at hip height (about 1 m).
- Side-on: the lens axis at right angles to the direction of travel, 4–6 m from the line of motion.
- Landscape, 1080p, 60 fps (30 fps minimum; 120 fps only in bright light).
- Normal lens: the phone's 1× main camera, never the 0.5× ultra-wide (it bends straight lines and limbs).
- Lock focus and exposure (long-press on the phone screen); turn off any "action" stabilisation that crops and shifts the frame.
- Whole body in frame for the whole move with about half a metre of margin, and the ground line visible at the bottom.
- Level the camera (phone level or bubble level) so the floor is horizontal.
- Sun behind or beside the camera, never behind you.
- Optional second camera from the front at the same height for depth checks.

### Scale and sync
- Stand a 1 m folding ruler or a 1 m stick upright **in the plane of the motion** (on the tape line you move along) for the first take, then leave it at the edge of frame.
- Tape marks on the ground every 50 cm along the path.
- Measure and note every obstacle's height, width and distance, and your own height and weight.
- Start each take with 2 s standing still in an A-pose, then one small two-foot hop (a sync and gravity check for the plausibility gate).

### Clothing
- Fitted clothes in one solid colour that contrasts with the background (e.g. dark top, different-coloured trousers on a light wall).
- No baggy hoodie, no logos, hair tied back, shoes visible and in a different colour from the floor.

### Safe low versions of each move
- **Run / sprint:** 20 m flat; reach speed before the frame; sprint at about 80 %.
- **Sudden stop:** jog in, two-foot stop on a tape line.
- **Standing jump:** two-foot broad jump on grass; tape at take-off and landing.
- **Running long jump:** 3–5 step approach into a sand pit or onto grass.
- **Precision jump:** two-foot jump between tape lines on flat ground, then onto a stable 10–15 cm kerb.
- **Step-up:** onto a stable 30–40 cm box or bench.
- **Drop and landing:** from a 30–40 cm box onto a mat, soft knees.
- **Roll:** shoulder roll on grass or a mat from kneeling, then from a squat; only if you already know the roll; otherwise skip.
- **Kong vault:** over a padded 40–50 cm box or gym vault block; or the "step vault" version (one foot on the box).
- **Speed vault / lazy vault:** over a stable 50–60 cm rail or padded box.
- **Tic-tac:** one push-off from a wall at about knee height, landing on grass.
- **Wall run:** one or two steps up a 1.2–1.5 m wall to touch the top with both hands, then step back down; no climb.
- **Cat leap / ledge hang:** short standing jump to a playground bar where your feet hang about 30 cm off the ground.
- **Climb-up:** from that hang onto a 1.2 m platform, using a foot on the wall.
- **Warped wall run-up and grab:** only at a ninja gym with a coach; otherwise skip and stylise.
- **Rope swing:** gym or playground rope with feet 20–30 cm above a mat; catch from standing, two or three swings, let go at the lowest point.
- **Monkey bars / bar swing:** playground bars, three or four rungs, feet just above the ground.
- **Salmon ladder:** do not film at home; record a dead hang and a pull-up instead.
- **Trampoline:** mini-trampoline or netted garden trampoline, straight bounces, no flips.
- **Balance walk:** a low beam or kerb 10–20 cm high, arms out, slow then normal speed.
- **Rolling log:** never on a real log; walk quickly on a static low beam and let the game add the roll.

### Takes
- 5 good takes per move, plus 2 leading with the other leg or arm.
- Each take 3–10 s; say or show the move name on a card before starting.
- Keep the failed takes too, labelled, for the plausibility tests.

### Consent and privacy
- Film in a private space, a booked gym slot or an empty public area at a quiet time; check the park's or gym's filming rules.
- No bystanders in frame, and **never any minors**; restart the take if anyone walks in.
- Write a one-line self-consent note in the session folder (who, date, that derived motion and short excerpts may be published in the repo and the demo).
- Keep raw videos private in `../ninja-assets/footage/self/`; publish only the derived 30-joint motion and, if needed, short blurred excerpts.
- Don't film house numbers, car plates or the gym's other customers.

### File naming
- `YYYYMMDD_<move>_<variant>_t<NN>_<cam>_<fps>.mp4`, e.g. `20261028_kong-vault_box50cm_t03_side_60fps.mp4`.
- One `run.json` per session (date, place, camera height and distance, lens, fps, ruler position, your height and weight, obstacle sizes, which takes are good), per the experiment-trail rule.

## Open questions to check
- AIST++ and HDM05 class lists were read from summaries, not the files.
- Mixamo's official FAQ page did not load; the quote comes from Adobe's community forum.
- Each Commons clip still needs a human view for age, camera stillness and whether the move matches the title.
