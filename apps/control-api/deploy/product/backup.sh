#!/usr/bin/env bash
set -euo pipefail
state="$HOME/.local/state/nuochong-knowledge-test"; pg="$HOME/.local/share/nuochong-knowledge-test/postgres/17.11"
export LD_LIBRARY_PATH="$pg/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
set -a; source "$state/runtime.env"; set +a
umask 077
snapshot="$state/backups/$(date -u +%Y%m%dT%H%M%SZ)"; mkdir -p "$snapshot"
# Pause all product mutations during the paired database/object backup.
trap 'systemctl --user start nuochong-knowledge-api.service nuochong-knowledge-worker.service' EXIT
systemctl --user stop nuochong-knowledge-api.service nuochong-knowledge-worker.service
"$pg/bin/pg_dump" "$DATABASE_URL" -Fc -n oa_knowledge_test > "$snapshot/database.dump"
tar -czf "$snapshot/objects.tgz" -C "$state" objects
cp "$state/release-sha" "$snapshot/release-sha"
(cd "$snapshot" && sha256sum database.dump objects.tgz release-sha > SHA256SUMS)
printf 'Paired private backup completed.\n'
