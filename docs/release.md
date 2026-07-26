# Self-service releases

Releases are immutable, tag-triggered GitHub Actions runs. The workflow pushes
an unaliased digest for scanning, then creates the release tag alias only after
the reviewed source, vulnerability scan, SPDX SBOM, source provenance, release
provenance, and keyless signature checks complete.

## Create a release tag

Run these commands from a clean checkout of the reviewed commit. Replace the
example tag and source SHA with the next approved release values. The commands
do not contain credentials; `docker login` prompts for them interactively.

```sh
set -eu
export IMAGE=ghcr.io/vkwave/kratos-selfservice-ui-node
export RELEASE_TAG=0.23.10-vkwave.1
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

Use the same isolated Docker configuration to inspect the immutable digest and
verify the GitHub OIDC identity. Set `DIGEST` to the digest printed by the
workflow run.

```sh
set -eu
export IMAGE=ghcr.io/vkwave/kratos-selfservice-ui-node
export RELEASE_TAG=0.23.10-vkwave.1
export DIGEST=sha256:<workflow-digest>
export WORKFLOW_IDENTITY="https://github.com/vkwave/kratos-selfservice-ui-node/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}"
export OIDC_ISSUER=https://token.actions.githubusercontent.com
export DOCKER_CONFIG=$(mktemp -d)
chmod 700 "$DOCKER_CONFIG"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT HUP INT TERM
docker login ghcr.io

docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}"
test "$(docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}" --format '{{.Manifest.Digest}}')" = "$DIGEST"
cosign verify \
  --certificate-identity "$WORKFLOW_IDENTITY" \
  --certificate-oidc-issuer "$OIDC_ISSUER" \
  "${IMAGE}@${DIGEST}"
cosign verify-attestation \
  --type https://vkwave.com/attestations/source-provenance/v1 \
  --certificate-identity "$WORKFLOW_IDENTITY" \
  --certificate-oidc-issuer "$OIDC_ISSUER" \
  "${IMAGE}@${DIGEST}"
cosign verify-attestation \
  --type https://vkwave.com/attestations/release/v1 \
  --certificate-identity "$WORKFLOW_IDENTITY" \
  --certificate-oidc-issuer "$OIDC_ISSUER" \
  "${IMAGE}@${DIGEST}"
cosign verify-attestation \
  --type spdxjson \
  --certificate-identity "$WORKFLOW_IDENTITY" \
  --certificate-oidc-issuer "$OIDC_ISSUER" \
  "${IMAGE}@${DIGEST}"
```

The tag alias and digest must remain unchanged after verification. A failed
workflow, an existing alias, or any verification mismatch is a release stop.
