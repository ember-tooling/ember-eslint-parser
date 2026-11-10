#!/usr/bin/env bash
# Builds typescript-eslint from typescript-eslint/typescript-eslint#13174
# and packs each package that eslint loads into the directory given as $1.
# #13174 adds projectService.EXPERIMENTAL_runExternalCode to the experimental
# tsgo backend from #12803. Neither is released yet.
#
# test-projects/gts-ts7 installs these tarballs; see
# scripts/use-typescript-eslint-tarballs.mjs.
#
# Override the source with TSESLINT_REPO and TSESLINT_REF (a commit SHA).
set -euo pipefail

out_dir="$1"
repo="${TSESLINT_REPO:-https://github.com/JoshuaKGoldberg/typescript-eslint.git}"
ref="${TSESLINT_REF:-0c7e38343e8485326de21f2314d3d0a4e34a5c23}"
packages=(
  types
  visitor-keys
  typescript-estree
  tsconfig-utils
  project-service
  scope-manager
  utils
  type-utils
  parser
  eslint-plugin
  typescript-eslint
)

mkdir -p "$out_dir"
out_dir="$(cd "$out_dir" && pwd)"
work="$(mktemp -d)"

git -C "$work" init -q
git -C "$work" remote add origin "$repo"
git -C "$work" fetch -q --depth 1 origin "$ref"
git -C "$work" checkout -q FETCH_HEAD

# tsgo runs a tsconfig's contentMappers only when its API process is spawned
# with runExternalCode.
# typescript-eslint#13174 adds projectService.EXPERIMENTAL_runExternalCode for it.
# Refs without that option get runExternalCode turned on unconditionally.
service="$work/packages/typescript-estree/src/native/createNativeProjectService.ts"
if ! grep -q 'runExternalCode' "$service"; then
  sed -i.bak 's/new API({ cwd })/new API({ cwd, runExternalCode: true })/' "$service"
  if ! grep -q 'runExternalCode: true' "$service"; then
    echo "Could not add runExternalCode to $service. Update this script." >&2
    exit 1
  fi
fi

cd "$work"
pnpm install --frozen-lockfile --ignore-scripts
projects="$(IFS=,; echo "${packages[*]}")"
pnpm exec nx run-many -t build --projects="$projects"

for package in "${packages[@]}"; do
  (cd "packages/$package" && pnpm pack --pack-destination "$out_dir" >/dev/null)
done

ls "$out_dir"
