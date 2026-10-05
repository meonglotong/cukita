#!/usr/bin/env bash
# deploy-from-mac.sh — full TeamKB deployment from the Mac onto the VM.
# Idempotent: safe to re-run (reuses existing DB password, skips done steps).
#
# Long VM operations run detached (setsid nohup + marker file) because
# Wi-Fi/NAT can blackhole a session mid-operation; the script polls the
# marker instead of trusting the ssh connection.
#
# VM facts (verified with teamdocs deploy 2026-09-25):
#   - ssh agent@172.31.252.197 with ~/.ssh/id_ed25519, passwordless sudo
#   - nginx 1.20.1 includes /etc/nginx/conf.d/*.conf; Grafana owns :3000
#   - PG18 already installed (teamdocs); teamdocs: public :3001 → app :3100
#   - TeamKB: public :3002 → app :3102, db `kb`, role/user `teamkb`
set -euo pipefail

VM_HOST="172.31.252.197"
VM_USER="agent"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes)

APP_DIR="/opt/teamkb"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@team.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 16)}"
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -hex 32)}"
AUTH_URL="${AUTH_URL:-http://$VM_HOST:3002}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

vm() { ssh -i "$SSH_KEY" "${SSH_OPTS[@]}" "$VM_USER@$VM_HOST" "$@"; }

# vm_bg <logfile> <remote-command>
# Run a long remote command detached; poll <logfile>.exit until done.
# Survives ssh blackholes.
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

echo "=== TeamKB deploy from Mac → $VM_HOST ==="
echo "ADMIN_EMAIL=$ADMIN_EMAIL"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"

# ------------------------------------------------- 1. Postgres (PG18 ada)
echo "== [1/6] Postgres role + database (teamkb / kb) =="
vm "systemctl is-active postgresql-18" | grep -q '^active$' || { echo "postgresql-18 not active!"; exit 1; }
existing_db_url="$(vm "grep '^DATABASE_URL=' $APP_DIR/.env.production" 2>/dev/null || true)"
if [ -n "$existing_db_url" ]; then
  DB_PASSWORD="$(printf '%s' "$existing_db_url" | sed -E 's|^DATABASE_URL=postgres://teamkb:([^@]+)@.*$|\1|')"
  echo "  reusing existing DB password"
else
  DB_PASSWORD="$(openssl rand -hex 16)"
  echo "  generated new DB password"
fi
if vm "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='teamkb'\"" | grep -q 1; then
  vm "sudo -u postgres psql -qc \"ALTER USER teamkb WITH PASSWORD '$DB_PASSWORD'\""
else
  vm "sudo -u postgres psql -qc \"CREATE USER teamkb WITH PASSWORD '$DB_PASSWORD'\""
fi
vm "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='kb'\"" | grep -q 1 || \
  vm "sudo -u postgres psql -qc 'CREATE DATABASE kb OWNER teamkb'"
echo "  role+database ok"

# ------------------------------------------------- 2. system user + dirs
echo "== [2/6] teamkb system user + /opt/teamkb =="
vm "getent passwd teamkb >/dev/null || sudo useradd -m teamkb"
vm "sudo mkdir -p $APP_DIR && sudo chown -R teamkb: $APP_DIR"

# ------------------------------------------------------------ 3. rsync repo
echo "== [3/6] rsync repo → $APP_DIR (via staging) =="
# .env.local is excluded: Next.js would let the Mac's dev env override
# .env.production on the VM. $APP_DIR is teamkb-owned, so rsync lands in an
# agent-owned staging dir first; a local root rsync on the VM moves it in.
STAGE="/tmp/teamkb-stage"
vm "rm -rf $STAGE && mkdir -p $STAGE"
rsync -a -e "ssh -i $SSH_KEY -o ConnectTimeout=10" --delete \
  --exclude node_modules --exclude .next --exclude .data --exclude .git \
  --exclude .worktrees --exclude .superpowers --exclude /docs \
  --exclude .env.local \
  "$REPO_DIR/" "$VM_USER@$VM_HOST:$STAGE/"
vm "sudo rsync -a --delete $STAGE/ $APP_DIR/ && sudo chown -R teamkb: $APP_DIR && sudo rm -rf $STAGE"
echo "  rsync done"

# ------------------------------------------------- 4. .env.production
echo "== [4/6] $APP_DIR/.env.production =="
vm "cat > /tmp/teamkb.env" <<EOF
DATABASE_URL=postgres://teamkb:$DB_PASSWORD@127.0.0.1:5432/kb
AUTH_SECRET=$AUTH_SECRET
AUTH_URL=$AUTH_URL
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
vm "sudo mv /tmp/teamkb.env $APP_DIR/.env.production && sudo chown teamkb: $APP_DIR/.env.production && sudo chmod 600 $APP_DIR/.env.production"

# ------------------------------------------------------------ 5. systemd
echo "== [5/6] systemd unit =="
vm "sudo cp $APP_DIR/scripts/teamkb.service /etc/systemd/system/teamkb.service"
vm "sudo systemctl daemon-reload"
vm "sudo systemctl enable teamkb"

# --------------------------------------------------------------- 6. nginx
echo "== [6/6] nginx (3002 → 127.0.0.1:3102) + deploy + smoke =="
vm "sudo cp $APP_DIR/scripts/nginx-teamkb.conf /etc/nginx/conf.d/teamkb.conf"
vm "sudo nginx -t"
vm "sudo systemctl reload nginx"
vm_bg /tmp/teamkb-deploy.log "cd $APP_DIR && bash scripts/deploy.sh"
vm "curl -sf http://127.0.0.1:3002/login >/dev/null && echo '  login page 200 via nginx :3002'"
vm "bash $APP_DIR/scripts/smoke.sh"

echo
echo "=== DEPLOY COMPLETE ==="
echo "Live URL:     http://$VM_HOST:3002"
echo "ADMIN_EMAIL:  $ADMIN_EMAIL"
echo "ADMIN_PASSWORD: $ADMIN_PASSWORD"
echo "(DB password + AUTH_SECRET also stored in $APP_DIR/.env.production)"
