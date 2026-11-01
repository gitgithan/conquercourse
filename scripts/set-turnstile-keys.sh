#!/usr/bin/env bash
# Owner runs this (`! scripts/set-turnstile-keys.sh`): copies the two Turnstile keys from ~/.config/ninja/turnstile.env
# into the PREVIEW Pages project as secrets. It never prints a value. Production is a separate step that needs the owner's yes.
# The file has two lines: TURNSTILE_SITE_KEY=... and TURNSTILE_SECRET=... (mode 600). Never paste the secret into chat.
set -euo pipefail
env_dir="${HOME}/.config/ninja"
[ -f "$env_dir/turnstile.env" ] || { echo "Missing $env_dir/turnstile.env" >&2; exit 1; }
[ -f "$env_dir/cloudflare.env" ] || { echo "Missing $env_dir/cloudflare.env" >&2; exit 1; }
set -a; . "$env_dir/cloudflare.env"; set +a
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID in cloudflare.env}"
cd "$(dirname "$0")/.."
for name in TURNSTILE_SITE_KEY TURNSTILE_SECRET; do
  value="$(grep -E "^${name}=" "$env_dir/turnstile.env" | head -1 | cut -d= -f2-)"
  [ -n "$value" ] || { echo "Missing $name in turnstile.env" >&2; exit 1; }
  printf '%s' "$value" | npx wrangler pages secret put "$name" --project-name conquercourse --env preview >/dev/null
  echo "set $name (preview)"
done
echo "Deploy preview once so the running site sees them: npm run deploy:preview"
