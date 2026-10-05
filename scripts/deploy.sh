#!/usr/bin/env bash
# Run FROM THE VM (copied to /opt/teamdocs/scripts/deploy.sh by deploy-from-mac.sh).
# Installs deps, builds, migrates, seeds the admin, and (re)starts the service.
set -euo pipefail
cd /opt/teamdocs
# sudo's env_reset strips plain env vars, and `next build` needs the
# `typescript` devDependency to read tsconfig "paths" (the @/ alias), so:
#   1. full install (NOT --prod)
#   2. run each pnpm command in a shell that sources .env.production as the
#      teamdocs user (the file is 600 teamdocs-owned — teamdocs can read it,
#      agent cannot, and sudo -u teamdocs does NOT inherit agent's env).
as_teamdocs() {
  sudo -u teamdocs bash -c "cd /opt/teamdocs && set -a && . ./.env.production && set +a && $*"
}
as_teamdocs pnpm install
as_teamdocs pnpm build
as_teamdocs pnpm migrate
as_teamdocs pnpm seed:admin
sudo systemctl daemon-reload
sudo systemctl restart teamdocs
sleep 3
# nginx (conf.d/teamdocs.conf) must already be installed and reloaded: it owns
# the public port 3001 and proxies to the app on 127.0.0.1:3100.
curl -sf http://127.0.0.1:3001/login >/dev/null && echo "deploy OK" || (systemctl status teamdocs --no-pager; exit 1)
