#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "chrondle: usage: scripts/dagger-local.sh <dagger args>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COLIMA_PROFILE="${CHRONDLE_COLIMA_PROFILE:-default}"

docker_cli_healthy() {
  command -v docker >/dev/null 2>&1 || return 1
  docker version --format '{{json .Client.Version}}' >/dev/null 2>&1
}

colima_cli_healthy() {
  command -v colima >/dev/null 2>&1 || return 1
  colima status --profile "${COLIMA_PROFILE}" >/dev/null 2>&1
}

run_with_colima_wrapper() {
  local colima_bin
  local tmp_dir

  colima_bin="$(command -v colima)"
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' EXIT

  cat >"${tmp_dir}/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "${colima_bin}" --profile "${COLIMA_PROFILE}" ssh -- docker "\$@"
EOF

  chmod +x "${tmp_dir}/docker"

  echo "chrondle: using Colima profile '${COLIMA_PROFILE}' for local Dagger." >&2
  cd "${REPO_ROOT}"
  PATH="${tmp_dir}:${PATH}" exec dagger "$@"
}

cd "${REPO_ROOT}"

if ! command -v dagger >/dev/null 2>&1; then
  echo "chrondle: dagger CLI is required for local CI. Install dagger first." >&2
  exit 1
fi

if [ "${CHRONDLE_DAGGER_FORCE_DOCKER:-0}" = "1" ]; then
  if docker_cli_healthy; then
    exec dagger "$@"
  fi

  echo "chrondle: CHRONDLE_DAGGER_FORCE_DOCKER=1 but the Docker CLI is not healthy." >&2
  exit 1
fi

if colima_cli_healthy; then
  run_with_colima_wrapper "$@"
fi

if docker_cli_healthy; then
  exec dagger "$@"
fi

echo "chrondle: local Dagger requires a running Colima profile '${COLIMA_PROFILE}' or a healthy Docker CLI." >&2
echo "chrondle: start Colima with 'colima start --profile ${COLIMA_PROFILE}'." >&2
exit 1
