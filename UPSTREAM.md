# Upstream synchronization

- Upstream: `https://github.com/ory/kratos-selfservice-ui-node`
- Initial VKWAVE base: `08f0184`
- Product branch: `master`
- Example first sync branch: `codex/sync-upstream-08f0184`

Every sync PR records old/new upstream revisions, retained VKWAVE patches,
conflicts, security changes, and browser-flow results. Public history is not
rewritten.

## 2026-07-26 dependency-security synchronization

- Upstream repository: `https://github.com/ory/kratos-selfservice-ui-node`
- Audited upstream commit: `a9790ee9530fcfb0a6e63045fa2668e91eea3410`
- Upstream commit subject:
  `chore(deps): resolve open Dependabot security alerts`
- Upstream files changed: `package.json`, `package-lock.json`
- VKWAVE implementation commit: `94bab5a3818cf7a6bada3463944c120289fb4ff2`
- VKWAVE pull request:
  `https://github.com/vkwave/kratos-selfservice-ui-node/pull/2`
- Synchronization date: `2026-07-26`

The audited upstream security state updates Axios from `1.16.1` to `1.18.1` and
body-parser from `1.20.4` to `1.20.6`, retains the `qs` override at `6.15.2` and
the `form-data` override at `>=4.0.6`, adds the `brace-expansion@1` override at
`1.1.16`, and originally adds the `brace-expansion@5` override at `5.0.7`.

After that upstream commit was published, live advisory `GHSA-mh99-v99m-4gvg`
classified `brace-expansion <=5.0.7` as HIGH severity. The fork therefore layers
the smallest follow-up over the exact upstream provenance by changing only the
major-5 override and its generated lock entry from `5.0.7` to `5.0.8`. The
canonical package hashes are:

- `package.json` SHA-256:
  `03923e368d8e5e72237f114d84c8db9fa11ee2a31fd6fd1642613d4c7cf06b79`
- `package-lock.json` SHA-256:
  `66dc5ffe533af315e8bf231e529ab972a3d648675ed8996543b75989df6c626a`

Conflict resolution: the upstream package and lockfile security delta was
reproduced directly on fixed VKWAVE base
`5c23a2e85bf9cc0066e03030a00d8184f695b855`; there were no textual conflicts.
Fork-specific tests, build constraints, runtime behavior, and public history
were preserved, and no unrelated upstream commit or dependency drift was
included.
