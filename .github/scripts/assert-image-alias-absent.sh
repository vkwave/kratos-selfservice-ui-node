#!/bin/sh
set -eu
test "$#" -eq 1
: "${DOCKER_CONFIG:?isolated DOCKER_CONFIG is required}"
test -d "$DOCKER_CONFIG" && test ! -L "$DOCKER_CONFIG"
test "$(stat -c '%a' "$DOCKER_CONFIG")" = 700
test -s "$DOCKER_CONFIG/config.json"
image_alias=$1
printf '%s' "$image_alias" | grep -Eq '^ghcr\.io/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+:[A-Za-z0-9._-]+$'
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
if docker buildx imagetools inspect "$image_alias" >"$tmp/out" 2>"$tmp/err"; then
  echo "release image alias already exists" >&2
  exit 1
fi
grep -Eiq 'manifest unknown|manifest[^[:alnum:]]+(is )?not found' "$tmp/err" || exit 1
! grep -Eiq 'unauthorized|denied|forbidden|too many requests|rate.?limit|timeout|TLS|connection|network|no such host|name resolution|(^|[^0-9])(401|403|429)([^0-9]|$)' "$tmp/err"
