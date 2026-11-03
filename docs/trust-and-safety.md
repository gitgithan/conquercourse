# Trust and safety (CC-208)

*Written 2026-11-01 from the code on `main`; every claim about Baseten was re-read from its public pages that day.*

## So what
- A player's photo is looked at by a safety check before anything is made or shared.
  - The check is Muse Spark Open on Baseten; if it cannot run, nothing is made (it fails closed).
- People, faces and number plates are blurred or pixelated on our own GPU job before the 3D model sees the photo.
- The check has been tested on words and ordinary photos only, not on real harmful images (see "Honest limits").
- Abuse limits: kept in the private notes.

## 1. The safety check (Muse Spark Open)
- **What it is:**
  - One call to Muse Spark Open on Baseten, in `functions/api/moderate.ts`; the instructions are in `src/slice/moderation.ts`.
  - It reads one small photo (a JPEG or PNG of at most about 600 KB as base64) and an optional caption of up to 200 characters.
  - The caption is handed over as data: the prompt says never to follow instructions in it, and a caption can only make the verdict stricter.
- **What it is given:**
  - The small copy the browser makes (the thumbnail), not the full photo.
  - That copy is made before our blur step, so the checker sees people as they were photographed; the blur happens later on the Modal job.
  - Photos drop their location data in the browser before upload (`docs/data-model.md`).
- **Verdicts:**
  - `ok`: a place or an object, nothing worrying.
  - `review`: a person should look (unsure, a recognisable person or face, a readable plate, address, document or screen, or a child).
  - `block`: clearly sexual content, graphic violence or injury, a hate symbol or hateful text, or a weapon pointed at someone.
  - Reasons: person, minor, private_info, sexual, violence, hate, weapon, other, plus unreadable and error (set by us when the check could not answer).
  - Everyday tools, kitchen knives and statues are not a reason to block.
- **It is a model:**
  - The same photo can pass on one try and stop on another.
  - Every stop is logged with its reason for 14 days and shown on the owner-only admin page.
  - The player sees a plain-words reason, not the model's raw answer.
- **Fails closed:**
  - A missing key, a timeout, a broken or empty reply, or two empty answers in a row becomes `review` with reason `error` or `unreadable`.
  - An `ok` that carries a worry is turned into `review`.
  - A caller that only reads the verdict never lets an upload through by accident.
- **What the player reads** (`moderationStops` in `src/slice/object-lift.ts`):

| Verdict | Reason | The player reads |
|---|---|---|
| review | error or unreadable | "The safety check could not run just now, so nothing was made. Try again in a few minutes." |
| block | any | "This photo cannot be used here." |
| review | minor | "A child looks close up or large in this photo, so we cannot use it. Try a photo where people are small and far away, or where nobody is in the picture." |
| review | private_info | "Something private may be readable in this photo, like a number plate, an address, a document or a screen. Try a photo without readable writing." |
| review | sexual, violence, hate, weapon | "This photo may show something that is not allowed here. Try a different photo of a place or an object." |
| ok, or review for `person` or `other` | | nothing is shown; the job goes on |

- **Where it is called:**
  - `/api/object-lift` and `/api/segment`: the thumbnail, before any Modal job starts.
  - `/api/community-items` (Share in Community): the thumbnail is checked again on the server; the page's earlier check is not trusted.
    - `block` and the worry reasons are refused.
    - A clean `ok` is shown at once; anything else waits as `pending`, which the public list does not show.
  - `/api/character`: the typed sentence (text only) before a character is made; a worry is refused, and a softer `review` is stored hidden.
  - If the key is not set on a deployment, the check is skipped and recorded as `skipped`; the Community share then waits as `pending` instead of going public.

## 2. People, faces and plates
- A Modal job runs SAM 3 (our copy of the open weights) with the prompts "person", "face" and "license plate" (`pipelines/ccpipe/privacy.py`, called from `pipelines/photo_to_object.py`).
- People are blurred and faces and plates are pixelated on top, before the lift model sees the photo.
- Anything SAM 3 does not find stays visible, so this lowers the risk and does not remove it.
- EgoBlur is not used.

## 2b. Street photos from Mapillary (owner, 2026-11-01)
- We rely on Mapillary's own blur of faces and number plates as the base standard.
  - Mapillary says the blur is "designed to" hide faces and plates; that is not a guarantee, so an unblurred face or a child can still appear.
