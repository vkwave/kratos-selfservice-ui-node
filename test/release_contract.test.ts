import { spawnSync, type SpawnSyncReturns } from "child_process"
import { createHash } from "crypto"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs"
import { tmpdir } from "os"
import { join, resolve } from "path"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

const read = (path: string): string => readFileSync(path, "utf8")
const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")

type Step = { uses?: string; run?: string; with?: Record<string, unknown> }
type Job = {
  needs?: string | string[]
  permissions?: Record<string, string>
  env?: Record<string, unknown>
  steps?: Step[]
}

type AliasCheckOptions = {
  args?: string[]
  dockerExit?: number
  dockerStderr?: string
  dockerStdout?: string
}

const runAliasCheck = ({
  args = ["ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1"],
  dockerExit = 1,
  dockerStderr = "",
  dockerStdout = "",
}: AliasCheckOptions = {}): SpawnSyncReturns<string> => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "release-alias-check-"))
  const binDirectory = join(temporaryRoot, "bin")
  const dockerConfig = join(temporaryRoot, "docker-config")
  mkdirSync(binDirectory)
  mkdirSync(dockerConfig, { mode: 0o700 })
  chmodSync(dockerConfig, 0o700)
  writeFileSync(join(dockerConfig, "config.json"), "{}\n")

  const docker = join(binDirectory, "docker")
  writeFileSync(
    docker,
    `#!/bin/sh
printf '%s' "\${MOCK_DOCKER_STDOUT:-}"
printf '%s' "\${MOCK_DOCKER_STDERR:-}" >&2
exit "\${MOCK_DOCKER_EXIT:-1}"
`,
  )
  chmodSync(docker, 0o755)

  try {
    return spawnSync(
      resolve(".github/scripts/assert-image-alias-absent.sh"),
      args,
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_CONFIG: dockerConfig,
          MOCK_DOCKER_EXIT: String(dockerExit),
          MOCK_DOCKER_STDERR: dockerStderr,
          MOCK_DOCKER_STDOUT: dockerStdout,
          PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
        },
      },
    )
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true })
  }
}

const expectAliasRefused = (result: SpawnSyncReturns<string>): void => {
  expect(result.error).toBeUndefined()
  expect(result.status).not.toBe(0)
}

