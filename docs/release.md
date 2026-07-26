# Self-service releases

Releases are immutable, tag-triggered GitHub Actions runs. The workflow pushes
an unaliased digest for scanning, then creates the release tag alias only after
the reviewed source, vulnerability scan, SPDX SBOM, source provenance, release
provenance, and keyless signature checks complete.

## Create a release tag

Run these commands from a clean checkout of the reviewed commit after setting
`IMAGE` to `ghcr.io/vkwave/kratos-selfservice-ui-node` and `RELEASE_TAG` to the
next approved release tag. Enter the independently reviewed source commit when
prompted. The commands do not contain credentials; `docker login` prompts for
them interactively.

```sh
set -eu
printf 'Approved source SHA: ' >&2
IFS= read -r SOURCE_SHA
export SOURCE_SHA
printf '%s\n' "$SOURCE_SHA" | grep -Eq '^[0-9a-f]{40}$'
git fetch origin master --tags
test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
git merge-base --is-ancestor "$SOURCE_SHA" origin/master
printf '%s\n' "$RELEASE_TAG" | grep -Eq '^0\.23\.10-vkwave\.[0-9]+$'
! git show-ref --verify --quiet "refs/tags/$RELEASE_TAG"
test -z "$(git ls-remote --tags origin "refs/tags/$RELEASE_TAG")"
export DOCKER_CONFIG=$(mktemp -d)
chmod 700 "$DOCKER_CONFIG"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT HUP INT TERM
docker login ghcr.io
.github/scripts/assert-image-alias-absent.sh "${IMAGE}:${RELEASE_TAG}"
git tag -s "$RELEASE_TAG" "$SOURCE_SHA" -m "Release $RELEASE_TAG"
git push origin "refs/tags/$RELEASE_TAG"
```

The tag push starts the `release-selfservice-ui` workflow. Do not create a tag
until both the reviewed-source ancestry check and the image-alias refusal pass.

## Verify a completed release

After setting `IMAGE` and `RELEASE_TAG` to the completed release values, use an
independent isolated Docker configuration to inspect the immutable digest and
verify the GitHub OIDC identity. Enter the digest copied from the completed
workflow output when prompted.

```sh
set -eu
printf 'Workflow image digest: ' >&2
IFS= read -r DIGEST
export DIGEST
printf '%s\n' "$DIGEST" | grep -Eq '^sha256:[0-9a-f]{64}$'
export DOCKER_CONFIG=$(mktemp -d)
chmod 700 "$DOCKER_CONFIG"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT HUP INT TERM
docker login ghcr.io
docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}"
test "$(docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}" --format '{{.Manifest.Digest}}')" = "$DIGEST"
cosign verify \
  --certificate-identity "https://github.com/vkwave/kratos-selfservice-ui-node/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "${IMAGE}@${DIGEST}"
cosign verify-attestation \
  --certificate-identity "https://github.com/vkwave/kratos-selfservice-ui-node/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --type https://vkwave.com/attestations/source-provenance/v1 \
  "${IMAGE}@${DIGEST}"
cosign verify-attestation \
  --certificate-identity "https://github.com/vkwave/kratos-selfservice-ui-node/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --type https://vkwave.com/attestations/release/v1 \
  "${IMAGE}@${DIGEST}"
cosign verify-attestation \
  --certificate-identity "https://github.com/vkwave/kratos-selfservice-ui-node/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --type spdxjson \
  "${IMAGE}@${DIGEST}"
```

The tag alias and digest must remain unchanged after verification. A failed
workflow, an existing alias, or any verification mismatch is a release stop.
