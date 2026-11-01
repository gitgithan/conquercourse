# Preview and live: secrets, tokens and databases

*Which settings the two Cloudflare sites need, how one token is shared with Modal, and why the two databases differ.*

## What is secret and what is not
- Names of settings, web addresses of our Modal endpoints and the steps below are not secret, so they are written here.
- Values of keys and tokens are secret: they live only in private env files outside the repo and in the host's secret store.
- Nothing in this file lets anyone reach a service without the value.

## Settings both sites must hold (same names, same values)
| Setting | Used by | Where the value lives |
|---|---|---|
| `BASETEN_API_KEY` | checker, designer, move tips, course agent | private env file `baseten.env` |
| `MAPILLARY_TOKEN` | street photos in the Slicer | private env file `mapillary.env` |
| `CC_UPLOAD_TOKEN`, `CC_UPLOAD_SUBMIT_URL`, `CC_UPLOAD_STATUS_URL` | photo to object | `upload.env` |
| `CC_SEGMENT_SUBMIT_URL`, `CC_SEGMENT_STATUS_URL` | photo cut-out | Modal endpoint addresses |
| `CC_CHAR_TOKEN`, `CC_CHAR_SUBMIT_URL`, `CC_CHAR_STATUS_URL`, `CC_CHAR_LIMITS` | character maker | `char.env` (the daily numbers are kept in the private notes) |

## How the character token is shared
- The Modal app `cc-character-maker` checks a shared token before it does any work; the site sends the same token with every call.
- The one token is made once and stored in `char.env` (mode 600) in the private config folder.
- A small script writes it to three places in one run: the Modal secret `cc-char` (with the Meta key), the preview site and the live site.
- Both sites carry the same four values, so a character made on preview and one made live go through the same Modal app.
- A secret only takes effect on the next deploy of that site, so redeploy after changing one.
- To rotate: delete `char.env`, run the script again, redeploy preview (and live when the product owner approves).

## Preview and live databases
- Preview uses its own database (`conquercourse-preview`) so a test never touches live data; live uses `conquercourse-feedback`.
- Preview is the test bed and runs ahead: it holds the character tables (migration 0015) that live does not have yet.
- Live records applied migrations in `d1_migrations`; preview was migrated by hand, so it has no such table.
- Live holds real visitors' data and is nearly empty today; preview holds our test data.
- Do not copy live data into preview, and do not copy preview data into live.
- A new migration goes to preview first, is checked there, and goes live only with the product owner's approval.
- Rule of thumb: preview may be ahead of live, never behind.
