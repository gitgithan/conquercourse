#!/usr/bin/env bash
# Owner-run: makes a new admin token, stores it as the Pages secret ADMIN_TOKEN (on both the preview and the live site, one token), saves a copy for you, prints it once.
# Run it yourself:  ! scripts/set-admin-token.sh        (an agent must not run it)
# The copy lives outside the repo in ~/.config/ninja/admin.env (mode 600); read it later with: cat ~/.config/ninja/admin.env
set -euo pipefail
cd "$(dirname "$0")/.."
env_dir="$HOME/.config/ninja"
[ -f "$env_dir/cloudflare.env" ] || { echo "Missing $env_dir/cloudflare.env (the Cloudflare token)." >&2; exit 1; }
set -a; . "$env_dir/cloudflare.env"; set +a
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID in cloudflare.env}"
token="$(openssl rand -hex 24)" # 48 hex characters
for target in preview production; do
  printf '%s' "$token" | npx wrangler pages secret put ADMIN_TOKEN --project-name conquercourse --env "$target" >/dev/null
done
umask 077
printf 'ADMIN_TOKEN=%s\n' "$token" > "$env_dir/admin.env"
chmod 600 "$env_dir/admin.env"
echo "ADMIN_TOKEN stored as the Pages secret for the preview and the live site. A copy is in $env_dir/admin.env."
echo "Your token (shown once here): $token"
echo "Open /admin/ on either address and paste it when asked; the banner shows which site you are on."
echo "Each site needs one deploy for the new secret to reach it."
