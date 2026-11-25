#!/usr/bin/env bash
# أوتاد على خادم Ubuntu (مثل Amazon Lightsail): Node + PostgreSQL + Caddy (https تلقائي) + نسخ احتياطي يومي.
# آمن لإعادة التشغيل: لا يغيّر الأسرار ولا البيانات الموجودة.
#   sudo bash setup.sh                 تثبيت ويعمل على عنوان IP للتجربة
#   sudo bash setup.sh example.com     مع دومين موجّه إلى الخادم
main() {
  set -euo pipefail
  [ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash setup.sh"; exit 1; }
  export DEBIAN_FRONTEND=noninteractive
  local domain=${1:-} repo=${AWTAD_REPO:-https://github.com/bassam1x/awtad.git} branch=${AWTAD_BRANCH:-main} pg=${AWTAD_PG:-18}
  local app=/opt/awtad/app node_dir=/usr/local/lib/awtad-node
  say() { printf '\n==> %s\n' "$*"; }
  apt() { command apt-get -o DPkg::Lock::Timeout=600 -yq "$@"; }   # قد يكون النظام يثبّت تحديثاته عند أول إقلاع
  cd /tmp

  say "Memory (swap for small servers)"
  if [ -z "$(swapon --show --noheadings)" ] && [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 3500000 ]; then
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi

  say "System packages"
  apt update
  apt install ca-certificates curl git openssl xz-utils gnupg ufw unattended-upgrades postgresql-common debian-keyring debian-archive-keyring apt-transport-https

  say "PostgreSQL $pg"
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
  apt install "postgresql-$pg" "postgresql-client-$pg"
  local port
  port=$(pg_lsclusters -h | awk -v v="$pg" '$1==v && $2=="main"{print $3}')
  if [ -z "$port" ]; then pg_createcluster "$pg" main; port=$(pg_lsclusters -h | awk -v v="$pg" '$1==v && $2=="main"{print $3}'); fi
  systemctl enable --quiet postgresql
  systemctl start "postgresql@$pg-main"

  say "Node.js 22 (official build, checksum verified)"
  if ! "$node_dir/bin/node" -v 2>/dev/null | grep '^v22\.' >/dev/null; then
    local arch tmp file base=https://nodejs.org/dist/latest-v22.x
    case "$(dpkg --print-architecture)" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) echo "Unsupported CPU"; exit 1 ;; esac
    tmp=$(mktemp -d)
    curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
    file=$(awk -v s="linux-$arch.tar.xz" 'index($2, s) {print $2}' "$tmp/SHASUMS256.txt")
    curl -fsSL "$base/$file" -o "$tmp/$file"
    (cd "$tmp" && grep -F "  $file" SHASUMS256.txt | sha256sum -c -)
    rm -rf "$node_dir" && mkdir -p "$node_dir"
    tar -xJf "$tmp/$file" -C "$node_dir" --strip-components=1
    rm -rf "$tmp"
  fi

  say "Caddy (web server with automatic https)"
  if ! command -v caddy >/dev/null; then
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
    chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install caddy
  fi

  say "Application code"
  id awtad >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/awtad --shell /usr/sbin/nologin awtad
  chmod 755 /opt/awtad
  [ -d "$app/.git" ] || runuser -u awtad -- git clone --quiet --branch "$branch" "$repo" "$app"

  install -d -m 755 /etc/awtad
  printf 'DB_PG=%s\nDB_PORT=%s\nBRANCH=%s\n' "$pg" "$port" "$branch" > /etc/awtad/server.conf
  install -m 755 "$app/deploy/aws/awtad.sh" /usr/local/bin/awtad
  /usr/local/bin/awtad _init "$domain"
}
main "$@"