- On top of that, we reject photos where our detector finds a close-up or large person (taller than 0.2 of the picture height); small, far figures pass.
  - The detector can miss a person, so this lowers the risk and does not remove it.
  - We do not mask photos.
- We show the pictures live from Mapillary and never store or copy them; our lists hold ids and positions only.
- We never un-blur a photo, and we report unblurred faces to Mapillary.
- Every large photo carries a "Report this photo on Mapillary" link to its page there, where Mapillary's own report tool lives.
- Mapillary's terms ask contributors not to upload images of children; that is Mapillary's rule, and it is not checked by us.
- There is no hide-this-photo switch of our own yet.

## 3. What we do not do
- No footage of minors in our own footage, captures or uploads: the Park and the film rules forbid it, and the upload check sends a child in a photo to a person.
  - The one carve-out is Mapillary street photos shown live under Mapillary's terms (section 2b).
- No chat tutor.
- No grading or coaching of a person's technique; gaps are plain facts ("Ghost is 0.8 s ahead").
- No Moon or low-gravity scenarios, no robotics framing.

## 4. Where photos go (Baseten's terms)
- The table of what we and each host keep is in [data-model](data-model.md) under "What each service keeps".
- Baseten's own terms are in section 5 below.

## 5. Baseten data terms (read 2026-11-01)
- **Caveat first:** we have not read a signed customer agreement with Baseten.
  - Everything below is from Baseten's public pages, and those can change.
- **Photos are checked by Baseten with no storage and no training:**
  - Model APIs: "Baseten's Model APIs product adheres to a Zero Data Retention posture for all Customer Content" ([security practices](https://www.baseten.co/security-practices/)).
  - The Model APIs page says: "For synchronous Model API requests, Baseten doesn't store inputs or outputs under its zero data retention policy" ([Model APIs overview](https://docs.baseten.co/inference/model-apis/overview)).
  - Training: "Baseten does not use Customer Content for model training, fine-tuning, or improvement of any algorithms" ([security practices](https://www.baseten.co/security-practices/)).
  - The data processing addendum adds that Baseten "will not use Customer Personal Data to train, fine-tune, or otherwise develop" machine learning models ([DPA](https://www.baseten.co/dpa/), section 4.4).
  - The data request policy says Baseten "cannot produce data it does not retain" ([data request policy](https://www.baseten.co/data-request-policy/)).
- **Exceptions, from the same pages:**
  - Async inference queues inputs for up to 72 hours before processing, then deletes them; we do not use async inference.
  - Anything the customer switches on, such as logging, retention or abuse monitoring, or third-party products, sits outside the zero-retention promise; we have switched none of these on.
  - Residual copies of customer content may remain in backups for a limited period.
  - Security logs of access and actions are kept up to 4 years; they are not the content of requests.
- **Modal keeps the job result for 7 days and drops the input after a successful call** ([Modal function invocation methods](https://modal.com/docs/guide/function-invocation-methods)):
  - Our photo-to-object job starts with `spawn`, so the player's raw photo is the job input until the job succeeds.
  - The kept result is the GLB, the mask and the privacy receipt, all made from the blurred image.
  - Not verified: what Modal does with the input of a call that fails.
- **Not verified:** a figure of "usage metadata kept 92 days" was given to us, but none of the four pages above contains it.
  - Until we find the source, we do not state a number.
  - The DPA only says usage and billing metadata may be kept if it holds no personal data.
- **Compare:** SPEC section 7 forbids sending private photos to Meta's cheaper contributor models because Meta may train on them; the Baseten terms above are what we checked about that host.
- This answers the open point in `docs/model-ledger.md` section 2a, with the caveat above (no signed agreement read).

## Feedback notes
- The Feedback card sends no name, email, IP address, photo or raw browser string; the player sees every line first and can untick it ([feedback](feedback.md)).

## Honest limits
- The check was measured on 19 safe photos (all `ok`), 7 text-only unsafe cases (all caught) and 4 near misses (none blocked) ([cc-119-moderation](../data/eval/cc-119-moderation/README.md)).
- It has not been tested on real harmful images.
  - A harmful-image test (CC-120) is still running; when its result is merged under `data/eval/`, this page will link it.
- There is no hash-matching child-safety service; a model judging one small picture can miss things.
- People and faces that SAM 3 misses stay visible in the lifted object's source photo.
- Street photos rely on Mapillary's blur, which can miss a face or a child (section 2b).
- A `review` waits for a person; this page does not say who reviews or how fast.
- Abuse limits: kept in the private notes.
