#!/usr/bin/env bash
set -euo pipefail
sha=${1:?release SHA required}
node_checksum=${2:?official Node SHA256 required}
[[ "$sha" =~ ^[0-9a-f]{40}$ && "$node_checksum" =~ ^[0-9a-f]{64}$ ]] || exit 2
base="$HOME/.local/share/nuochong-oa-test"
release="$base/releases/$sha"
node_root="$base/node/24.21.0"
if ! test -x "$node_root/bin/node"; then
  mkdir -p "$base/node"
  archive="$base/node/node-v24.21.0-linux-x64.tar.xz"
  found=false
  for origin in https://nodejs.org/dist https://npmmirror.com/mirrors/node; do
    if curl --fail --location --connect-timeout 10 --max-time 180 --speed-limit 65536 --speed-time 15 "$origin/v24.21.0/node-v24.21.0-linux-x64.tar.xz" -o "$archive"; then
      if printf '%s  %s\n' "$node_checksum" "$archive" | sha256sum -c -; then found=true; break; fi
    fi
  done
  test "$found" = true
  tar -xJf "$archive" -C "$base/node"
  mv "$base/node/node-v24.21.0-linux-x64" "$node_root"
  rm "$archive"
fi
ln -sfn "$node_root" "$release/runtime"
export PATH="$node_root/bin:$PATH"
test "$(node --version)" = v24.21.0
export npm_config_cache="$base/npm-cache"
# Lockfile integrity pins each archive; the registry mirror does not change versions.
npm ci --prefix "$release/apps/oa" --ignore-scripts --no-audit --no-fund \
  --registry=https://registry.npmmirror.com --fetch-retries=1 --fetch-timeout=30000
bash "$release/apps/oa/deploy/install-user.sh" "$sha"
