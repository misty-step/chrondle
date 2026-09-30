#!/usr/bin/env bash
# One-time/update bootstrap from the exact reviewed checkout, over native host SSH.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo "Run on the native host as root" >&2; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

if [[ ! -x /opt/bun-1.4.2/bin/bun ]]; then
  temporary=$(mktemp -d /var/cache/chrondle-cd.XXXXXX)
  trap 'rm -rf -- "$temporary"' EXIT
  curl -fsSL https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64.zip -o "$temporary/bun.zip"
  printf '%s  %s\n' 36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913 "$temporary/bun.zip" | sha256sum --check --status
  python3 -m zipfile -e "$temporary/bun.zip" "$temporary"
  install -d -m 0755 /opt/bun-1.4.2/bin
  install -m 0755 "$temporary/bun-linux-x64/bun" /opt/bun-1.4.2/bin/bun
fi
[[ $(/opt/bun-1.4.2/bin/bun --version) == 1.4.2 ]]
[[ -x /opt/node-v24/bin/node ]]
[[ -f /etc/public-apps/chrondle.env ]]
[[ $(stat -c '%U:%a' /etc/public-apps/chrondle.env) == root:600 ]]
[[ -L /opt/public-apps/chrondle/current ]]

if ! id chrondle-build >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin chrondle-build
fi
install -d -m 0755 /usr/local/lib/chrondle-cd
install -m 0644 "$root/scripts/host-cd.py" /usr/local/lib/chrondle-cd/host-cd.py
install -m 0644 "$root/scripts/chrondle-cd.service" /etc/systemd/system/chrondle-cd.service
install -m 0644 "$root/scripts/chrondle-cd.timer" /etc/systemd/system/chrondle-cd.timer
systemd-analyze verify /etc/systemd/system/chrondle-cd.service /etc/systemd/system/chrondle-cd.timer
systemctl daemon-reload
systemctl enable --now chrondle-cd.timer
systemctl is-active chrondle-cd.timer
