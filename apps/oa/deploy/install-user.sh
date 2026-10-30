#!/usr/bin/env bash
set -euo pipefail
base="$HOME/.local/share/nuochong-oa-test"
release="$base/releases/${1:?release SHA is required}"
[[ "$1" =~ ^[0-9a-f]{40}$ ]] || exit 2
test -x "$release/runtime/bin/node"
test "$("$release/runtime/bin/node" --version)" = v24.21.0
mkdir -p "$HOME/.local/state/nuochong-oa-test" "$HOME/.config/systemd/user"
chmod 700 "$HOME/.local/state/nuochong-oa-test"
ln -sfn "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
install -m 644 "$release/apps/oa/deploy/nuochong-oa-test.service" "$HOME/.config/systemd/user/nuochong-oa-test.service"
if test "$(loginctl show-user "$(id -un)" -p Linger --value)" = yes && test -f /etc/nginx/snippets/nuochong-oa-test.conf; then
  systemctl --user daemon-reload
  systemctl --user enable --now nuochong-oa-test.service
  systemctl --user restart nuochong-oa-test.service
  printf 'Native test service updated.\n'
else
  printf 'Runtime staged. Administrator bootstrap is required before public service startup.\n'
fi
