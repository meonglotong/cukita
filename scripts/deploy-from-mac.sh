#!/usr/bin/env bash
# deploy-from-mac.sh — full TeamDocs deployment from the Mac onto the VM.
# Idempotent: safe to re-run (reuses the existing DB password, skips
# completed steps, rsync --delete, sed-guarded syncthing port move).
#
# Long VM operations run detached (setsid nohup + marker file) because
# Wi-Fi/NAT can blackhole a session mid-operation; the script polls the
# marker instead of trusting the ssh connection.
#
# VM facts (verified 2026-09-25):
#   - ssh agent@172.31.252.197 with ~/.ssh/id_ed25519, passwordless sudo
#   - nginx 1.20.1 includes /etc/nginx/conf.d/*.conf; Grafana owns :3000
#   - the syncthing dashboard node app (/opt/syncthing-central) used to
#     hardcode :3001 and is proxied by nginx on :1122 → we move it to :3101
#   - TeamDocs: public :3001 (nginx) → app :3100, PG18 on :5432
set -euo pipefail

VM_HOST="172.31.252.197"
VM_USER="agent"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes)

APP_DIR="/opt/teamdocs"
FILES_DIR="/var/lib/teamdocs/files"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@team.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 16)}"
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -hex 32)}"
AUTH_URL="${AUTH_URL:-http://$VM_HOST:3001}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

vm() { ssh -i "$SSH_KEY" "${SSH_OPTS[@]}" "$VM_USER@$VM_HOST" "$@"; }

# vm_bg <logfile> <remote-command>
# Run a long remote command detached; poll <logfile>.exit (written by the
# command wrapper) until done. Survives ssh blackholes.
vm_bg() {
  local logfile="$1"; shift
  local exit_file="${logfile}.exit"
  vm "rm -f $exit_file; setsid nohup bash -c '$1; echo \$? > $exit_file' > $logfile 2>&1 </dev/null &"
  echo "  ... detached, polling $exit_file (log: $logfile)"
  local i
  for i in $(seq 1 240); do
    if vm "test -f $exit_file" 2>/dev/null; then
      local rc
      rc="$(vm "cat $exit_file")"
      vm "rm -f $exit_file"
      if [ "$rc" != "0" ]; then
        echo "  FAILED (rc=$rc) — tail of $logfile:" >&2
        vm "tail -20 $logfile" >&2 || true
        return 1
      fi
      return 0
    fi
    sleep 5
  done
  echo "  TIMEOUT (20 min) — check $logfile on the VM manually" >&2
  return 1
}

echo "=== TeamDocs deploy from Mac → $VM_HOST ==="
echo "ADMIN_EMAIL=$ADMIN_EMAIL"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"

# ---------------------------------------------------------------- 1. PGDG 18
echo "== [1/9] PostgreSQL 18 (PGDG) =="
if vm "systemctl is-active postgresql-18" | grep -q '^active$'; then
  echo "  postgresql-18 already active — skipping install"
else
  vm_bg /tmp/pgdg-install.log \
    "dnf -y install https://download.postgresql.org/pub/repos/yum/reporpm/centos/9/x86_64/pgdg-redhat-repo-latest.rpm postgresql18-server && sudo postgresql-setup --initdb && sudo systemctl enable --now postgresql-18"
fi
vm "sudo systemctl enable postgresql-18"

# ---------------------------------------------------------------- 2. role+db
echo "== [2/9] Postgres role + database =="
# Reuse the password from an existing .env.production on re-runs so the DB
# role is never orphaned from its stored credentials. Generate ONCE, keep it
# in a shell variable, and write it into .env.production below.
existing_db_url="$(vm "grep '^DATABASE_URL=' $APP_DIR/.env.production" 2>/dev/null || true)"
if [ -n "$existing_db_url" ]; then
  DB_PASSWORD="$(printf '%s' "$existing_db_url" | sed -E 's|^DATABASE_URL=postgres://teamdocs:([^@]+)@.*$|\1|')"
  echo "  reusing existing DB password"
else
  DB_PASSWORD="$(openssl rand -hex 16)"
  echo "  generated new DB password"
fi
# CREATE if missing, else ALTER: the role password must always match what
# .env.production stores (a re-run generates a fresh password when no
# .env.production exists yet).
if vm "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='teamdocs'\"" | grep -q 1; then
  vm "sudo -u postgres psql -qc \"ALTER USER teamdocs WITH PASSWORD '$DB_PASSWORD'\""
else
  vm "sudo -u postgres psql -qc \"CREATE USER teamdocs WITH PASSWORD '$DB_PASSWORD'\""
fi
vm "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='teamdocs'\"" | grep -q 1 || \
  vm "sudo -u postgres psql -qc 'CREATE DATABASE teamdocs OWNER teamdocs'"
echo "  role+database ok"

# ------------------------------------------------- 3. system user + dirs
echo "== [3/9] teamdocs system user + dirs =="
vm "getent passwd teamdocs >/dev/null || sudo useradd -m teamdocs"
vm "sudo mkdir -p $FILES_DIR $APP_DIR"
vm "sudo chown -R teamdocs: $FILES_DIR $APP_DIR"

