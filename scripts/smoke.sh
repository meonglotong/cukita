#!/usr/bin/env bash
# Run on the VM after deploy: logs in through the full nginx->app chain and
# calls /api/docs with the session cookie. Creds come from .env.production.
set -euo pipefail
BASE=http://127.0.0.1:3002
set -a; . <(sudo cat /opt/teamkb/.env.production); set +a
J=$(mktemp)
trap 'rm -f "$J"' EXIT
csrf=$(curl -sc "$J" "$BASE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
curl -sb "$J" -c "$J" -X POST "$BASE/api/auth/callback/credentials" \
  -d "csrfToken=$csrf&email=$ADMIN_EMAIL&password=$ADMIN_PASSWORD" --data-urlencode -L >/dev/null
curl -sb "$J" "$BASE/api/docs" | python3 -c "import sys,json;d=json.load(sys.stdin);print('docs api ok, total pages:', len(d))"
echo "smoke OK"
