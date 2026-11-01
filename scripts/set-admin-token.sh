#!/usr/bin/env bash
# Owner-run: makes a new admin token, stores it as the Pages secret ADMIN_TOKEN (preview environment), saves a copy for you, prints it once.
# Run it yourself:  ! scripts/set-admin-token.sh        (an agent must not run it)
# The copy lives outside the repo in ~/.config/ninja/admin.env (mode 600); read it later with: cat ~/.config/ninja/admin.env
set -euo pipefail
cd "$(dirname "$0")/.."
env_dir="$HOME/.config/ninja"
[ -f "$env_dir/cloudflare.env" ] || { echo "Missing $env_dir/cloudflare.env (the Cloudflare token)." >&2; exit 1; }
set -a; . "$env_dir/cloudflare.env"; set +a
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-1f2f3aa5cc4d17e0de38869f1c721cd2}"
token="$(openssl rand -hex 24)" # 48 hex characters
printf '%s' "$token" | npx wrangler pages secret put ADMIN_TOKEN --project-name conquercourse --env preview >/dev/null
umask 077
printf 'ADMIN_TOKEN=%s\n' "$token" > "$env_dir/admin.env"
chmod 600 "$env_dir/admin.env"
echo "ADMIN_TOKEN stored as the preview Pages secret. A copy is in $env_dir/admin.env."
echo "Your token (shown once here): $token"
echo "Open /admin/ on the preview address and paste it when asked."
echo "A deploy is needed once for a new secret to reach the running site."