# ------------------------------------------------------------ 4. free :3001
echo "== [4/9] Free port 3001 (syncthing → :3101, scratch → kill) =="
# The syncthing dashboard node app hardcoded :3001; nginx proxies it on :1122.
# Move it to :3101 (one-shot, sed-guarded so re-runs are no-ops).
if vm "test -f /opt/syncthing-central/server.js && grep -q 'const PORT = 3001;' /opt/syncthing-central/server.js"; then
  echo "  moving syncthing-central 3001 → 3101"
  vm "sudo cp /opt/syncthing-central/server.js /opt/syncthing-central/server.js.bak-teamdocs"
  vm "sudo sed -i 's/const PORT = 3001;/const PORT = 3101;/' /opt/syncthing-central/server.js"
  vm "sudo sed -i 's|proxy_pass http://127.0.0.1:3001;|proxy_pass http://127.0.0.1:3101;|' /etc/nginx/conf.d/syncthing-dashboard.conf"
  vm "pid=\$(sudo ss -tlnp | grep ':3001 ' | grep -oP 'pid=\K[0-9]+' | head -1); if [ -n \"\$pid\" ]; then sudo kill \$pid; else echo '  nothing on :3001'; fi"
  # </dev/null is required: a backgrounded process holding the ssh session's
  # stdin/out keeps the channel open and the ssh call hangs.
  vm "sudo bash -c 'cd /opt/syncthing-central && NODE_ENV=production setsid nohup /usr/bin/node server.js >> /var/log/syncthing-central.log 2>&1 </dev/null &'"
  # :1122 is verified after the nginx reload in step 8.
  vm "sleep 2; curl -sf http://127.0.0.1:3101 >/dev/null && echo '  syncthing app up on :3101'"
else
  echo "  syncthing already off :3001"
fi
# Scratch next-server left over from earlier sessions on :3999.
vm "pid=\$(sudo ss -tlnp | grep ':3999 ' | grep -oP 'pid=\K[0-9]+' | head -1); [ -n \"\$pid\" ] && sudo kill \$pid && echo '  killed scratch next-server on :3999' || echo '  nothing on :3999'"
# Scratch build dirs.
vm "rm -rf /tmp/scratch-next /tmp/scratch-next.tar.gz"

# ---------------------------------------------------------------- 5. rsync
echo "== [5/9] rsync repo → $APP_DIR (via staging) =="
# .env.local is excluded: Next.js would let the Mac's dev env override
# .env.production on the VM. .env.production is written right after.
# $APP_DIR is owned by teamdocs (step 3), so rsync lands in an agent-owned
# staging dir first; a local root rsync on the VM moves it into place.
STAGE="/tmp/teamdocs-stage"
vm "rm -rf $STAGE && mkdir -p $STAGE"
rsync -a -e "ssh -i $SSH_KEY -o ConnectTimeout=10" --delete \
  --exclude node_modules --exclude .next --exclude .data --exclude .git \
  --exclude .worktrees --exclude .superpowers --exclude /docs \
  --exclude .env.local \
  "$REPO_DIR/" "$VM_USER@$VM_HOST:$STAGE/"
vm "sudo rsync -a --delete $STAGE/ $APP_DIR/ && sudo chown -R teamdocs: $APP_DIR && sudo rm -rf $STAGE"
echo "  rsync done"

# ---------------------------------------------------- 6. .env.production
echo "== [6/9] $APP_DIR/.env.production =="
vm "cat > /tmp/teamdocs.env" <<EOF
DATABASE_URL=postgres://teamdocs:$DB_PASSWORD@127.0.0.1:5432/teamdocs
FILES_DIR=$FILES_DIR
AUTH_SECRET=$AUTH_SECRET
AUTH_URL=$AUTH_URL
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
vm "sudo mv /tmp/teamdocs.env $APP_DIR/.env.production && sudo chown teamdocs: $APP_DIR/.env.production && sudo chmod 600 $APP_DIR/.env.production"

# ------------------------------------------------------------ 7. systemd
echo "== [7/9] systemd unit =="
vm "sudo cp $APP_DIR/scripts/teamdocs.service /etc/systemd/system/teamdocs.service"
vm "sudo systemctl daemon-reload"
vm "sudo systemctl enable teamdocs"

# --------------------------------------------------------------- 8. nginx
echo "== [8/9] nginx (3001 → 127.0.0.1:3100) =="
vm "sudo cp $APP_DIR/scripts/nginx-teamdocs.conf /etc/nginx/conf.d/teamdocs.conf"
vm "sudo nginx -t"
vm "sudo systemctl reload nginx"
vm "curl -sf http://127.0.0.1:1122 >/dev/null && echo '  syncthing dashboard ok via nginx :1122'"

# --------------------------------------------------------- 9. deploy + smoke
echo "== [9/9] deploy.sh on VM (detached) + smoke =="
# log lives in /tmp: agent (not teamdocs) creates it; $APP_DIR is teamdocs-owned
vm_bg /tmp/teamdocs-deploy.log "cd $APP_DIR && bash scripts/deploy.sh"
vm "curl -sf http://127.0.0.1:3001/login >/dev/null && echo '  login page 200 via nginx :3001'"
vm "curl -sf http://127.0.0.1:3100/login >/dev/null && echo '  app direct :3100 ok'"
vm "bash $APP_DIR/scripts/smoke.sh"

echo
echo "=== DEPLOY COMPLETE ==="
echo "Live URL:     http://$VM_HOST:3001"
echo "ADMIN_EMAIL:  $ADMIN_EMAIL"
echo "ADMIN_PASSWORD: $ADMIN_PASSWORD"
echo "(DB password + AUTH_SECRET also stored in $APP_DIR/.env.production)"
