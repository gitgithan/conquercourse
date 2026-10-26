# Dev setup: how to build, test and run the pipelines

*Draft v0.1, 2026-10-27.*

## Machines
- **Laptop (main):** code, the Vite dev server (`http://localhost:5173`), reviews and merges; about 7 GB of RAM, so at most one browser test run at a time.
- **Vultr VM (extra compute):** 8 vCPU, 32 GB, Ubuntu; Claude Code logged in; a deploy key that can push only to this repo; the Meta, Modal and Linear keys in private files.
  - Called from the laptop with `ssh root@<vm> 'claude -p "<task>"'`, one branch per task.
  - Good for: physics-law tests, Python pipelines, slow headless browser runs, asset processing.
- **Modal (GPU):** batch jobs for SAM 3D Body, Kimodo, SAM 3D Objects and MapAnything; at most 3 containers at once.

## Keys (never in the repo)
- `~/.config/ninja/meta.env`: `META_API_KEY`, `META_BASE_URL` (`https://api.meta.ai/v1`), `META_MODEL`.
- `~/.config/ninja/tripo.env`: `TRIPO_API_KEY` (characters).
- `~/.config/ninja/linear.env`: `LINEAR_API_KEY` (agents on the VM).
- `~/.modal.toml`: the Modal token.
- Load with `set -a; . <file>; set +a`; never print a key; the browser never sees one (calls go through a server proxy).

## Front end
- `npm install`, then `npm run dev` (Vite) and `npm run test:quick` (unit and mechanic tests).
- Browser tests: Playwright with headless Chromium and WebGPU on SwiftShader:
  - flags `--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-angle=swiftshader --disable-vulkan-surface --ignore-gpu-blocklist`;
  - pages must be served from `localhost` (WebGPU needs a secure context).
- **True-speed films:** replace `performance.now` with a stepped value in an init script, advance it one frame per screenshot, and encode at the game's frame rate.

## Python pipelines
- `uv run --no-project --with numpy python -I <script>` for small tools; Modal jobs via `modal run --detach <script>` started in the background with a log and a status check.
- Blender headless (for rigging) from its own Python environment; FBX and GLB both import.
- Each run writes `data/eval/<experiment>/` (inputs, outputs, `run.json`, README with the command and cost).

## Git
- One branch per task (`cc-<n>-<slug>`), rebased on `main` before merging; `npm run test:quick` must pass; test, commit and push as separate commands.
- The VM pushes over SSH with its deploy key: `GIT_SSH_COMMAND="ssh -i /root/.ssh/cc_deploy -o IdentitiesOnly=yes" git push`.

## Linear ↔ GitHub
- Linear sees commits through its GitHub app, which only sees repos it has been given access to.
- Check once: github.com/settings/installations → Linear → Configure → Repository access; with "Only select repositories", add `gitgithan/conquercourse` and save ("All repositories" needs nothing).
- Then "Part of CC-n" links a commit to its issue and "Fixes CC-n" closes the issue when the commit reaches `main`; a branch named after the issue links too.
- Test: after the next commit that names an issue, the commit appears in that issue's activity.
