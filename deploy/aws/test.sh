#!/usr/bin/env bash
# اختبار كامل على Ubuntu حقيقي بعد setup.sh (يشغّله GitHub Actions). لا يُشغَّل على خادم فيه بيانات حقيقية.
set -euo pipefail
[ "${CI:-}" = true ] || { echo "This test wipes data; it only runs in CI."; exit 1; }
. /etc/awtad/server.conf
HERE=$(cd "$(dirname "$0")" && pwd)
step() { printf '\n### %s\n' "$*"; }
fail() { echo "FAIL: $*"; exit 1; }
code() { curl -sS -m 20 -o /dev/null -w '%{http_code}' -H 'content-type: application/json' "$@"; }
login() { code -d "{\"email\":\"$1\",\"password\":\"$2\"}" http://127.0.0.1/api/auth/login; }
register() { code -d "{\"role\":\"student\",\"name\":\"Test\",\"email\":\"$1\",\"password\":\"Pass-Word-1\"}" http://127.0.0.1/api/auth/register; }
sql() { (cd /tmp && runuser -u postgres -- "/usr/lib/postgresql/$DB_PG/bin/psql" -p "$DB_PORT" -v ON_ERROR_STOP=1 -tAq "$@"); }
expect() { [ "$1" = "$2" ] || fail "$3 (expected $1, got $2)"; echo "ok - $3"; }

step "site through the web server, on PostgreSQL"
health=$(curl -fsS http://127.0.0.1/api/health); expect '{"ok":true,"db":"postgres"}' "$health" health
page=$(curl -fsS http://127.0.0.1/); [[ "$page" == *'id="root"'* ]] || fail "home page"
headers=$(curl -sSI http://127.0.0.1/ | tr 'A-Z' 'a-z')
[[ "$headers" == *content-security-policy* ]] || fail "security headers"
[[ "$headers" != *upgrade-insecure-requests* ]] || fail "http test mode must not force https"
listen=$(ss -ltnH 'sport = :4000' | awk '{print $4}'); expect 127.0.0.1:4000 "$listen" "app is private"
expect 600 "$(stat -c %a /etc/awtad/awtad.env)" "secrets readable by root only"

step "admin account"
password=$(awtad password --raw); [ "${#password}" -ge 16 ] || fail "generated password too short"
expect 200 "$(login admin@awtad.iq "$password")" "admin login"
expect 401 "$(login admin@awtad.iq Admin@12345)" "default password rejected"

step "visitor address behind Cloudflare"
tmp=$(mktemp -d)
/usr/local/lib/awtad-node/bin/node -e 'require("http").createServer((q, s) => s.end(String(q.headers["x-forwarded-for"]))).listen(4999, "127.0.0.1")' &
echo_pid=$!
sed -e 's/127\.0\.0\.1:4000/127.0.0.1:4999/' -e 's/^:80 {/:8089 {/' -e 's/^{$/{\n\tadmin off/' /etc/caddy/Caddyfile > "$tmp/outsider"
sed 's#trusted_proxies static #trusted_proxies static 127.0.0.1/32 #' "$tmp/outsider" > "$tmp/proxy"
seen_by_app() {   # <ملف الإعداد>: العنوان الذي يصل للتطبيق حين يرسل الطالب ترويسات عنوان من عنده
  local pid out
  caddy run --config "$1" --adapter caddyfile >"$tmp/caddy.log" 2>&1 &
  pid=$!
  out=$(curl -sS -m 5 --retry 20 --retry-delay 1 --retry-connrefused -H 'CF-Connecting-IP: 203.0.113.7' -H 'X-Forwarded-For: 198.51.100.9' http://127.0.0.1:8089/) || { cat "$tmp/caddy.log" >&2; out=error; }
  kill "$pid"; wait "$pid" 2>/dev/null || true
  echo "$out"
}
expect 203.0.113.7 "$(seen_by_app "$tmp/proxy")" "visitor address taken from a trusted proxy"
expect 127.0.0.1 "$(seen_by_app "$tmp/outsider")" "address headers from anyone else are ignored"
kill "$echo_pid"; rm -rf "$tmp"

step "backup and restore"
expect 200 "$(register keep@example.com)" "register"
awtad backup
backup=$(ls -1t /var/backups/awtad/*.sql.gz | sed -n 1p)
expect 200 "$(register later@example.com)" "register after backup"
awtad restore "$backup"
expect 200 "$(login keep@example.com Pass-Word-1)" "data restored"
expect 401 "$(login later@example.com Pass-Word-1)" "newer data gone"
expect 200 "$(register after-restore@example.com)" "writes work after restore"

step "damaged backup changes nothing"
echo "not a backup" > /tmp/broken.sql.gz
if awtad restore /tmp/broken.sql.gz; then fail "damaged file accepted"; fi
echo "THIS IS NOT SQL;" | gzip > /tmp/bad.sql.gz
if awtad restore /tmp/bad.sql.gz; then fail "bad sql accepted"; fi
expect 200 "$(login keep@example.com Pass-Word-1)" "data kept after failed restore"

step "running setup again keeps data and secrets"
bash "$HERE/setup.sh"
expect "$password" "$(awtad password --raw)" "same admin password"
expect 200 "$(login keep@example.com Pass-Word-1)" "same data"

step "import from another database (like Neon)"
sql -c "CREATE ROLE src LOGIN PASSWORD 'Src-Test-Pass1'"
sql -c "CREATE DATABASE srcdb OWNER src"
latest=$(ls -1t /var/backups/awtad/*.sql.gz | sed -n 1p)
{ echo 'SET ROLE src;'; gunzip -c "$latest" | sed '/^CREATE SCHEMA public;$/d'; } | sql -d srcdb -f - >/dev/null
sql -d srcdb -c "UPDATE users SET email='imported@example.com' WHERE email='keep@example.com'"
echo "postgresql://src:Src-Test-Pass1@127.0.0.1:$DB_PORT/srcdb?sslmode=disable" | awtad import-db
expect 200 "$(login imported@example.com Pass-Word-1)" "imported account"
expect 200 "$(login admin@awtad.iq "$password")" "admin password still from the server"
expect 200 "$(register after-import@example.com)" "writes work after import"
if echo "postgresql://src:wrong@127.0.0.1:$DB_PORT/srcdb?sslmode=disable" | awtad import-db; then fail "wrong source accepted"; fi
expect 200 "$(login imported@example.com Pass-Word-1)" "data kept after failed import"

step "settings and domain"
echo 'New-Admin-Pass-123' | awtad config ADMIN_PASSWORD
expect 200 "$(login admin@awtad.iq New-Admin-Pass-123)" "new admin password"
expect 401 "$(login admin@awtad.iq "$password")" "old admin password rejected"
echo 'a "quoted" \ value' | awtad config MAIL_FROM
if awtad config NODE_ENV </dev/null; then fail "unlisted setting accepted"; fi
if awtad domain 'bad domain'; then fail "bad domain accepted"; fi
if awtad domain not-here.example.com; then fail "domain pointing elsewhere accepted"; fi
awtad domain awtad.example.com --force
[[ "$(awtad status)" == *https://awtad.example.com* ]] || fail "domain saved"
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null

step "web ports limited to Cloudflare"
web_open() { grep -qE '^(80|443)/tcp +ALLOW +Anywhere' <<<"$(ufw status)"; }
if awtad cloudflare on; then fail "locked although the domain is not behind Cloudflare"; fi
web_open || fail "refused lock changed the firewall"
awtad cloudflare on --force
if web_open; then fail "web ports still open to everyone"; fi
[[ "$(ufw status)" == *173.245.48.0/20* ]] || fail "Cloudflare range not allowed"
grep -qE '^22/tcp +ALLOW +Anywhere' <<<"$(ufw status)" || fail "ssh must stay open"
bash "$HERE/setup.sh"
if web_open; then fail "running setup again reopened the web ports"; fi
[[ "$(awtad status)" == *"Cloudflare only"* ]] || fail "status shows the lock"
awtad cloudflare off
web_open || fail "web ports not reopened"
if [[ "$(ufw status)" == *173.245.48.0/20* ]]; then fail "Cloudflare rules left behind"; fi
echo "ok - firewall lock and unlock"

step "update and restart"
awtad update
systemctl restart awtad && sleep 3
expect active "$(systemctl is-active awtad)" "service running"
systemctl start awtad-backup.service
expect active "$(systemctl is-active awtad-backup.timer)" "daily backup scheduled"
awtad status
echo
echo "ALL SERVER TESTS PASSED"
