# Infrastructure research for the 9-day hackathon build

- Researched 2026-10-27.
- Prices and limits change; each bullet links the page it came from.
- "Unverified" marks figures from third-party pages that the official page could not confirm.

## Recommendation in one screen

- **Hosting:** Cloudflare for everything web-facing: Workers with static assets for the Vite build, D1 for courses, votes and moderation flags, R2 for uploaded clips, KV only for cached config.
- **Why:** the free plan covers a few thousand visitors, there are no cold starts that matter, R2 egress is free, and `wrangler` deploys from the CLI with two environment variables.
- **Upgrade trigger:** the $5/month Workers Paid plan lifts the 10 ms CPU cap per request and raises daily limits; buy it only if the proxy needs more CPU than a pass-through call.
- **Heavy processing:** clips go to the existing Modal jobs (SAM 3 and friends); the Worker only signs uploads and forwards jobs.
- **Agents:** one Vultr VM, one non-root Linux user, one git worktree and one tmux window (or systemd unit) per Claude Code agent, `claude -p` with a long-lived subscription token, tasks as files, a single merge script that rebases, runs `npm run test:quick` and fast-forwards `main`.
- **Repo and Linear:** `gh repo create --public --source=. --push`; Linear via the Linear MCP (already connected in this workspace) or the GraphQL API; the GitHub integration and the webhook for commit magic words must be switched on by hand.
- **Demo footage:** keep the existing approach (SwiftShader in headless Chromium, retime by the game clock); a Modal L4 is cheap ($0.80/h) but needs Vulkan driver setup in the container, so treat it as an optional experiment.

## 1. Hosting the game and its small backend

### What the game needs

- Static files: the Vite build (JS, WASM for Rapier, GLB models, textures).
- Small JSON: shared courses, gallery entries, votes, moderation flags.
- Short video uploads that are deleted after processing.
- A proxy that holds keys for the Meta Model API and for open-weights endpoints (Baseten, Modal, Fireworks), so no key reaches the browser.
- Simple moderation and a public gallery with votes.
- Accounts are optional.

### COOP/COEP and SharedArrayBuffer