describe("release contract", () => {
  it("builds a pinned three-stage non-root image", () => {
    const dockerfile = read("Dockerfile")
    const pinnedBase =
      /FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2/g

    expect(dockerfile.match(pinnedBase)).toHaveLength(3)
    expect(dockerfile).toContain("USER 10001:10001")
    expect(dockerfile).toContain("HEALTHCHECK")
    expect(dockerfile).toContain("TLS_CERT_PATH")
    expect(dockerfile).toContain("TLS_KEY_PATH")
    expect(dockerfile).toContain("https://127.0.0.1:3000/health/alive")
    expect(dockerfile).toContain('CMD ["node", "lib/index.js"]')
    expect(dockerfile).toContain("ARG LINK=no")
    expect(dockerfile).toContain("node_modules/@ory/client")
  })

  it("pins the workflow parser dependency and registry integrity", () => {
    const pkg = JSON.parse(read("package.json"))
    const lock = JSON.parse(read("package-lock.json"))

    expect(pkg.devDependencies.yaml).toBe("2.9.0")
    expect(lock.packages["node_modules/yaml"]).toMatchObject({
      dev: true,
      integrity:
        "sha512-2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA==",
      resolved: "https://registry.npmjs.org/yaml/-/yaml-2.9.0.tgz",
      version: "2.9.0",
    })
    expect(parse("version: 2.9.0")).toEqual({ version: "2.9.0" })
  })

  it("separates unprivileged verification from fail-closed publication", () => {
    const ci = read(".github/workflows/ci.yml")
    const format = read(".github/workflows/format.yml")
    const release = read(".github/workflows/release.yml")
    const document = parse(release) as { jobs: Record<string, Job> }
    const verify = document.jobs.verify
    const publish = document.jobs.publish

    for (const command of [
      "npm ci",
      "npm test",
      "npm run format:check",
      "npm run build",
      "docker build -t selfservice-ui:test .",
    ]) {
      expect(ci).toContain(command)
    }
    expect(release).toContain("0.23.10-vkwave.*")

    expect(verify).toBeDefined()
    expect(publish).toBeDefined()
    expect(publish.needs).toBe("verify")
    expect(verify.permissions).toEqual({ contents: "read" })
    expect(publish.permissions).toEqual({
      contents: "read",
      packages: "write",
      "id-token": "write",
    })
    expect(publish.env?.DOCKER_CONFIG).toBeUndefined()
    const dockerConfigInitialization = (publish.steps ?? []).find((step) =>
      (step.run ?? "").includes('install -d -m 0700 "$DOCKER_CONFIG"'),
    )
    expect(dockerConfigInitialization?.run).toContain(
      'DOCKER_CONFIG="${RUNNER_TEMP}/docker-config"',
    )
    expect(dockerConfigInitialization?.run).toContain('>> "$GITHUB_ENV"')

    const uses = [...(verify.steps ?? []), ...(publish.steps ?? [])].flatMap(
      (step) => (step.uses ? [step.uses] : []),
    )
    for (const action of uses) expect(action).toMatch(/^[^@]+@[0-9a-f]{40}$/)
    expect(uses).toEqual(
      expect.arrayContaining([
        "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
        "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
        "docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9",
        "docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f",
        "docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8",
        "anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
        "sigstore/cosign-installer@398d4b0eeef1380460a10c8013a76f728fb906ac",
      ]),
    )
    expect(
      (publish.steps ?? []).some((step) =>
        step.uses?.startsWith("actions/setup-node@"),
      ),
    ).toBe(false)
    expect(
      (publish.steps ?? []).some((step) => step.with?.cache === "npm"),
    ).toBe(false)

    const publishSteps = publish.steps ?? []
    const commands = publishSteps
      .flatMap((step) => (step.run ?? "").split("\n"))
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"))
    const index = (pattern: RegExp): number =>
      commands.findIndex((line) => pattern.test(line))
    expect(index(/git fetch origin master --no-tags/)).toBeGreaterThanOrEqual(0)
    expect(
      index(/git merge-base --is-ancestor HEAD origin\/master/),
    ).toBeGreaterThanOrEqual(0)
    expect(index(/git rev-list -n 1 .*RELEASE_TAG/)).toBeGreaterThanOrEqual(0)
    expect(
      index(/docker buildx imagetools inspect .*RELEASE_TAG/),
    ).toBeGreaterThanOrEqual(0)

    const stepIndex = (predicate: (step: Step) => boolean): number =>
      publishSteps.findIndex(predicate)
    const pushIndex = stepIndex((step) =>
      Object.values(step.with ?? {}).some((value) =>
        String(value).includes("push-by-digest=true"),
      ),
    )
    const scanIndex = stepIndex((step) =>
      /trivy[\s\S]*CRITICAL,HIGH/.test(step.run ?? ""),
    )
    const recordIndex = stepIndex((step) =>
      /release-provenance\.json/.test(step.run ?? ""),
    )
    const provenanceIndex = stepIndex((step) =>
      (step.run ?? "").includes(
        "https://vkwave.com/attestations/source-provenance/v1",
      ),
    )
    const sbomAttestIndex = stepIndex((step) =>
      (step.run ?? "").includes("cosign attest --yes --type spdxjson"),
    )
    const releaseAttestIndex = stepIndex((step) =>
      (step.run ?? "").includes("https://vkwave.com/attestations/release/v1"),
    )
    const signIndex = stepIndex((step) =>
      /cosign sign --yes/.test(step.run ?? ""),
    )
    const aliasIndex = stepIndex((step) =>
      /imagetools create --tag[\s\S]*RELEASE_TAG/.test(step.run ?? ""),
    )
    const configInitIndex = stepIndex((step) =>
      (step.run ?? "").includes('install -d -m 0700 "$DOCKER_CONFIG"'),
    )
    const loginIndex = stepIndex(
      (step) =>
        step.uses ===
        "docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9",
    )
    expect(configInitIndex).toBeGreaterThanOrEqual(0)
    expect(loginIndex).toBeGreaterThan(configInitIndex)
    expect(pushIndex).toBeGreaterThan(loginIndex)
    expect(pushIndex).toBeGreaterThanOrEqual(0)
    expect(scanIndex).toBeGreaterThan(pushIndex)
    expect(recordIndex).toBeGreaterThan(scanIndex)
    expect(provenanceIndex).toBeGreaterThan(scanIndex)
    expect(sbomAttestIndex).toBeGreaterThan(scanIndex)
    expect(releaseAttestIndex).toBeGreaterThan(recordIndex)
    expect(signIndex).toBeGreaterThan(recordIndex)
    expect(signIndex).toBeGreaterThan(provenanceIndex)
    expect(signIndex).toBeGreaterThan(sbomAttestIndex)
    expect(signIndex).toBeGreaterThan(releaseAttestIndex)
    expect(aliasIndex).toBeGreaterThan(signIndex)

    const aliasChecks = publishSteps.flatMap((step, stepIndex) =>
      (step.run ?? "").includes(".github/scripts/assert-image-alias-absent.sh")
        ? [stepIndex]
        : [],
    )
    expect(aliasChecks).toHaveLength(2)
    expect(aliasChecks[0]).toBeGreaterThan(loginIndex)
    expect(aliasChecks[0]).toBeLessThan(pushIndex)
    expect(aliasChecks[1]).toBeGreaterThan(signIndex)
    expect(aliasChecks[1]).toBeLessThan(aliasIndex)

    expect(format).toContain("actions/setup-node@v5")
    expect(format).toContain("npm run format:check")
    expect(format).not.toContain("actions/setup-go")
  })

  it("allows only a registry manifest-not-found result for a new alias", () => {
    for (const dockerStderr of [
      "manifest unknown: manifest unknown",
      "manifest is not found",
    ]) {
      const result = runAliasCheck({ dockerStderr })
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
    }
  })

  it("refuses an existing release image alias", () => {
    const result = runAliasCheck({
      dockerExit: 0,
      dockerStdout: "Name: ghcr.io/vkwave/kratos-selfservice-ui-node",
    })

    expectAliasRefused(result)
    expect(result.stderr).toContain("release image alias already exists")
  })

  it("fails closed on registry authentication, authorization, rate-limit, and network errors", () => {
    for (const dockerStderr of [
      "manifest unknown: unauthorized: authentication required",
      "manifest unknown: denied: permission_denied",
      "manifest unknown: too many requests: rate limit exceeded",
      "manifest unknown: TLS handshake timeout",
      "manifest unknown: dial tcp: no such host",
    ]) {
      expectAliasRefused(runAliasCheck({ dockerStderr }))
    }
  })

  it("fails closed on malformed arguments and ambiguous registry errors", () => {
    expectAliasRefused(runAliasCheck({ args: [] }))
    expectAliasRefused(runAliasCheck({ args: ["not-an-image-alias"] }))
    expectAliasRefused(
      runAliasCheck({ dockerStderr: "unexpected registry response" }),
    )
  })

  it("documents strict production variables and forbids runtime overlays", () => {
    const docs = `${read("README.md")}\n${read("SECURITY-PRODUCTION.md")}`

    for (const variable of [
      "KRATOS_PUBLIC_URL",
      "KRATOS_BROWSER_URL",
      "HYDRA_ADMIN_URL",
      "COOKIE_SECRET",
      "CSRF_COOKIE_NAME",
      "CSRF_COOKIE_SECRET",
      "AUTH_UI_ALLOW_INSECURE_DEV",
    ]) {
      expect(docs).toContain(variable)
    }
    expect(docs).toMatch(/must not replace.*public\/.*views\/.*lib\//is)
    expect(docs).toMatch(/whenever their corresponding token\s+type is issued/)
    expect(docs).not.toContain("DANGEROUSLY_DISABLE_SECURE_CSRF_COOKIES")
  })

  it("contains the audited upstream security versions and live advisory follow-up", () => {
    const pkg = JSON.parse(read("package.json"))
    const lock = JSON.parse(read("package-lock.json"))
    const major5BraceEntries = Object.entries(lock.packages).filter(
      ([path, metadata]) =>
        /(^|\/)node_modules\/brace-expansion$/.test(path) &&
        typeof metadata.version === "string" &&
        metadata.version.startsWith("5."),
    )

    expect(pkg.dependencies.axios).toBe("1.18.1")
    expect(pkg.dependencies["body-parser"]).toBe("1.20.6")
    expect(pkg.overrides.qs).toBe("6.15.2")
    expect(pkg.overrides["brace-expansion@1"]).toBe("1.1.16")
    expect(pkg.overrides["brace-expansion@5"]).toBe("5.0.8")
    expect(pkg.overrides["brace-expansion@5"]).not.toBe("5.0.7")
    expect(major5BraceEntries.length).toBeGreaterThanOrEqual(1)
    for (const [path, metadata] of major5BraceEntries) {
      expect(metadata.version, path).toBe("5.0.8")
      expect(metadata.version, path).not.toBe("5.0.7")
    }
    expect(sha256("package.json")).toBe(
      "6a76467f00ecca1a6bac4d49aeb30c764a1029d32522d81748586c0300051402",
    )
    expect(sha256("package-lock.json")).toBe(
      "1c50eb05de5750f141c75b48e2a351572358f77ec27f255788408700252ece9e",
    )
  })

  it("preserves unrelated direct dependencies and overrides", () => {
    const pkg = JSON.parse(read("package.json"))
    const unrelatedDependencies = Object.fromEntries(
      Object.entries(pkg.dependencies).filter(
        ([name]) => !["axios", "body-parser"].includes(name),
      ),
    )
    const unrelatedOverrides = Object.fromEntries(
      Object.entries(pkg.overrides).filter(
        ([name]) => !["brace-expansion@1", "brace-expansion@5"].includes(name),
      ),
    )

    expect(unrelatedDependencies).toEqual({
      "@ory/client": "1.22.37",
      "@ory/elements-markup": "0.9.0",
      "@redtea/format-axios-error": "2.1.1",
      "accept-language-parser": "1.5.0",
      "cookie-parser": "1.4.7",
      "csrf-csrf": "3.0.1",
      express: "4.22.1",
      "express-handlebars": "8.0.7",
      "express-jwt": "8.4.1",
      "express-winston": "4.2.0",
      "jwks-rsa": "3.0.1",
      winston: "3.19.0",
    })
    expect(unrelatedOverrides).toEqual({
      "express-winston": {
        lodash: "4.18.1",
      },
      qs: "6.15.2",
      "form-data": ">=4.0.6",
    })
  })
})
