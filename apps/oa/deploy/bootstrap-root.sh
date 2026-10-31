#!/usr/bin/env bash
# One-time administrator action; daily updates run as deploy via GitHub Actions.
set -euo pipefail
test "$(id -u)" = 0 || { echo 'Run this one-time bootstrap with sudo.'; exit 1; }
base=/home/deploy/.local/share/nuochong-oa-test/current
test -x "$base/runtime/bin/node"
test -f /home/deploy/.config/systemd/user/nuochong-oa-test.service
nginx -t
site=/etc/nginx/sites-available/nuochong
backup="${site}.before-oa-test.$(date +%Y%m%d%H%M%S)"
cp -p "$site" "$backup"
install -d /etc/nginx/snippets
install -m 644 "$base/apps/oa/deploy/nginx-location.conf" /etc/nginx/snippets/nuochong-oa-test.conf
python3 - "$site" <<'PY'
import sys,re
from pathlib import Path
p=Path(sys.argv[1]);s=p.read_text();include='include /etc/nginx/snippets/nuochong-oa-test.conf;'
if include not in s:
 matches=[]
 for m in re.finditer(r'\bserver\s*\{',s):
  level=1; i=m.end(); quoted=None; comment=False; escaped=False
  while i<len(s) and level:
   c=s[i]
   if comment:
    if c=='\n':comment=False
   elif escaped:escaped=False
   elif c=='\\':escaped=True
   elif quoted:
    if c==quoted:quoted=None
   elif c in "\"'":quoted=c
   elif c=='#':comment=True
   elif c=='{':level+=1
   elif c=='}':level-=1
   i+=1
  body=s[m.end():i-1]
  if re.search(r'\blisten\s+[^;]*\b443\b',body) and re.search(r'\bserver_name\s+[^;]*\bwww\.nuochong\.net\b',body):matches.append(i-1)
 assert len(matches)==1,'Expected exactly one existing www HTTPS server; no automatic change made.'
 i=matches[0];s=s[:i]+'    '+include+'\n'+s[i:];p.write_text(s)
PY
if ! nginx -t; then
  cp -p "$backup" "$site"
  echo 'Configuration validation failed; original site restored.'
  exit 1
fi
loginctl enable-linger deploy
systemctl reload nginx
uid=$(id -u deploy)
runuser -u deploy -- env XDG_RUNTIME_DIR="/run/user/$uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" systemctl --user daemon-reload
runuser -u deploy -- env XDG_RUNTIME_DIR="/run/user/$uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" systemctl --user enable --now nuochong-oa-test.service
printf 'Initialized the isolated OA test service at https://www.nuochong.net/oa-test/\n'
printf 'Native launch URL is private: /home/deploy/.local/state/nuochong-oa-test/launch-url\n'
printf 'Original Nginx configuration backup: %s\n' "$backup"
