#!/usr/bin/env bash
# Owner runs this (`! scripts/set-character-settings.sh`): copies the four character settings from the private env file
# into the PREVIEW Pages project as secrets. It never prints a value. Production is a separate step that needs the owner's yes.
set -euo pipefail
env_dir="${HOME}/.config/ninja"
[ -f "$env_dir/char.env" ] || { echo "Missing $env_dir/char.env" >&2; exit 1; }
[ -f "$env_dir/cloudflare.env" ] || { echo "Missing $env_dir/cloudflare.env" >&2; exit 1; }
set -a; . "$env_dir/cloudflare.env"; set +a
: "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID in cloudflare.env}"
cd "$(dirname "$0")/.."
for name in CC_CHAR_TOKEN CC_CHAR_SUBMIT_URL CC_CHAR_STATUS_URL CC_CHAR_LIMITS; do
  value="$(grep -E "^${name}=" "$env_dir/char.env" | head -1 | cut -d= -f2-)"
  [ -n "$value" ] || { echo "Missing $name in char.env" >&2; exit 1; }
  printf '%s' "$value" | npx wrangler pages secret put "$name" --project-name conquercourse --env preview >/dev/null
  echo "set $name (preview)"
done
echo "Deploy preview once so the running site sees them: npm run deploy:preview"
