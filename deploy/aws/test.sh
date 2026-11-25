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

step "update and restart"
awtad update
systemctl restart awtad && sleep 3
expect active "$(systemctl is-active awtad)" "service running"
systemctl start awtad-backup.service
expect active "$(systemctl is-active awtad-backup.timer)" "daily backup scheduled"
awtad status
echo
echo "ALL SERVER TESTS PASSED"
