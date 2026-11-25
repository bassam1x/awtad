#!/usr/bin/env bash
# أوامر إدارة خادم أوتاد. ينسخها setup.sh إلى /usr/local/bin/awtad وتُشغَّل بـ sudo. الأسرار تبقى على الخادم فقط.
set -euo pipefail

ENVF=/etc/awtad/awtad.env
CONF=/etc/awtad/server.conf
APP=/opt/awtad/app
NODE_DIR=/usr/local/lib/awtad-node
BACKUPS=/var/backups/awtad
ADMIN_EMAIL=admin@awtad.iq
SETTABLE="ADMIN_PASSWORD JWT_SECRET LINKEDIN_CLIENT_ID LINKEDIN_CLIENT_SECRET MAIL_SCRIPT_URL MAIL_SCRIPT_SECRET BREVO_API_KEY MAIL_FROM SUPPORT_EMAIL SUPPORT_INSTAGRAM RATE_LIMIT_MAX FIREBASE_API_KEY FIREBASE_PROJECT_ID TRANSLATE_PROVIDER"
LAST_BACKUP=

usage() {
  cat <<'EOF'
sudo awtad <command>
  status                 show whether everything is running
  logs [lines]           application log
  password               show the platform admin email and password
  config <KEY>           set a setting or secret (typed hidden), e.g. ADMIN_PASSWORD, LINKEDIN_CLIENT_SECRET
  domain <example.com>   connect a domain and turn on https
  update                 install the latest version from GitHub (backs up first)
  backup                 back up the database now (a daily backup runs automatically)
  restore <file.sql.gz>  restore a backup
  import-db              copy the data from another PostgreSQL database (e.g. Neon)
EOF
}
die() { echo "ERROR: $*" >&2; exit 1; }
load() { [ -f "$CONF" ] || die "not installed, run setup.sh first"; . "$CONF"; PGBIN=/usr/lib/postgresql/$DB_PG/bin; }
as_app() { (cd /tmp && runuser -u awtad -- env HOME=/opt/awtad PATH="$NODE_DIR/bin:/usr/bin:/bin" "$@"); }
psql_admin() { (cd /tmp && runuser -u postgres -- "$PGBIN/psql" -p "$DB_PORT" -v ON_ERROR_STOP=1 -tAq "$@"); }

