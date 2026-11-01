#!/usr/bin/env bash
set -euo pipefail
sha=${1:?release SHA}; [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 2
base="$HOME/.local/share/nuochong-knowledge-test"
state="$HOME/.local/state/nuochong-knowledge-test"
release="$base/releases/$sha"
node="$HOME/.local/share/nuochong-oa-test/current/runtime/bin/node"
pg="$base/postgres/17.11"
export PATH="$(dirname "$node"):$pg/bin:$PATH"
export LD_LIBRARY_PATH="$pg/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
mkdir -p "$state" "$HOME/.config/systemd/user"; chmod 700 "$state"
test "$(node --version)" = v24.21.0
if ! test -f "$state/postgres/PG_VERSION"; then
  initdb -D "$state/postgres" --auth-local=trust --auth-host=scram-sha-256 --encoding=UTF8 --locale=C >/dev/null
  cat >> "$state/postgres/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
port = 55437
unix_socket_directories = '$state'
shared_buffers = 32MB
max_connections = 30
CONF
fi
cat > "$HOME/.config/systemd/user/nuochong-knowledge-db.service" <<UNIT
[Unit]
Description=Nuochong isolated knowledge test PostgreSQL
[Service]
Environment=LD_LIBRARY_PATH=$pg/lib
ExecStart=$pg/bin/postgres -D $state/postgres
Restart=on-failure
RestartSec=3
TimeoutStopSec=30
KillSignal=SIGINT
UMask=0077
MemoryMax=256M
NoNewPrivileges=true
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now nuochong-knowledge-db.service >/dev/null
for attempt in {1..30}; do pg_isready -h "$state" -p 55437 -q && break; sleep 1; done
# Use the private Unix socket; TCP requires a password and is never used by the application.
printf 'DATABASE_URL="postgresql:///postgres?host=%s&port=55437&user=%s"\nOA_DATABASE_SCHEMA=oa_knowledge_test\nOA_RUNTIME_HOME=%s\nPRODUCT_OBJECT_ROOT=%s/objects\nPRODUCT_PUBLIC_URL=https://www.nuochong.net/oa-test/product/\nOA_API_PORT=3081\n' "$state" "$(id -un)" "$state" "$state" > "$state/runtime.env"
chmod 600 "$state/runtime.env"
export npm_config_cache="$base/npm-cache"
npm ci --prefix "$release/apps/control-api" --ignore-scripts --no-audit --no-fund --registry=https://registry.npmmirror.com --fetch-retries=1 --fetch-timeout=30000 >/dev/null
# Reuse only the already-authorized server-side model secret, never transfer it to CI.
NUOCHONG_NATIVE_STATE="$HOME/.local/state/nuochong-oa-test" NUOCHONG_KB_STATE="$state" node "$release/apps/control-api/deploy/product/prepare-model.mjs"
set -a; source "$state/runtime.env"; set +a
node "$release/apps/control-api/src/migrate.mjs"
if test "$(psql "$DATABASE_URL" -Atqc 'SELECT initialized FROM oa_knowledge_test.product_settings WHERE id=1')" != t; then
  test -s "$state/bootstrap-input.json"
  node "$release/apps/control-api/src/product-bootstrap.mjs" < "$state/bootstrap-input.json"
  rm -f "$state/bootstrap-input.json"
  touch "$state/initialized"
fi
if test -L "$base/current"; then readlink "$base/current" > "$state/previous-release"; fi
ln -sfn "$release" "$base/current.next"; mv -Tf "$base/current.next" "$base/current"
for spec in 'api:server.mjs:256' 'worker:product-worker-main.mjs:640'; do
  IFS=: read -r name entry memory <<< "$spec"
  cat > "$HOME/.config/systemd/user/nuochong-knowledge-$name.service" <<UNIT
[Unit]
Description=Nuochong isolated knowledge test $name
Requires=nuochong-knowledge-db.service
After=nuochong-knowledge-db.service
[Service]
WorkingDirectory=$base/current
EnvironmentFile=$state/runtime.env
EnvironmentFile=$state/model.env
ExecStart=$node --max-old-space-size=$((memory-64)) apps/control-api/src/$entry
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
MemoryMax=${memory}M
TasksMax=256
[Install]
WantedBy=default.target
UNIT
done
systemctl --user daemon-reload
systemctl --user enable --now nuochong-knowledge-api.service nuochong-knowledge-worker.service >/dev/null
systemctl --user restart nuochong-knowledge-api.service nuochong-knowledge-worker.service
for attempt in {1..30}; do curl -fsS http://127.0.0.1:3081/product/ -o /dev/null && break; sleep 1; done
curl -fsS http://127.0.0.1:3081/product/ -o /dev/null
node "$release/apps/control-api/deploy/product/seed-space.mjs"
rm -f "$state/product-bootstrap-access.json" "$state/bootstrap-input.json"
# The Native gateway adds only a prefix route to the independently authenticated product API.
native="$HOME/.local/share/nuochong-oa-test/current/apps/oa/deploy"
if ! test -f "$state/gateway-before-kb.mjs"; then cp "$native/gateway.mjs" "$state/gateway-before-kb.mjs"; cp "$native/service.mjs" "$state/service-before-kb.mjs"; fi
install -m 644 "$release/apps/oa/deploy/gateway.mjs" "$native/gateway.mjs"
install -m 644 "$release/apps/oa/deploy/service.mjs" "$native/service.mjs"
mkdir -p "$HOME/.config/systemd/user/nuochong-oa-test.service.d"
printf '[Service]\nEnvironment=NUOCHONG_PRODUCT_UPSTREAM=http://127.0.0.1:3081\n' > "$HOME/.config/systemd/user/nuochong-oa-test.service.d/knowledge.conf"
systemctl --user daemon-reload
systemctl --user restart nuochong-oa-test.service
for attempt in {1..30}; do curl -fsS http://127.0.0.1:3080/product/ -o /dev/null && break; sleep 1; done
curl -fsS http://127.0.0.1:3080/product/ -o /dev/null
printf '%s\n' "$sha" > "$state/release-sha"
printf 'Isolated knowledge test services installed.\n'
