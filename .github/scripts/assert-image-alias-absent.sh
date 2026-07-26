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
else
  inspect_status=$?
fi
test "$inspect_status" -eq 1
cr=$(printf '\r')
normalized_stderr=$(perl -0pe 's/\r\n/\n/g' "$tmp/err")
case "$normalized_stderr" in
  *"$cr"*) exit 1 ;;
esac
normalized_stderr=$(printf '%s' "$normalized_stderr" |
  sed -e 's/[[:space:]]*$//' -e '/^[[:space:]]*$/d')
test "$normalized_stderr" = "ERROR: ${image_alias}: not found"
diagnostic=${normalized_stderr#"ERROR: ${image_alias}: "}
test "$diagnostic" = "not found"
! printf '%s\n' "$diagnostic" |
  grep -Eiq 'unauthorized|unauthenticated|authentication|authorization|denied|forbidden|permission|too many requests|rate.?limit|timeout|TLS|connection|network|no such host|name resolution|(^|[^0-9])(401|403|429|5[0-9][0-9])([^0-9]|$)|(^|[^[:alpha:]])EOF([^[:alpha:]]|$)|cancel(l)?ed|context[ -]canceled|service unavailable|internal( server)? error'
