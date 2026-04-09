#!/usr/bin/env bash

set -euo pipefail

src_dir="${1:-.dagger-coverage}"
dst_dir="${2:-coverage}"

if [ ! -d "$src_dir" ]; then
  echo "Coverage source directory not found: $src_dir" >&2
  exit 1
fi

rm -rf "$dst_dir"
mkdir -p "$dst_dir"

summary_path="$(find "$src_dir" -type f -name 'coverage-summary.json' | head -n1 || true)"
final_path="$(find "$src_dir" -type f -name 'coverage-final.json' | head -n1 || true)"

if [ -z "$summary_path" ] || [ -z "$final_path" ]; then
  echo "Missing coverage JSON artifacts under $src_dir" >&2
  find "$src_dir" -maxdepth 3 -type f | sort >&2 || true
  exit 1
fi

cp "$summary_path" "$dst_dir/coverage-summary.json"
cp "$final_path" "$dst_dir/coverage-final.json"
find "$dst_dir" -maxdepth 1 -type f | sort
