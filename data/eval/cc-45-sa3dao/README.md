# CC-45: SA-3DAO structures as parkour terrain

## So what
- **Recommendation: ask permission (a person must act); do not use the data yet.**
- **Why stopped:** the download page gives no link a script can follow, and the data looks gated; I did not sign, accept or create anything.
- **Second issue, even once downloaded:** the licence is non-commercial (CC BY-NC 4.0).
  - A hackathon demo is likely non-commercial, but ConquerCourse is meant to become a product.
  - Treat SA-3DAO as research-only: fine for a private experiment, not for shipping meshes in the game.
- **Nothing was downloaded, baked, sliced or committed** apart from this note and `run.json`.

## What I checked (first-hand, 2026-10-27)
- **Dataset page** (`https://ai.meta.com/datasets/sa-3dao-sam-3d-artist-objects/`):
  - "The SAM 3D Artist Objects (SA-3DAO) dataset is an evaluation benchmark of 100 image and 3D pairs, with an additional 900 held-out for benchmark..."
  - Licence line: "CC by NC licenses", linking to `https://creativecommons.org/licenses/by-nc/4.0/deed.en`.
  - Asks users to cite the paper (arXiv 2511.16624) with a BibTeX entry.
- **Download page** (`/datasets/sa-3dao-sam-3d-artist-objects-downloads/`, reached from the "Download the Dataset" button):
  - The page I fetched holds only the site menu and footer; it has no download link, no licence text and no visible form.
  - Its page data names a release id (`sa3dao_dataset_release`) and nothing else.
  - The real download step is probably drawn by script in a browser, so a person has to open it.
- **Other places tried:** the Hugging Face dataset names I guessed return 401 (no public dataset there); the leaderboard space is only a results page; the SAM 3D Objects GitHub README only links back to the dataset page.
- **CC BY-NC 4.0 legal code, the lines that matter:**
  - "NonCommercial means not primarily intended for or directed towards commercial advantage or monetary compensation."
  - Sharing the material publicly is allowed only for NonCommercial purposes, with credit to the creator.
  - A hackathon demo that is free and not sold probably fits, but a prize or product use is a grey area: a person should decide.

## What a person must do
- Open the downloads page in a browser and see whether it asks for an email, a form or an agreement.
- If it does, read it and decide; I will not accept it for the product owner.
- If it downloads freely: put the files in `../conquercourse-assets/sa3dao/` with `SHA256SUMS`, and rerun this spike (10 structures, 2 or 3 shrink factors, `bestSlices`, contact sheets).
- Decide the use: research-only (keep meshes out of git and out of the shipped game) or ask Meta for a commercial permission.
- No Modal GPU is needed for the spike.

## Table
| Structure | Factors | Lanes | Cleared by searchIdealRun |
|---|---|---|---|
| not run | n/a | n/a | n/a |
