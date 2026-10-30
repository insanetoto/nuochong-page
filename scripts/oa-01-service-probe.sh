#!/usr/bin/env bash
set -euo pipefail
mode=${1:?mode required}
probe_id=${2:?probe ID required}
[[ "$probe_id" =~ ^[0-9]+$ ]] || exit 2
state="$HOME/.local/state/nuochong-oa-test"
fixture="$state/workspace/oa-01-probe-$probe_id.txt"
snapshot="$state/oa-01-probe-$probe_id.sha256"
profile="$state/profiles/web/cordis.patch.yml"
unit=nuochong-oa-test.service
wait_ready() {
  for attempt in $(seq 1 90); do
    if test "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3080/ || true)" = 401; then return 0; fi
    sleep 1
  done
  return 1
}
case "$mode" in
  stop)
    test "$(systemctl --user is-active "$unit")" = active
    test -f "$profile"
    printf 'OA-01 synthetic workspace persistence %s\n' "$probe_id" > "$fixture"
    sha256sum "$fixture" "$profile" > "$snapshot"
    systemctl --user stop "$unit"
    test "$(systemctl --user is-active "$unit" || true)" = inactive
    ;;
  recover)
    systemctl --user start "$unit"
    wait_ready
    sha256sum -c "$snapshot" >/dev/null
    systemctl --user restart "$unit"
    wait_ready
    sha256sum -c "$snapshot" >/dev/null
    test "$(loginctl show-user "$(id -un)" -p Linger --value)" = yes
    test "$(systemctl --user is-enabled "$unit")" = enabled
    current="$HOME/.local/share/nuochong-oa-test/current"
    test "$("$current/runtime/bin/node" --version)" = v24.21.0
    test "$("$current/runtime/bin/node" -p "JSON.parse(require('fs').readFileSync('$current/apps/oa/node_modules/@deepseek-ai/dsh/package.json','utf8')).version")" = 0.2.1-rc.2
    test "$(stat -c '%a' "$state/launch-url")" = 600
    printf '{"passed":true,"stopStart":true,"restart":true,"workspaceRetained":true,"nativeProfileRetained":true,"linger":true,"enabled":true,"launchFileMode":"600","node":"24.21.0","harness":"0.2.1-rc.2","release":"%s","memoryMax":"%s","cpuQuotaPerSecUSec":"%s","tasksMax":"%s"}\n' "$(basename "$(readlink -f "$current")")" "$(systemctl --user show "$unit" -p MemoryMax --value)" "$(systemctl --user show "$unit" -p CPUQuotaPerSecUSec --value)" "$(systemctl --user show "$unit" -p TasksMax --value)"
    ;;
  cleanup)
    systemctl --user start "$unit"
    rm -f "$fixture" "$snapshot"
    ;;
  *) exit 2;;
esac