env_get() { sed -n "s/^$1=//p" "$ENVF" | tail -n 1 | sed -e 's/^"//' -e 's/"$//' -e 's/\\"/"/g' -e 's/\\\\/\\/g'; }
env_set() {
  local tmp value=${2//\\/\\\\}
  value=${value//\"/\\\"}
  tmp=$(mktemp)
  grep -v "^$1=" "$ENVF" > "$tmp" || true
  printf '%s="%s"\n' "$1" "$value" >> "$tmp"
  install -m 600 "$tmp" "$ENVF"
  rm -f "$tmp"
}
env_default() { [ -n "$(env_get "$1")" ] || env_set "$1" "$2"; }

healthy() {
  local i
  for i in $(seq 1 60); do curl -fsS -m 5 http://127.0.0.1:4000/api/health >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}
restart_app() { systemctl restart awtad && healthy; }
must_restart() { restart_app || { journalctl -u awtad -n 40 --no-pager; die "the app did not start (log above)"; }; }
build_app() { as_app bash -c "cd '$APP' && npm ci --include=dev --no-audit --no-fund && npm run build"; }

public_ip() { curl -fsS -m 10 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true; }
points_here() { local found; found=" $(getent ahostsv4 "$1" | awk '{print $1}' | sort -u | tr '\n' ' ') "; [[ "$found" == *" $2 "* ]]; }

write_caddy() {   # بلا وسيط: http على عنوان IP للتجربة. مع دومين: https تلقائي
  local domain=${1:-} ip=${2:-}
  {
    printf '%s {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:4000\n}\n' "${domain:-:80}"
    if [ -n "$domain" ] && points_here "www.$domain" "$ip"; then printf 'www.%s {\n\tredir https://%s{uri} permanent\n}\n' "$domain" "$domain"; fi
  } > /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || die "invalid web server configuration"
}

write_units() {
  cat > /etc/systemd/system/awtad.service <<EOF
[Unit]
Description=Awtad platform
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=awtad
WorkingDirectory=$APP
EnvironmentFile=$ENVF
ExecStart=$NODE_DIR/bin/node apps/api/src/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
EOF
  cat > /etc/systemd/system/awtad-backup.service <<'EOF'
[Unit]
Description=Awtad database backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/awtad backup
EOF
  cat > /etc/systemd/system/awtad-backup.timer <<'EOF'
[Unit]
Description=Daily Awtad database backup

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
}

# ---------- database ----------
dump_local() { (cd /tmp && runuser -u postgres -- "$PGBIN/pg_dump" -p "$DB_PORT" -d awtad -n public --no-owner --no-privileges) | gzip; }
recreate_db() {
  psql_admin -c 'DROP DATABASE IF EXISTS awtad WITH (FORCE)' \
    && psql_admin -c "CREATE DATABASE awtad OWNER awtad TEMPLATE template0 ENCODING 'UTF8'"
}
load_dump() {   # الجداول تُنشأ باسم دور التطبيق؛ والاستعادة كلها في معاملة واحدة
  recreate_db && { echo 'SET ROLE awtad;'; gunzip -c "$1" | sed '/^CREATE SCHEMA public;$/d'; } | psql_admin -d awtad --single-transaction -f - >/dev/null
}
replace_data() {   # يستبدل القاعدة بملف، وعند الفشل يعيد النسخة التي أُخذت قبلها مباشرة
  local file=$1
  cmd_backup
  systemctl stop awtad
  if ! load_dump "$file"; then
    echo "Restore failed, bringing the previous data back..."
    load_dump "$LAST_BACKUP" || die "could not bring data back; the backup is at $LAST_BACKUP"
    must_restart
    die "restore failed; previous data is back"
  fi
  must_restart
}

cmd_backup() {
  install -d -m 700 "$BACKUPS"
  LAST_BACKUP="$BACKUPS/awtad-$(date +%Y%m%d-%H%M%S-%N).sql.gz"
  (umask 077; dump_local > "$LAST_BACKUP.part")
  mv "$LAST_BACKUP.part" "$LAST_BACKUP"
  ls -1t "$BACKUPS"/awtad-*.sql.gz | tail -n +15 | xargs -r rm -f   # نحتفظ بآخر 14 نسخة
  echo "Backup saved: $LAST_BACKUP"
}

cmd_restore() {
  [ -n "${1:-}" ] && [ -f "$1" ] || die "usage: sudo awtad restore <file.sql.gz>"
  local file keep
  file=$(realpath "$1")
  gzip -t "$file" || die "the file is damaged"
  keep=$(mktemp); cp "$file" "$keep"   # نسخة مؤقتة حتى لا يحذفها تدوير النسخ
  replace_data "$keep"
  rm -f "$keep"
  echo "Restored."
}

cmd_import() {
  local source dump
  local -a part
  if [ -t 0 ]; then read -rsp "Paste the source DATABASE_URL (it stays hidden): " source; echo; else read -r source; fi
  mapfile -t part < <(SOURCE="$source" "$NODE_DIR/bin/node" -e '
    const u = new URL(process.env.SOURCE.trim().replace(/^"|"$/g, ""));
    if (!/^postgres(ql)?:$/.test(u.protocol)) process.exit(1);
    // pg_dump يحتاج الاتصال المباشر في Neon لا المجمَّع
    for (const v of [u.hostname.replace("-pooler.", "."), u.port || "5432", decodeURIComponent(u.username), decodeURIComponent(u.password), decodeURIComponent(u.pathname.slice(1)), u.searchParams.get("sslmode") || "prefer"]) console.log(v);
  ' 2>/dev/null)
  [ "${#part[@]}" -eq 6 ] || die "that is not a postgresql:// address"
  dump=$(mktemp)
  echo "Copying from the source database..."
  PGHOST=${part[0]} PGPORT=${part[1]} PGUSER=${part[2]} PGPASSWORD=${part[3]} PGDATABASE=${part[4]} PGSSLMODE=${part[5]} \
    "$PGBIN/pg_dump" -n public --no-owner --no-privileges | gzip > "$dump" || die "could not read the source database; nothing changed"
  [ "$(gunzip -c "$dump" | grep -c '^CREATE TABLE public\.users ')" -ge 1 ] || die "the source has no Awtad data; nothing changed"
  replace_data "$dump"
  rm -f "$dump"
  echo "Imported. Accounts now in the database: $(psql_admin -d awtad -c 'SELECT COUNT(*) FROM users')"
}

cmd_config() {
  local key=${1:-} value
  [ -n "$key" ] && [[ " $SETTABLE " == *" $key "* ]] || die "choose one of: $SETTABLE"
  if [ -t 0 ]; then read -rsp "Value for $key (typing stays hidden): " value; echo; else read -r value; fi
  [ -n "$value" ] || die "empty value; nothing changed"
  if [ "$key" = ADMIN_PASSWORD ] && [ "${#value}" -lt 8 ]; then die "the password needs at least 8 characters"; fi
  env_set "$key" "$value"
  must_restart
  echo "$key saved."
}

cmd_domain() {
  local domain=${1:-} ip
  domain=${domain,,}
  [[ "$domain" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] || die "usage: sudo awtad domain example.com"
  ip=$(public_ip)
  if ! points_here "$domain" "$ip" && [ "${2:-}" != --force ]; then
    die "$domain does not point to this server ($ip) yet. Add an A record for it, wait a few minutes, then retry."
  fi
  write_caddy "$domain" "$ip"
  env_set APP_URL "https://$domain"
  must_restart
  systemctl restart caddy
  cat <<EOF

Done: https://$domain  (the certificate can take a minute the first time)
Remember:
  1) Firebase console > Authentication > Settings > Authorized domains: add $domain
  2) LinkedIn app > Auth > redirect URL: https://$domain/auth/linkedin/callback
EOF
}

cmd_update() {
  local old
  cmd_backup
  old=$(as_app git -C "$APP" rev-parse HEAD)
  as_app git -C "$APP" fetch --quiet origin "$BRANCH"
  as_app git -C "$APP" reset --quiet --hard "origin/$BRANCH"
  if build_app && restart_app; then
    install -m 755 "$APP/deploy/aws/awtad.sh" /usr/local/bin/awtad
    echo "Updated to $(as_app git -C "$APP" log -1 --format='%h %s')"
  else
    echo "The new version failed, going back..."
    as_app git -C "$APP" reset --quiet --hard "$old"
    build_app
    must_restart
    die "update failed; the previous version is running"
  fi
}

cmd_password() {
  if [ "${1:-}" = --raw ]; then env_get ADMIN_PASSWORD; return; fi
  echo "Admin email:    $ADMIN_EMAIL"
  echo "Admin password: $(env_get ADMIN_PASSWORD)"
  echo "To change it:   sudo awtad config ADMIN_PASSWORD   (a change made inside the website is undone on restart)"
}

cmd_status() {
  local s
  for s in awtad caddy "postgresql@$DB_PG-main" awtad-backup.timer; do printf '%-24s %s\n' "$s" "$(systemctl is-active "$s" || true)"; done
  printf '%-24s %s\n' "health" "$(curl -fsS -m 10 http://127.0.0.1:4000/api/health || echo DOWN)"
  printf '%-24s %s\n' "address" "$(env_get APP_URL)"
  printf '%-24s %s\n' "latest backup" "$(ls -1t "$BACKUPS"/awtad-*.sql.gz 2>/dev/null | sed -n 1p)"
  df -h / | tail -n 1 | awk '{print "disk used                " $5 " of " $2}'
}

cmd_init() {   # يستدعيه setup.sh فقط
  local domain=${1:-} password
  [ -f "$ENVF" ] || install -m 600 /dev/null "$ENVF"
  env_default NODE_ENV production
  env_default BIND_HOST 127.0.0.1
  env_default PORT 4000
  env_default TRUST_PROXY true
  env_default JWT_SECRET "$(openssl rand -hex 48)"
  env_default ADMIN_PASSWORD "$(openssl rand -base64 48 | tr -dc 'A-HJ-NP-Za-km-z2-9' | cut -c1-18)"

  if [ -z "$(env_get DATABASE_URL)" ]; then
    echo "==> Database"
    password=$(openssl rand -hex 24)
    if [ -z "$(psql_admin -c "SELECT 1 FROM pg_roles WHERE rolname='awtad'")" ]; then psql_admin -c 'CREATE ROLE awtad LOGIN'; fi
    printf "ALTER ROLE awtad PASSWORD '%s';\n" "$password" | psql_admin -f -
    if [ -z "$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname='awtad'")" ]; then psql_admin -c "CREATE DATABASE awtad OWNER awtad TEMPLATE template0 ENCODING 'UTF8'"; fi
    env_set DATABASE_URL "postgresql://awtad:$password@127.0.0.1:$DB_PORT/awtad"
  fi

  echo "==> Building the website (a few minutes)"
  build_app
  write_units

  echo "==> Firewall and automatic security updates"
  ufw allow 22/tcp >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades

  if [[ "$(env_get APP_URL)" != https://* ]]; then
    local ip; ip=$(public_ip)
    env_set APP_URL "http://${ip:-localhost}"
    write_caddy
  fi
  systemctl enable --quiet awtad awtad-backup.timer caddy
  must_restart
  systemctl restart awtad-backup.timer caddy
  [ -z "$domain" ] || cmd_domain "$domain"

  cat <<EOF

Awtad is running: $(env_get APP_URL)
Admin account:    run  sudo awtad password
Without a domain the site is plain http: use it for testing only.
EOF
}

main() {
  local command=${1:-}
  [ -n "$command" ] || { usage; return 0; }
  shift
  [ "$(id -u)" -eq 0 ] || die "run with sudo"
  load
  case "$command" in
    _init) cmd_init "$@" ;;
    status) cmd_status ;;
    logs) journalctl -u awtad -n "${1:-100}" --no-pager ;;
    password) cmd_password "$@" ;;
    config) cmd_config "$@" ;;
    domain) cmd_domain "$@" ;;
    update) cmd_update ;;
    backup) cmd_backup ;;
    restore) cmd_restore "$@" ;;
    import-db) cmd_import ;;
    *) usage; return 1 ;;
  esac
}
main "$@"; exit $?
