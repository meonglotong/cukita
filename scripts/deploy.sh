#!/usr/bin/env bash
# Run FROM THE VM (copied to /opt/teamkb/scripts/deploy.sh by deploy-from-mac.sh).
# Installs deps, builds, migrates, seeds the admin, and (re)starts the service.
set -euo pipefail
cd /opt/teamkb
# Full install (NOT --prod): `next build` needs the `typescript` devDependency
# to read tsconfig "paths" (the @/ alias). sudo's env_reset strips plain env
# vars, so each pnpm command runs in a shell that sources .env.production as
# the teamkb user (file is 600 teamkb-owned).
as_teamkb() {
  sudo -u teamkb bash -c "cd /opt/teamkb && set -a && . ./.env.production && set +a && $*"
}
as_teamkb pnpm install
as_teamkb pnpm build
as_teamkb pnpm migrate
as_teamkb pnpm seed:admin
sudo systemctl daemon-reload
sudo systemctl restart teamkb
sleep 3
# nginx (conf.d/teamkb.conf) must already be installed and reloaded: it owns
# the public port 3002 and proxies to the app on 127.0.0.1:3102.
curl -sf http://127.0.0.1:3002/login >/dev/null && echo "deploy OK" || (systemctl status teamkb --no-pager; exit 1)
