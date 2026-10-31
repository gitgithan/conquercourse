# Feedback card

*One small button on every screen opens a short card; it collects what we can act on and nothing about who you are.*

## So what
- A note now says what kind it is, where the player was, and what they pressed or expected, so a bug can be placed and fixed.
- The player sees every line before it goes and can untick any of them.
- The old round form is still there with `?feedback=old`, and old rows stay readable.

## What the player sees
- **Step 1:** pick a kind: something broke, something was confusing, an idea, or something loved.
- **Step 2:** where; it is filled in from the screen, course or world, and the player can edit it.
- **Step 3:** one box; the question above it depends on the kind (for "broke": what did you press, and what did you expect).
- **Optional:** "Was this clear?" with a reason chip row on the Course, Dojo, Labs, World Editor, World Slicer and Parts; a 1 to 5 rating for the screen.
- **What gets sent:** a box that lists the exact lines; each context line has a tick box.
- **Keys:** Esc and a click outside close the card (`closeOnBackdrop`); Ctrl+Enter sends; while it is open no game key reaches the game.
- **During a run** the button is hidden, so it never gets in the way of a key.

## What we collect and why
| Field | Why |
|---|---|
| kind | to sort bugs from ideas |
| where (editable text, 80 characters) | to place the note |
| words (1000 characters) | the actual finding |
| rating 1 to 5, clear yes/no, reason chip | to compare screens |
| screen name | to group notes |
| browser name and major version, window size | to reproduce a layout or speed problem |
| course or world, character | to find the exact content |
| last run (for example "Fell at 3.0 s") and a seed or short run code | to replay the moment |
| build id | to know which version it was |
| a random code made in the browser | to count one player once and to limit repeats |

## What is never collected
- No name, email, address, phone number, account, IP address or device id.
- No raw browser string, no photo, no screenshot (a screenshot option was left out on purpose).
- The server removes anything that looks like an email address or a web link from the words.
- Rules for limits and abuse are kept in the private notes.

## Where it lives
- Code: `src/ui/feedback-model.ts` (rules), `src/ui/feedback-card.ts` (the card), `functions/api/submit.ts` (checks, storage).
- Storage: the existing `feedback` table in D1; the new card writes round `quick-1` and keeps its fields in the existing JSON columns, so no migration is needed.
- Old rows (other rounds) are not touched.

## How the owner reads it
- Run `node scripts/feedback-summary.mjs quick` (needs `npx wrangler login` once).
- It writes `test-results/feedback-quick.md`, grouped by kind and then by screen, with ratings and the "not clear" reasons.
- The file holds players' words, so it is not tracked.
- Set `FEEDBACK_DB` to read the preview database (`conquercourse-preview`).
- The older per-round summary still works: `node scripts/feedback-summary.mjs public-5`.

## Checks
- `tests/feedback-card.test.ts`: the model, the payload, the server with a fake database, the reader.
- `scripts/feedback-card-smoke.mjs`: opens the card on five screens at 1280 px, checks the filled-in fields, Esc, backdrop, send, `?feedback=old` and the hidden button during a run.
- Evidence pictures: `docs/evidence/cc-feedback-form/`.
