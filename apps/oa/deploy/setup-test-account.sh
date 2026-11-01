#!/usr/bin/env bash
set -euo pipefail
base=/home/deploy/.local/share/nuochong-oa-test/current
export NUOCHONG_OA_HOME=/home/deploy/.local/state/nuochong-oa-test
IFS= read -r -p '测试管理员账号：' OA_SETUP_USER </dev/tty
IFS= read -r -s -p '测试管理员密码：' OA_SETUP_PASSWORD </dev/tty
printf '\n' >/dev/tty
export OA_SETUP_USER OA_SETUP_PASSWORD
"$base/runtime/bin/node" -e 'process.stdout.write(JSON.stringify({username:process.env.OA_SETUP_USER,password:process.env.OA_SETUP_PASSWORD}))' | "$base/runtime/bin/node" "$base/apps/oa/deploy/configure-login.mjs"
"$base/runtime/bin/node" "$base/apps/oa/deploy/verify-configured-account.mjs"
unset OA_SETUP_USER OA_SETUP_PASSWORD
