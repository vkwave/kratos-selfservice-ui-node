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

## 2026-09-10 dependency-security synchronization

- Upstream repository: `https://github.com/ory/kratos-selfservice-ui-node`
- Audited upstream commit: `dcb01111a2858ef921c0e37cb7f38219b73c0ebd`
- Upstream commit subject:
  `chore: patch brace-expansion, tar, and postcss in frontend images`
- Upstream files changed: `package.json`, `package-lock.json`
- VKWAVE pull request:
  `https://github.com/vkwave/kratos-selfservice-ui-node/pull/6`
- Synchronization date: `2026-09-10`

Despite the upstream commit subject, the audited delta contains no `tar` or
`postcss` changes: it replaces the targeted `brace-expansion@1` and
`brace-expansion@5` overrides with a single unscoped `brace-expansion` override
pinned at `5.0.8`, collapsing the transitive brace-expansion@1 subtree
(`balanced-match`, `concat-map`,
`read-package-json/node_modules/brace-expansion`) out of the lockfile. The `qs`
override at `6.15.2`, the `form-data` override at `>=4.0.6`, and the
`express-winston` `lodash` override are retained unchanged.

The canonical package hashes for the synced state are:

- `package.json` SHA-256:
  `c38a1791640b4587c0321f4a13d324a696a4576824e94b73ee83e98d04fc43c0`
- `package-lock.json` SHA-256:
  `0076a4f9e35d18da80a9d00661bdb7a963220fd00f8f728b6d7f59ccb7baddbc`

Conflict resolution: the upstream override consolidation was reproduced directly
on the VKWAVE base, which already carried `brace-expansion@5` at `5.0.8` from
the `GHSA-mh99-v99m-4gvg` follow-up; the package lockfile was regenerated
against the consolidated override with no unrelated dependency drift, and the
release contract test was updated to assert the consolidated override and the
new canonical hashes. Fork-specific tests, build constraints, runtime behavior,
and public history were preserved.