- `SharedArrayBuffer` is only available on cross-origin-isolated pages, which need `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) ([MDN: SharedArrayBuffer security requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements)).
- WebGPU itself does not need these headers; it needs a secure context (HTTPS or `localhost`) ([MDN: WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)).
- The game uses `@dimforge/rapier2d-compat` 0.21.0 (see `package.json`), the single-threaded build with WASM embedded, so it does not need `SharedArrayBuffer` ([Rapier JS getting started](https://rapier.rs/docs/user_guides/javascript/getting_started_js)).
- Headers become necessary only if we add threaded WASM (for example multi-threaded ffmpeg.wasm or a threaded ML runtime in the browser).
- If we do add them, `require-corp` blocks cross-origin images, fonts and embeds that lack CORP/CORS headers; `credentialless` is the softer option ([MDN: COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)).
- Every host below can set these headers: Cloudflare and Netlify through a `_headers` file, Vercel through `vercel.json`, Fly and a VM through the server's own config.
- Cloudflare's `_headers` rules apply only to static asset responses, not to responses the Worker script builds, so a Worker that serves HTML must set the headers on its own `Response` ([Cloudflare: static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)).
- Cloudflare allows up to 100 header rules in `_headers` ([Cloudflare: static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)).

### Comparison

| Host | Free tier (key limits) | Cold starts | Cost for a few thousand visitors | CLI deploy for an agent |
|---|---|---|---|---|
| Cloudflare Workers + static assets, D1, R2, KV | Workers 100k requests/day, 10 ms CPU per request; D1 5M rows read and 100k written per day, 5 GB; KV 100k reads and 1k writes per day; R2 10 GB, 1M class A and 10M class B ops per month, egress free ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)) | Isolates start in milliseconds; no practical cold start | $0 on free; $5/month Paid if CPU or daily caps bite ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)) | `wrangler deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, token from the "Edit Cloudflare Workers" template ([GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)) |
| Supabase (Postgres, Auth, Storage, Edge Functions) | 500 MB DB, 1 GB storage, 50 MB max upload, 5 GB egress, 50k auth MAU, 500k function invocations; 2 active projects; **free projects pause after 1 week of inactivity** ([pricing](https://supabase.com/pricing)) | Edge Functions have cold starts on first call | $0 within free; Pro from $25/month ([pricing](https://supabase.com/pricing)) | `supabase` CLI with an access token; good, but two services to wire to the static host |
| Vercel (Hobby) | 100 deployments/day, 100 MB CLI upload, functions up to 300 s and 2 GB ([limits](https://vercel.com/docs/limits)); function request and response body max 4.5 MB ([function limitations](https://vercel.com/docs/functions/limitations)) | Fluid compute reduces but does not remove cold starts | $0; Hobby is for non-commercial use (unverified for this project; check Vercel's terms) | `vercel deploy --prod --token` |
| Netlify (Free) | 300 credits; bandwidth 20 credits per GB, 2 credits per 10k web requests, 15 credits per production deploy ([pricing](https://www.netlify.com/pricing/)) | Functions have cold starts | 300 credits run out fast: about 20 production deploys alone use all of them; Personal $9/month for 1,000 credits ([pricing](https://www.netlify.com/pricing/)) | `netlify deploy --prod` with `NETLIFY_AUTH_TOKEN`; agents that deploy often burn credits |
| Fly.io | No free tier for new organisations; trial of 2 h machine time or 7 days ([pricing](https://docs.fly.io/about/pricing)) | With auto-stop, the first request after idle waits for a machine to boot (seconds) | shared-cpu-1x 256 MB $2.19/month always on; outbound $0.02/GB in NA/EU, $0.04 in APAC; volumes $0.15/GB-month ([pricing](https://docs.fly.io/about/pricing)) | `flyctl deploy` with `FLY_API_TOKEN`; needs a Dockerfile and a separate object store |
| Vultr VM | No free tier; the official pricing page refused automated access (HTTP 403) | None (always on) | 8 vCPU / 32 GB: about $160/month regular (vc2-8c-32gb) ([Spare Cores](https://sparecores.com/server/vultr/vc2-8c-32gb)) or $240/month General Purpose ([Spendark](https://spendark.com/instances/voc-g-8c-32gb/)), both unverified; small plans cost a few dollars per month | Full control, but we own TLS, backups, uptime and patching |

### Notes per need

- **Clip uploads:** Cloudflare accepts request bodies up to 100 MB on Free and Pro zones ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)), but the cleaner pattern is a short-lived presigned R2 URL so the browser uploads straight to R2 ([R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)).
- **Deleting clips:** the processing job deletes the object when done; an R2 lifecycle rule deleting objects after 1 day is the safety net ([R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)).
- **Vercel's 4.5 MB body limit** rules out uploading clips through its functions; Vercel suggests uploading directly to storage instead ([body size guide](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)).
- **Key-holding proxy:** a Worker stores keys as secrets (`wrangler secret put`) and forwards calls ([Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)).
- **Free CPU cap:** the free plan's 10 ms CPU per request counts CPU time, not time spent waiting on the upstream model, so a pass-through proxy usually fits; streaming many tokens can push CPU up, and Paid allows 30 s by default ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
- **Subrequests:** 50 per invocation on Free, 10,000 on Paid ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)).
- **Static assets:** 20,000 files per Worker version on Free, 25 MiB per file ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)); large GLB or video files above 25 MiB go to R2.
- **Meta Model API:** base URL `https://api.meta.ai/v1`, bearer auth with a `MODEL_API_KEY` ([Meta Model API docs](https://ai.developer.meta.com/docs/)); the proxy should forward to it and to the open-weights endpoints behind one route.
- **Meta rate limits:** a third-party page lists 3,000 requests and 4M tokens per minute per team for standard Muse models (unverified) ([OrcaRouter](https://www.orcarouter.ai/blog/muse-api)); check Meta's own [rate-limits page](https://dev.meta.ai/docs/pricing-rate-limits/).
- **Moderation:** Llama Guard 3 runs on Workers AI as `@cf/meta/llama-guard-3-8b` ([model page](https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b/)), and Workers AI gives 10,000 neurons per day free on both plans ([Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)).
- **Moderation, cheapest version:** shared courses are JSON, so validate them against a schema, cap lengths, run titles and descriptions through Llama Guard, and hide an entry from the gallery after a few reports until someone reviews it.
- **Bots and vote stuffing:** Cloudflare Turnstile is a free CAPTCHA alternative that a Worker verifies server-side ([Turnstile](https://developers.cloudflare.com/turnstile/)).
- **Votes without accounts:** one vote per course per anonymous device id plus Turnstile, enforced by a unique key in D1; add sign-in later only if the gallery needs it.
- **Optional accounts:** Supabase Auth's 50k free MAU is generous ([pricing](https://supabase.com/pricing)), but adding Supabase only for login doubles the stack; skip accounts for the hackathon.
- **Supabase pause risk:** a free project pauses after a week without activity ([pricing](https://supabase.com/pricing)), which could break the gallery during judging (Nov 4 to 16).

## 2. Running several Claude Code agents unattended on a VM

### Authentication

- `claude setup-token` runs the browser login once and prints a one-year OAuth token; set it as `CLAUDE_CODE_OAUTH_TOKEN` on the VM ([authentication](https://code.claude.com/docs/en/authentication)).
- The token needs a Pro, Max, Team or Enterprise plan and can only make model requests, so it cannot open Remote Control sessions or fetch claude.ai connectors; locally configured MCP servers still work ([authentication](https://code.claude.com/docs/en/authentication)).
- The token prints only once and is not saved anywhere, so the product owner must copy it into the VM's secret file at once ([authentication](https://code.claude.com/docs/en/authentication)).
- Precedence: cloud provider variables, then `ANTHROPIC_AUTH_TOKEN`, then `ANTHROPIC_API_KEY`, then `apiKeyHelper`, then `CLAUDE_CODE_OAUTH_TOKEN`, then `/login` credentials ([authentication](https://code.claude.com/docs/en/authentication)).
- A stray `ANTHROPIC_API_KEY` in the environment silently wins over the subscription token in `-p` runs, so the launcher should `unset` it ([authentication](https://code.claude.com/docs/en/authentication)).
- `--bare` mode does not read `CLAUDE_CODE_OAUTH_TOKEN`; bare runs need `ANTHROPIC_API_KEY` or an `apiKeyHelper` ([authentication](https://code.claude.com/docs/en/authentication), [headless](https://code.claude.com/docs/en/headless)).
- Alternative: an API key from the Claude Console bills per token and has no five-hour reset window; `--max-budget-usd` caps one run's spend ([headless](https://code.claude.com/docs/en/headless), [costs](https://code.claude.com/docs/en/costs)).
- Credentials on Linux live in `~/.claude/.credentials.json` (mode 0600) ([authentication](https://code.claude.com/docs/en/authentication)).

### `claude -p` essentials

- `claude -p "<prompt>"` runs non-interactively, exits 0 on success and non-zero on failure ([headless](https://code.claude.com/docs/en/headless)).
- `--output-format json` returns the result, the `session_id` and an estimated cost; `stream-json` streams events, including `system/api_retry` events with a `rate_limit` category ([headless](https://code.claude.com/docs/en/headless)).
- `--resume <session_id>` or `--continue` resumes a conversation, so a wrapper can continue a task after a crash or a limit ([headless](https://code.claude.com/docs/en/headless)).
- Without `--bare`, a `-p` run loads the project's `CLAUDE.md`, hooks in `.claude/settings.json` and `.mcp.json` servers, with no trust prompt ([headless](https://code.claude.com/docs/en/headless)); that is what we want here, because our hooks guard commits and pushes.
- SIGTERM ends the run with code 143 and leaves the turn unfinished; send SIGINT first for a clean stop ([headless](https://code.claude.com/docs/en/headless)).
- A run can stay open up to 10 minutes after its turn to wait for background work; `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` changes that ([headless](https://code.claude.com/docs/en/headless)).

### Permission modes for unattended work

- Since v2.1.302, `claude -p` starts in Manual mode, so any call that would prompt is denied ([permission modes](https://code.claude.com/docs/en/permission-modes), [headless](https://code.claude.com/docs/en/headless)).
- `dontAsk` plus an explicit `--allowedTools` list is deterministic and suits CI, but a missing rule silently blocks the agent ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- `auto` has a classifier review each action; it blocks categories such as force pushes, production deploys and secret exfiltration by default, but "does not guarantee safety" ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- `auto` cannot be set in project `.claude/settings.json`; pass `--permission-mode auto` or set it in `~/.claude/settings.json` ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- `--permission-prompts none` (v2.1.259+) makes anything that would prompt fail fast and tells Claude not to retry ([headless](https://code.claude.com/docs/en/headless)).
- `bypassPermissions` (`--dangerously-skip-permissions`) skips almost every check, including writes to `.git` and `.claude`; use it only inside real isolation, never as root (Claude Code refuses bypass as root outside a recognised sandbox) ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- Deny rules still apply in every mode, so a backstop such as denying `git push --force` and `rm -rf` of the repo is worth adding ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- The Bash sandbox on Linux uses bubblewrap and socat: writes only to the working directory and temp, network only to allowed domains ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- The sandbox covers shell commands only; hooks, MCP servers and file tools run outside it, so the VM itself is the outer boundary ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
- **Recommended for this VM:** `--permission-mode auto --permission-prompts none`, the sandbox on with `allowedDomains` for npm, GitHub, Linear and the model APIs, deny rules for force-push and history rewrites, a dedicated non-root user, and only the secrets the agents need on the box.
- **Trade-off:** `bypassPermissions` would never stall, but one bad command could wipe the VM or leak keys; on a throwaway VM with no other secrets that is tolerable, with `auto` the safer default.

### Worktrees per agent

- `claude -p --worktree <name>` creates `.claude/worktrees/<name>/` on branch `worktree-<name>`; `-p` skips the trust check ([worktrees](https://code.claude.com/docs/en/worktrees)).
- `-p` runs do not clean up their worktrees; remove them with `git worktree remove` (after `git worktree unlock` if needed) ([worktrees](https://code.claude.com/docs/en/worktrees)).
- `.worktreeinclude` copies gitignored files such as `.env` into each new worktree ([worktrees](https://code.claude.com/docs/en/worktrees)).
- `worktree.baseRef` chooses `"fresh"` (default, from `origin`'s default branch) or `"head"` ([worktrees](https://code.claude.com/docs/en/worktrees)).
- Each worktree needs its own `npm ci` (about one `node_modules` per agent) and its own dev-server port for browser tests.
- On this project the RAM rule is one local browser-test agent at a time (~7 GB laptop); 32 GB allows more, but Playwright with SwiftShader is CPU-heavy, so cap browser tests with a lock (`flock`) rather than letting all agents run e2e at once.

### Keeping sessions alive

- tmux: one session, one window per agent, so the product owner can attach from a phone over SSH and watch.
- systemd: one templated unit (`agent@.service`) per agent with `Restart=on-failure`, `EnvironmentFile=` for the token, and logs in the journal; it survives SSH drops and reboots ([systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)).
- For a user unit to keep running after logout, enable lingering with `loginctl enable-linger <user>` ([loginctl](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html)).
- Recommended: systemd runs a small loop script per agent; the script picks the next task file, runs `claude -p`, and the agent writes its own log; tmux only for watching.

### Rate limits and usage caps

- Subscription plans meter usage in a rolling five-hour window and a weekly window, shared across all of the account's sessions and with Claude chat ([costs](https://code.claude.com/docs/en/costs)).
- Parallel agents on one subscription drain the same window faster; four agents for seven hours is likely to hit the five-hour limit at least once.
- Anthropic publishes plan ratios, not fixed token counts, for Max (third-party summary: [Portkey](https://portkey.ai/blog/claude-code-limits), [ClaudeLog](https://claudelog.com/faqs/claude-code-usage-limits/)); `/usage` shows the live bars ([costs](https://code.claude.com/docs/en/costs)).
- Interactive sessions wait for the reset and continue on their own, but **`-p` runs and background sessions do not offer that wait** ([interactive mode](https://code.claude.com/docs/en/interactive-mode)).
- So the wrapper must detect the limit (non-zero exit, or a `rate_limit` retry event in `stream-json`), sleep until the reset, and `--resume` the session.
- Usage credits let a Pro or Max plan keep going past the limit, billed separately, with a monthly spend cap set in claude.ai settings ([costs](https://code.claude.com/docs/en/costs)).
- The docs suggest Sonnet for helper agents because it costs less than Opus ([costs](https://code.claude.com/docs/en/costs)); for unattended coding, Opus for the hard task and Sonnet for chores stretches the window.

### Orchestration pattern

- **Task files:** `tasks/queue/DAV-123.md`, each one Linear issue with a purpose line, files in scope, acceptance tests and the exact quick-test command.
- **Claiming:** an agent moves its task to `tasks/doing/<agent>/` with an atomic `git mv` (or `mv` under `flock`), so two agents never take the same task.
- **Lanes:** tasks list the directories they may touch; overlapping tasks wait (this matches the repo's existing parallel-agents rule).
- **Gate:** each agent commits in its worktree, then calls one `merge.sh` that takes a global lock, rebases on `origin/main`, runs `npm run test:quick`, and fast-forward pushes; on failure the agent gets the log and fixes it.
- **Merge queue:** the lock is the queue; only one agent rebases and pushes at a time, so `main` stays green.
- **Heavy gates:** the full `npm run test:e2e` runs from a separate timer every hour on `main`, not per agent, to save CPU.
- **Reporting:** each finished task writes its findings to the Linear issue and `docs/devlog.md` through the normal commit flow; a morning summary script lists done, failed and stuck tasks.
- **Watchdog:** a task with no commit for 45 minutes is killed with SIGINT and returned to the queue with its log.
- Official pointers: [headless mode](https://code.claude.com/docs/en/headless), [worktrees](https://code.claude.com/docs/en/worktrees), [run agents in parallel](https://code.claude.com/docs/en/agents).

## 3. New public GitHub repo and new Linear team/project

### GitHub

- `gh repo create <name> --public --source=. --push` creates the repo from the local directory and pushes it; `--remote` names the remote ([gh repo create](https://cli.github.com/manual/gh_repo_create)).
- Before the first public push, check history for secrets and `books/`; a fresh repo with a squashed history is the safest way to go public.

### Linear

- The GraphQL endpoint is `https://api.linear.app/graphql`; personal API keys go in the `Authorization` header with no `Bearer` prefix ([Linear GraphQL](https://linear.app/developers/graphql)).
- `issueCreate` takes `teamId`, title and description; teams, projects, milestones and relations are mutations in the same schema; use GraphQL introspection against the endpoint for exact fields (the official GraphQL page did not list them) ([Linear GraphQL](https://linear.app/developers/graphql)).
- The Linear MCP connected in this workspace already exposes create and update tools for projects, milestones, issues, labels and comments, which is simpler for an agent than raw GraphQL.
- A new team is usually quickest to create by hand in Settings (team key, workflow states); then agents create the project, milestones, sub-issues and blocking relations.

### Linear GitHub integration for magic words

- Enable it under Settings, Integrations, GitHub; a GitHub organisation owner (or a repo admin for repo-level access) installs the Linear GitHub app ([Linear GitHub docs](https://linear.app/docs/github)).
- Turn on "Link commits to issues with magic words", then add the webhook Linear shows (payload URL and secret, `application/json`, push events) in the GitHub repo's settings ([Linear GitHub docs](https://linear.app/docs/github)).
- Closing words ("Fixes", "Closes") move the issue to Done when the commit reaches the default branch; "Part of" and "Refs" link without closing ([Linear GitHub docs](https://linear.app/docs/github)).
- Commit linking does not need pull requests, so our push-to-`main` workflow works ([Linear GitHub docs](https://linear.app/docs/github)).
- The team's issue key is part of the magic word, so pick the new team key before the first commit.

## 4. Headless WebGPU without a GPU, and a cloud GPU for footage

### Headless Chromium on a GPU-less Linux VM

- Flags that route WebGPU through SwiftShader's software Vulkan: `--enable-unsafe-webgpu --enable-features=Vulkan --use-angle=vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --disable-vulkan-surface` ([agent-browser WebGPU notes](https://agent-browser.dev/webgpu)).
- The repo's `playwright.config.ts` already uses nearly the same set, plus `--ignore-gpu-blocklist`.
- Chrome's own guide uses `--headless=new --use-angle=vulkan --enable-features=Vulkan --disable-vulkan-surface --enable-unsafe-webgpu` and notes running as root without the sandbox is unsupported ([Chrome: Supercharge web AI testing](https://developer.chrome.com/blog/supercharge-web-ai-testing)).
- Avoid `--disable-gpu`, which breaks WebGL on newer Chrome ([microlink](https://microlink.io/blog/webgl-without-a-gpu)).
- Screenshots of WebGPU canvases can come out blank in headless mode; running headed under a virtual display (Xvfb) is the known workaround ([agent-browser WebGPU notes](https://agent-browser.dev/webgpu)).
- WebGPU on Linux is still behind flags in Chrome per the gpuweb status page ([gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)).
- WebGPU needs a secure context, which is why the tests load `http://localhost`.
- Measured in this repo: SwiftShader draws at 0.16 to 0.41 of real time, and the browser tests already wait on game state and retime clips by the game clock (`docs/testing.md`, DAV-206).
- On an 8 vCPU VM SwiftShader should be faster than on the laptop but still below real time for the full scene (estimate, not measured).

### Cloud GPU for demo footage

- Modal L4 costs $0.000222/s (about $0.80/h), T4 about $0.59/h; the Starter plan includes $30 of compute per month ([Modal pricing](https://modal.com/pricing)).
- Chrome only uses an NVIDIA GPU headless after the right Vulkan driver is installed; Chrome's guide installed `vulkan-tools libnvidia-gl-525` on Colab and then confirmed hardware WebGPU via `chrome://gpu` ([Chrome: Supercharge web AI testing](https://developer.chrome.com/blog/supercharge-web-ai-testing)).
- In a Modal container the NVIDIA kernel driver is provided, but the user-space Vulkan ICD (`libnvidia-gl-*` matching the host driver) must be in the image; version mismatches are the usual failure (inference from the Chrome guide, not tested on Modal).
- Real time is likely on an L4 for this game's simple scenes once Vulkan works, but it is unverified.
- **Cheaper route that needs no real time:** keep the fixed-step game clock, render each frame offline (step, draw, capture the canvas), and encode with ffmpeg at 25 or 60 fps; footage is then smooth on any renderer, at the cost of wall time.
- Second route: record the hero clips on the product owner's laptop browser with a real GPU (screen recording), which is also the most honest "holds up live" footage for judges.
- Recommendation: offline frame capture on the VM for automated clips; one scripted Modal L4 experiment only if a long take must be real-time.

## What the product owner must do by hand

- Create or log into the Cloudflare account, create an API token from the "Edit Cloudflare Workers" template, and hand over the token and account id.
- Run `claude setup-token` once (browser login) and paste the printed token into the VM's secret file; decide whether usage credits may be spent past the limit and set a monthly cap.
- Create the Vultr VM (state the monthly price before paying: about $160 to $240 for 8 vCPU / 32 GB, unverified) and add an SSH key; or decide to use a smaller VM.
- Create the new Linear team (choose the issue key) and a personal API key if agents should use GraphQL rather than the MCP.
- Install the Linear GitHub app on the new repo and add the commit webhook; enable "Link commits to issues with magic words".
- Approve that the repo goes public (and that its history holds no secrets or `books/`).
- Put the Meta Model API key and any open-weights endpoint keys into Cloudflare secrets (or give them to an agent to run `wrangler secret put`).
