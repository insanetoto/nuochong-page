#!/usr/bin/env bash
set -euo pipefail
umask 077
expected=$1
sha=$2
tag=$3
[[ "$expected" =~ ^[a-f0-9]{40}$ && "$sha" =~ ^[a-f0-9]{40}$ && "$tag" =~ ^[0-9]+-[0-9]+$ ]]
base="$HOME/.local/share/nuochong-knowledge-test"
state="$HOME/.local/state/nuochong-knowledge-test"
pg="$base/postgres/17.11"
node="$HOME/.local/share/nuochong-oa-test/current/runtime/bin/node"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export LD_LIBRARY_PATH="$pg/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$(dirname "$node"):$pg/bin:$PATH"
exec 9>"$state/import-release.lock"
flock -n 9
previous=$(readlink -f "$base/current")
old_sha=$(cat "$state/release-sha")
[[ "$previous" == "$base/releases/"* && "$old_sha" == "$expected" ]]
set -a
source "$state/runtime.env"
set +a
[[ "$OA_DATABASE_SCHEMA" == oa_knowledge_test && "$PRODUCT_OBJECT_ROOT" == "$state/objects" && "$OA_API_PORT" == 3081 ]]
case "$DATABASE_URL" in
  "postgresql:///postgres?host=$state&port=55437&user=$(id -un)") ;;
  *) echo 'Unexpected isolated database connection'; exit 1 ;;
esac
[[ $("$node" --version) == v24.21.0 ]]
units=(nuochong-knowledge-api.service nuochong-knowledge-worker.service)
for unit in "${units[@]}" nuochong-knowledge-db.service; do systemctl --user is-active --quiet "$unit"; done
incoming="$base/incoming-import-$tag"
(cd "$previous" && sha256sum --quiet -c "$incoming/base.sha256")
while IFS= read -r path; do test ! -e "$previous/$path"; done < "$incoming/added.txt"
release="$base/releases/$sha-import-$tag"
mkdir "$release"
cp -a "$previous/." "$release/"
tar -xzf "$incoming/patch.tgz" -C "$release"
(cd "$release" && sha256sum --quiet -c "$incoming/runtime.sha256")

snapshot="$state/backups/import-$tag"
paused=false
changed=false
committed=false
restore_on_error() {
  status=$?
  trap - EXIT
  if [[ "$paused" == true && "$committed" == false ]]; then
    if [[ "$changed" == true ]]; then
      set -e
      systemctl --user stop "${units[@]}"
      (cd "$snapshot" && sha256sum --quiet -c SHA256SUMS)
      mkdir "$state/object-restore-$tag"
      tar -xzf "$snapshot/objects.tgz" -C "$state/object-restore-$tag"
      {
        printf 'DROP SCHEMA oa_knowledge_test CASCADE;\n'
        pg_restore --no-owner --no-privileges --file=- "$snapshot/database.dump"
      } > "$snapshot/restore.sql"
      psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$snapshot/restore.sql" > /dev/null
      mv "$state/objects" "$snapshot/failed-objects"
      mv "$state/object-restore-$tag/objects" "$state/objects"
      ln -s "$previous" "$base/rollback-$tag"
      mv -Tf "$base/rollback-$tag" "$base/current"
      cp "$snapshot/release-sha" "$state/release-sha"
      cp "$snapshot/schema-version" "$state/schema-version"
      if test -f "$snapshot/previous-release"; then cp "$snapshot/previous-release" "$state/previous-release"; fi
      echo 'Restored previous isolated test release, schema and objects.'
    fi
    systemctl --user start "${units[@]}"
  fi
  exit "$status"
}
trap restore_on_error EXIT
paused=true
systemctl --user stop "${units[@]}"
[[ $(psql "$DATABASE_URL" -XAtqc 'SELECT max(version) FROM oa_knowledge_test.schema_versions') == 6 ]]
mkdir -m 700 "$snapshot"
pg_dump "$DATABASE_URL" -Fc -n oa_knowledge_test > "$snapshot/database.dump"
tar -czf "$snapshot/objects.tgz" -C "$state" objects
cp "$state/"{release-sha,schema-version} "$snapshot/"
if test -f "$state/previous-release"; then cp "$state/previous-release" "$snapshot/"; fi
(cd "$snapshot" && sha256sum database.dump objects.tgz release-sha schema-version > SHA256SUMS && sha256sum --quiet -c SHA256SUMS)
pg_restore --list "$snapshot/database.dump" >/dev/null
echo 'Paired database and object backup checked.'

cd "$release"
changed=true
"$node" apps/control-api/src/migrate.mjs
[[ $(psql "$DATABASE_URL" -XAtqc 'SELECT max(version) FROM oa_knowledge_test.schema_versions') == 7 ]]
ln -s "$release" "$base/current-$tag.next"
mv -Tf "$base/current-$tag.next" "$base/current"
systemctl --user start "${units[@]}"
for attempt in {1..25}; do
  if curl -fsS --max-time 3 http://127.0.0.1:3081/product/ -o /dev/null; then break; fi
  sleep 1
done
for unit in "${units[@]}"; do systemctl --user is-active --quiet "$unit"; done
"$node" --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const base = 'https://www.nuochong.net/oa-test/product/';
for (const url of [base, 'https://www.nuochong.net/', 'http://127.0.0.1:3081/product/']) {
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
}
const pageModule = await fetch(base + 'plugins/knowledge.mjs', {
  cache: 'no-store',
  signal: AbortSignal.timeout(15000)
});
assert.equal(pageModule.status, 200);
assert.equal(hash(Buffer.from(await pageModule.arrayBuffer())), hash(readFileSync('apps/product-web/plugins/knowledge.mjs')));
const anonymous = await fetch(base + 'api/commands/knowledge.imports.list.v1', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({spaceId:'synthetic-check'}),
  signal: AbortSignal.timeout(15000)
});
assert.equal(anonymous.status, 401);
assert.equal((await anonymous.json()).code, 'UNAUTHORIZED');
console.log('PASS test/public pages, exact public import UI and anonymous rejection.');
JS
printf '%s\n' "$previous" > "$state/previous-release"
printf '7\n' > "$state/schema-version"
printf '%s\n' "$sha" > "$state/release-sha"
committed=true
printf 'PASS activated %s with schema 007.\n' "$sha"

# Functional validation uses disposable schemas and synthetic objects on the same runtime.
TEST_DATABASE_URL="$DATABASE_URL" "$node" --test \
  apps/control-api/test/import-parsers.test.mjs apps/control-api/test/knowledge-imports.test.mjs
