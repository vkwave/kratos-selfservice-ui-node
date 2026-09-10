import { spawnSync, type SpawnSyncReturns } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

const read = (path: string): string => readFileSync(path, "utf8")
const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")

type Step = {
  env?: Record<string, unknown>
  uses?: string
  run?: string
  with?: Record<string, unknown>
}
type Job = {
  needs?: string | string[]
  permissions?: Record<string, string>
  env?: Record<string, unknown>
  steps?: Step[]
}

type Workflow = {
  concurrency?: {
    group?: string
    "cancel-in-progress"?: boolean
  }
  jobs: Record<string, Job>
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

const runDigestValidation = (
  script: string,
  imageDigest: string,
): SpawnSyncReturns<string> =>
  spawnSync("sh", ["-eu", "-c", script], {
    encoding: "utf8",
    env: { ...process.env, IMAGE_DIGEST: imageDigest },
  })

const executableLines = (run: string): string[] =>
  run
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))

const fencedShellBlock = (markdown: string, heading: string): string => {
  const lines = markdown.split("\n")
  const headingLine = `## ${heading}`
  const headingIndexes = lines.flatMap((line, index) =>
    line === headingLine ? [index] : [],
  )
  expect(headingIndexes).toHaveLength(1)
  const sectionStart =
    lines.slice(0, headingIndexes[0] + 1).join("\n").length + 1
  const nextHeading = markdown.indexOf("\n## ", sectionStart)
  const section = markdown.slice(
    sectionStart,
    nextHeading === -1 ? markdown.length : nextHeading,
  )
  const fence = "`".repeat(3)
  const blocks = [
    ...section.matchAll(
      new RegExp(fence + "(?:sh|bash)\\n([\\s\\S]*?)\\n" + fence, "g"),
    ),
  ]
  expect(blocks).toHaveLength(1)
  return blocks[0][1]
}

const expectExactExecutableCommandSequence = (
  commands: string[],
  expected: string[],
): void => {
  expect(commands).toEqual(expected)
}

const insertExecutableCommandAfter = (
  commands: string[],
  precedingCommand: string,
  insertedCommand: string,
): string[] => {
  const precedingIndex = commands.indexOf(precedingCommand)
  if (precedingIndex === -1) {
    throw new Error(`missing insertion point: ${precedingCommand}`)
  }
  return [
    ...commands.slice(0, precedingIndex + 1),
    insertedCommand,
    ...commands.slice(precedingIndex + 1),
  ]
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
    const document = parse(release) as Workflow
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

    expect(document.concurrency).toEqual({
      group: "release-${{ github.ref }}",
      "cancel-in-progress": false,
    })

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
    const dockerConfigCommands = executableLines(
      dockerConfigInitialization?.run ?? "",
    )
    const dockerConfigCommandIndex = (pattern: RegExp): number =>
      dockerConfigCommands.findIndex((line) => pattern.test(line))
    const dockerConfigAssignmentIndex = dockerConfigCommandIndex(
      /^DOCKER_CONFIG="\$\{RUNNER_TEMP\}\/docker-config"$/,
    )
    const dockerConfigInstallIndex = dockerConfigCommandIndex(
      /^install -d -m 0700 "\$DOCKER_CONFIG"$/,
    )
    const dockerConfigExportIndex = dockerConfigCommandIndex(
      /^printf 'DOCKER_CONFIG=%s\\n' "\$DOCKER_CONFIG" >> "\$GITHUB_ENV"$/,
    )
    expect(dockerConfigAssignmentIndex).toBeGreaterThanOrEqual(0)
    expect(dockerConfigInstallIndex).toBeGreaterThan(
      dockerConfigAssignmentIndex,
    )
    expect(dockerConfigExportIndex).toBeGreaterThan(dockerConfigInstallIndex)

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
    const buildxSetup = publishSteps.find((step) =>
      step.uses?.startsWith("docker/setup-buildx-action@"),
    )
    expect(buildxSetup).toBeDefined()
    expect(buildxSetup?.uses).toBe(
      "docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f",
    )
    expect(buildxSetup?.with?.version).toBe("v0.35.0")
    expect(buildxSetup?.with?.["cache-binary"]).toBe(false)
    const buildkitDriverOpts = buildxSetup?.with?.["driver-opts"]
    expect(buildkitDriverOpts).toMatch(
      /^image=moby\/buildkit@sha256:[0-9a-f]{64}$/,
    )
    expect(buildkitDriverOpts).toBe(
      "image=moby/buildkit@sha256:2f5adac4ecd194d9f8c10b7b5d7bceb5186853db1b26e5abd3a657af0b7e26ec",
    )

    const commands = publishSteps.flatMap((step) =>
      executableLines(step.run ?? ""),
    )
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
    const aliasDigestVerificationIndex = stepIndex((step) =>
      /test "\$\(docker buildx imagetools inspect "\$\{IMAGE\}:\$\{RELEASE_TAG\}" --format '\{\{\.Manifest\.Digest\}\}'\)" = "\$\{IMAGE_DIGEST\}"/.test(
        step.run ?? "",
      ),
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

    const aliasCommand =
      '.github/scripts/assert-image-alias-absent.sh "${IMAGE}:${RELEASE_TAG}"'
    const aliasCalls = publishSteps.flatMap((step, stepIndex) =>
      executableLines(step.run ?? "")
        .filter((line) =>
          line.includes(".github/scripts/assert-image-alias-absent.sh"),
        )
        .map((line) => ({ line, stepIndex })),
    )
    expect(aliasCalls.map(({ line }) => line)).toEqual([
      aliasCommand,
      aliasCommand,
    ])
    const aliasChecks = aliasCalls.map(({ stepIndex }) => stepIndex)
    expect(new Set(aliasChecks).size).toBe(2)
    expect(aliasChecks[0]).toBeGreaterThan(loginIndex)
    expect(aliasChecks[0]).toBeLessThan(pushIndex)
    expect(aliasChecks[1]).toBeGreaterThan(signIndex)
    expect(aliasChecks[1]).toBeLessThan(aliasIndex)
    expect(aliasDigestVerificationIndex).toBe(aliasIndex + 1)

    expect(format).toContain("actions/setup-node@v5")
    expect(format).toContain("npm run format:check")
    expect(format).not.toContain("actions/setup-go")
  })

  it("validates the registry-derived digest before every authoritative consumer", () => {
    const document = parse(read(".github/workflows/release.yml")) as Workflow
    const publishSteps = document.jobs.publish.steps ?? []
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
    const sbomIndex = stepIndex((step) =>
      step.uses?.startsWith("anchore/sbom-action@"),
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
    const aliasDigestVerificationIndex = stepIndex((step) =>
      /test "\$\(docker buildx imagetools inspect "\$\{IMAGE\}:\$\{RELEASE_TAG\}" --format '\{\{\.Manifest\.Digest\}\}'\)" = "\$\{IMAGE_DIGEST\}"/.test(
        step.run ?? "",
      ),
    )
    const digestValidationIndex = stepIndex(
      (step) => step.name === "Validate pushed image digest",
    )
    const digestValidationStep = publishSteps[digestValidationIndex]

    expect(digestValidationIndex).toBe(pushIndex + 1)
    for (const authorityIndex of [
      scanIndex,
      sbomIndex,
      recordIndex,
      provenanceIndex,
      sbomAttestIndex,
      releaseAttestIndex,
      signIndex,
      aliasIndex,
      aliasDigestVerificationIndex,
    ]) {
      expect(authorityIndex).toBeGreaterThan(digestValidationIndex)
    }

    const buildDigestExpression = "${{ steps.build.outputs.digest }}"
    expect(digestValidationStep?.env?.IMAGE_DIGEST).toBe(buildDigestExpression)
    const digestValidationScript = digestValidationStep?.run ?? ""
    expect(executableLines(digestValidationScript)).toEqual([
      "set -eu",
      'test -n "$IMAGE_DIGEST"',
      'test "${#IMAGE_DIGEST}" -eq 71',
      "printf '%s\\n' \"$IMAGE_DIGEST\" | grep -Eq '^sha256:[0-9a-f]{64}$'",
    ])

    const validDigest = `sha256:${"a".repeat(64)}`
    expect(
      runDigestValidation(digestValidationScript, validDigest).status,
    ).toBe(0)
    for (const [label, value] of [
      ["empty", ""],
      [
        "tag-based",
        "ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1",
      ],
      ["malformed registry-derived", `sha256:${"a".repeat(63)}`],
      ["multiline valid-prefix-plus-garbage", `${validDigest}\ngarbage`],
    ] as const) {
      const result = runDigestValidation(digestValidationScript, value)
      expect(result.status, `${label}: ${result.stderr}`).not.toBe(0)
    }

    const imageDigestBindings = publishSteps.flatMap((step) =>
      step.env?.IMAGE_DIGEST === undefined ? [] : [step.env.IMAGE_DIGEST],
    )
    expect(imageDigestBindings.length).toBeGreaterThan(0)
    for (const binding of imageDigestBindings) {
      expect(binding).toBe(buildDigestExpression)
    }

    const sbomImage = "${{ env.IMAGE }}@${{ steps.build.outputs.digest }}"
    const imageDigestTarget = '"${IMAGE}@${IMAGE_DIGEST}"'
    const tagOnlyTarget = '"${IMAGE}:${RELEASE_TAG}"'
    const recordDigestArgument = '--arg imageDigest "${IMAGE_DIGEST}"'
    const scanCommand =
      'trivy image --exit-code 1 --severity CRITICAL,HIGH "${IMAGE}@${IMAGE_DIGEST}"'
    const signCommand = 'cosign sign --yes "${IMAGE}@${IMAGE_DIGEST}"'
    const aliasCreationCommand =
      'docker buildx imagetools create --tag "${IMAGE}:${RELEASE_TAG}" "${IMAGE}@${IMAGE_DIGEST}"'
    const aliasDigestComparisonCommand =
      'test "$(docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}" --format \'{{.Manifest.Digest}}\')" = "${IMAGE_DIGEST}"'
    const sourceProvenanceAttestationCommands = [
      "set -eu",
      "cosign attest --yes \\",
      "--type https://vkwave.com/attestations/source-provenance/v1 \\",
      "--predicate source-provenance.json \\",
      imageDigestTarget,
    ]
    const spdxAttestationCommands = [
      "set -eu",
      "cosign attest --yes --type spdxjson \\",
      "--predicate sbom.spdx.json \\",
      imageDigestTarget,
    ]
    const releaseAttestationCommands = [
      "set -eu",
      "cosign attest --yes \\",
      "--type https://vkwave.com/attestations/release/v1 \\",
      "--predicate release-provenance.json \\",
      imageDigestTarget,
    ]
    const expectedAttestationCommandsByIndex: ReadonlyArray<
      readonly [number, readonly string[]]
    > = [
      [provenanceIndex, sourceProvenanceAttestationCommands],
      [sbomAttestIndex, spdxAttestationCommands],
      [releaseAttestIndex, releaseAttestationCommands],
    ]

    const expectBuildDigestEnv = (step: Step | undefined): void => {
      expect(step).toBeDefined()
      expect(step?.env?.IMAGE_DIGEST).toBe(buildDigestExpression)
    }

    const expectAuthoritativeConsumersUseBuildDigest = (
      steps: Step[],
    ): void => {
      const scanStep = steps[scanIndex]
      expectBuildDigestEnv(scanStep)
      expect(executableLines(scanStep?.run ?? "")).toEqual([
        "set -eu",
        scanCommand,
      ])

      expect(steps[sbomIndex]?.with?.image).toBe(sbomImage)

      const recordStep = steps[recordIndex]
      expectBuildDigestEnv(recordStep)
      const recordDigestArguments = executableLines(recordStep?.run ?? "")
        .filter((line) => line.startsWith("--arg imageDigest "))
        .map((line) => line.replace(/\s+\\$/, ""))
      expect(recordDigestArguments).toEqual([
        recordDigestArgument,
        recordDigestArgument,
      ])

      for (const [
        attestationIndex,
        expectedCommands,
      ] of expectedAttestationCommandsByIndex) {
        const attestationStep = steps[attestationIndex]
        expectBuildDigestEnv(attestationStep)
        expect(executableLines(attestationStep?.run ?? "")).toEqual(
          expectedCommands,
        )
      }

      const signStep = steps[signIndex]
      expectBuildDigestEnv(signStep)
      expect(executableLines(signStep?.run ?? "")).toEqual([
        "set -eu",
        signCommand,
      ])

      const aliasStep = steps[aliasIndex]
      expectBuildDigestEnv(aliasStep)
      expect(executableLines(aliasStep?.run ?? "")).toEqual([
        "set -eu",
        aliasCreationCommand,
      ])

      const aliasDigestVerificationStep = steps[aliasDigestVerificationIndex]
      expectBuildDigestEnv(aliasDigestVerificationStep)
      expect(executableLines(aliasDigestVerificationStep?.run ?? "")).toEqual([
        "set -eu",
        aliasDigestComparisonCommand,
      ])
    }

    expectAuthoritativeConsumersUseBuildDigest(publishSteps)

    const clonePublishSteps = (): Step[] =>
      publishSteps.map((step) => ({
        ...step,
        env: step.env === undefined ? undefined : { ...step.env },
        with: step.with === undefined ? undefined : { ...step.with },
      }))

    const replaceConsumerRunOnce = (
      consumerIndex: number,
      from: string,
      to: string,
    ): Step[] => {
      const mutated = clonePublishSteps()
      const step = mutated[consumerIndex]
      if (
        step === undefined ||
        step.run === undefined ||
        !step.run.includes(from)
      ) {
        throw new Error(
          `missing authoritative consumer mutation source: ${from}`,
        )
      }
      mutated[consumerIndex] = { ...step, run: step.run.replace(from, to) }
      return mutated
    }

    const replaceSbomImage = (replacement: string): Step[] => {
      const mutated = clonePublishSteps()
      const step = mutated[sbomIndex]
      if (step === undefined || step.with?.image !== sbomImage) {
        throw new Error("missing authoritative SBOM image input")
      }
      mutated[sbomIndex] = {
        ...step,
        with: { ...(step.with ?? {}), image: replacement },
      }
      return mutated
    }

    const alternateDigest = `sha256:${"b".repeat(64)}`
    const alternateDigestTarget = '"${IMAGE}@' + alternateDigest + '"'
    const alternateRecordDigestArgument =
      '--arg imageDigest "' + alternateDigest + '"'
    const alternateAliasDigestComparisonCommand =
      aliasDigestComparisonCommand.replace(
        '"${IMAGE_DIGEST}"',
        `"${alternateDigest}"`,
      )
    const sourceAttestationCommand = "cosign attest --yes \\"
    const spdxAttestationCommand = "cosign attest --yes --type spdxjson \\"
    const noOpAttestationCommand = "printf '%s' no-op \\"
    const attestationExecutableMutations: ReadonlyArray<
      readonly [string, () => Step[]]
    > = [
      [
        "source-provenance attestation executable",
        () =>
          replaceConsumerRunOnce(
            provenanceIndex,
            sourceAttestationCommand,
            noOpAttestationCommand,
          ),
      ],
      [
        "SPDX attestation executable",
        () =>
          replaceConsumerRunOnce(
            sbomAttestIndex,
            spdxAttestationCommand,
            noOpAttestationCommand,
          ),
      ],
      [
        "release attestation executable",
        () =>
          replaceConsumerRunOnce(
            releaseAttestIndex,
            sourceAttestationCommand,
            noOpAttestationCommand,
          ),
      ],
    ]
    const authoritativeConsumerMutations: ReadonlyArray<
      readonly [string, () => Step[]]
    > = [
      [
        "scan",
        () =>
          replaceConsumerRunOnce(scanIndex, imageDigestTarget, tagOnlyTarget),
      ],
      [
        "release-record writing",
        () =>
          replaceConsumerRunOnce(
            recordIndex,
            recordDigestArgument,
            alternateRecordDigestArgument,
          ),
      ],
      [
        "source-provenance attestation",
        () =>
          replaceConsumerRunOnce(
            provenanceIndex,
            imageDigestTarget,
            tagOnlyTarget,
          ),
      ],
      [
        "SPDX attestation",
        () =>
          replaceConsumerRunOnce(
            sbomAttestIndex,
            imageDigestTarget,
            alternateDigestTarget,
          ),
      ],
      [
        "release attestation",
        () =>
          replaceConsumerRunOnce(
            releaseAttestIndex,
            imageDigestTarget,
            tagOnlyTarget,
          ),
      ],
      [
        "signing",
        () =>
          replaceConsumerRunOnce(signIndex, imageDigestTarget, tagOnlyTarget),
      ],
      [
        "alias creation",
        () =>
          replaceConsumerRunOnce(aliasIndex, imageDigestTarget, tagOnlyTarget),
      ],
      [
        "post-write comparison",
        () =>
          replaceConsumerRunOnce(
            aliasDigestVerificationIndex,
            aliasDigestComparisonCommand,
            alternateAliasDigestComparisonCommand,
          ),
      ],
      [
        "SBOM generation",
        () => replaceSbomImage("${{ env.IMAGE }}:${{ github.ref_name }}"),
      ],
      ...attestationExecutableMutations,
    ]

    expect(authoritativeConsumerMutations).toHaveLength(12)
    for (const [label, mutate] of authoritativeConsumerMutations) {
      const mutated = mutate()
      expect(
        () => expectAuthoritativeConsumersUseBuildDigest(mutated),
        `${label} mutation must be rejected`,
      ).toThrow()
    }
  })

  it("allows only the complete Buildx v0.35.0 manifest-not-found result", () => {
    for (const [imageAlias, lineEnding] of [
      ["ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1", "\n"],
      ["ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1", "\r\n"],
      ["ghcr.io/vkwave/network-service:0.23.10-vkwave.1", "\n"],
      ["ghcr.io/vkwave/timeout-service:0.23.10-vkwave.1", "\n"],
      ["ghcr.io/vkwave/EOF-service:0.23.10-vkwave.1", "\n"],
      ["ghcr.io/vkwave/forbidden-service:0.23.10-vkwave.1", "\n"],
    ] as const) {
      const result = runAliasCheck({
        args: [imageAlias],
        dockerExit: 1,
        dockerStderr: `ERROR: ${imageAlias}: not found${lineEnding}`,
      })
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

  it("fails closed on every non-allowlisted registry result", () => {
    for (const dockerStderr of [
      "manifest unknown: manifest unknown\n",
      "manifest is not found\r\n",
      "ERROR: ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1: not found\r",
      "ERROR: ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1\r: not found",
      "manifest unknown: manifest unknown\nunexpected registry response",
      "manifest unknown: manifest unknown\nmanifest is not found",
      "manifest is not found: unexpected registry response",
      "ERROR: manifest unknown: manifest unknown",
      "manifest unknown: unauthorized: authentication required",
      "manifest unknown: unauthenticated request",
      "manifest unknown: denied: permission_denied",
      "manifest unknown: forbidden: authorization failed",
      "manifest unknown: 401 Unauthorized",
      "manifest unknown: 403 Forbidden",
      "manifest unknown: too many requests: rate limit exceeded",
      "manifest unknown: TLS handshake timeout",
      "manifest unknown: dial tcp: no such host",
      "manifest unknown: manifest unknown\nunexpected EOF",
      "manifest unknown: manifest unknown\ncontext canceled",
      "manifest unknown: manifest unknown\ncontext-canceled",
      "manifest unknown: operation cancelled",
      "manifest unknown: 500 Internal Server Error",
      "manifest unknown: 502 Bad Gateway",
      "manifest unknown: 503 Service Unavailable",
      "unexpected registry response",
    ]) {
      expectAliasRefused(runAliasCheck({ dockerStderr }))
    }

    for (const dockerExit of [124, 130, 137, 143]) {
      expectAliasRefused(
        runAliasCheck({
          dockerExit,
          dockerStderr:
            "ERROR: ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1: not found\n",
        }),
      )
    }

    expectAliasRefused(
      runAliasCheck({
        dockerExit: 0,
        dockerStderr: "manifest unknown: manifest unknown",
      }),
    )
  })

  it("fails closed on malformed arguments and ambiguous registry errors", () => {
    expectAliasRefused(runAliasCheck({ args: [] }))
    expectAliasRefused(
      runAliasCheck({
        args: [
          "ghcr.io/vkwave/kratos-selfservice-ui-node:0.23.10-vkwave.1",
          "unexpected-second-argument",
        ],
      }),
    )
    expectAliasRefused(runAliasCheck({ args: ["not-an-image-alias"] }))
    expectAliasRefused(
      runAliasCheck({ dockerStderr: "unexpected registry response" }),
    )
  })

  it("allowlists every executable command in the release operator blocks", () => {
    const releaseDocs = read("docs/release.md")
    const tagCreation = fencedShellBlock(releaseDocs, "Create a release tag")
    const completedRelease = fencedShellBlock(
      releaseDocs,
      "Verify a completed release",
    )
    const tagCommands = executableLines(tagCreation)
    const completedCommands = executableLines(completedRelease)

    const tagHelperCommand =
      '.github/scripts/assert-image-alias-absent.sh "${IMAGE}:${RELEASE_TAG}"'
    const tagExpectedCommands = [
      "set -eu",
      "printf 'Approved source SHA: ' >&2",
      "IFS= read -r SOURCE_SHA",
      "export SOURCE_SHA",
      "printf '%s\\n' \"$SOURCE_SHA\" | grep -Eq '^[0-9a-f]{40}$'",
      "git fetch origin master --tags",
      'test "$(git rev-parse HEAD)" = "$SOURCE_SHA"',
      'git merge-base --is-ancestor "$SOURCE_SHA" origin/master',
      "printf '%s\\n' \"$RELEASE_TAG\" | grep -Eq '^0\\.23\\.10-vkwave\\.[0-9]+$'",
      '! git show-ref --verify --quiet "refs/tags/$RELEASE_TAG"',
      'test -z "$(git ls-remote --tags origin "refs/tags/$RELEASE_TAG")"',
      "export DOCKER_CONFIG=$(mktemp -d)",
      'chmod 700 "$DOCKER_CONFIG"',
      "trap 'rm -rf \"$DOCKER_CONFIG\"' EXIT HUP INT TERM",
      "docker login ghcr.io",
      tagHelperCommand,
      'git tag -s "$RELEASE_TAG" "$SOURCE_SHA" -m "Release $RELEASE_TAG"',
      'git push origin "refs/tags/$RELEASE_TAG"',
    ]
    expectExactExecutableCommandSequence(tagCommands, tagExpectedCommands)

    const certificateIdentityCommand =
      '--certificate-identity "https://github.com/vkwave/kratos-selfservice-ui-node/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}" \\'
    const certificateIssuerCommand =
      '--certificate-oidc-issuer "https://token.actions.githubusercontent.com" \\'
    const completedExpectedCommands = [
      "set -eu",
      "printf 'Workflow image digest: ' >&2",
      "IFS= read -r DIGEST",
      "export DIGEST",
      "printf '%s\\n' \"$DIGEST\" | grep -Eq '^sha256:[0-9a-f]{64}$'",
      "export DOCKER_CONFIG=$(mktemp -d)",
      'chmod 700 "$DOCKER_CONFIG"',
      "trap 'rm -rf \"$DOCKER_CONFIG\"' EXIT HUP INT TERM",
      "docker login ghcr.io",
      'docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}"',
      'test "$(docker buildx imagetools inspect "${IMAGE}:${RELEASE_TAG}" --format \'{{.Manifest.Digest}}\')" = "$DIGEST"',
      "cosign verify \\",
      certificateIdentityCommand,
      certificateIssuerCommand,
      '"${IMAGE}@${DIGEST}"',
      "cosign verify-attestation \\",
      certificateIdentityCommand,
      certificateIssuerCommand,
      "--type https://vkwave.com/attestations/source-provenance/v1 \\",
      '"${IMAGE}@${DIGEST}"',
      "cosign verify-attestation \\",
      certificateIdentityCommand,
      certificateIssuerCommand,
      "--type https://vkwave.com/attestations/release/v1 \\",
      '"${IMAGE}@${DIGEST}"',
      "cosign verify-attestation \\",
      certificateIdentityCommand,
      certificateIssuerCommand,
      "--type spdxjson \\",
      '"${IMAGE}@${DIGEST}"',
    ]
    expectExactExecutableCommandSequence(
      completedCommands,
      completedExpectedCommands,
    )

    expect(() =>
      expectExactExecutableCommandSequence(
        insertExecutableCommandAfter(
          tagCommands,
          "export SOURCE_SHA",
          `printf -v SOURCE_SHA '%s' "$(git rev-parse origin/master)"`,
        ),
        tagExpectedCommands,
      ),
    ).toThrow()
    expect(() =>
      expectExactExecutableCommandSequence(
        insertExecutableCommandAfter(
          completedCommands,
          "export DIGEST",
          `printf -v DIGEST '%s' "$UNREVIEWED_DIGEST"`,
        ),
        completedExpectedCommands,
      ),
    ).toThrow()

    const authoritativeReleaseIdentity = `The OCI digest is the authoritative and immutable release identity. The GHCR
release tag is a non-authoritative convenience alias that can be changed by a
separately authorized registry writer.

Deploy and record \`\${IMAGE}@\${DIGEST}\`. An alias-resolution mismatch is a
release stop and registry-access incident; do not consume or automatically
repair the alias.

The final alias comparison verifies only the post-write resolution observed by
the workflow. It cannot detect every external-writer overwrite: without
conditional creation, the workflow can overwrite a writer that publishes
between the second absence check and alias creation, and a writer can change
the alias after comparison.`
    expect(releaseDocs).toContain(authoritativeReleaseIdentity)
    expect(tagCreation).not.toContain(authoritativeReleaseIdentity)
    expect(completedRelease).not.toContain(authoritativeReleaseIdentity)
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
    expect(pkg.overrides["brace-expansion"]).toBe("5.0.8")
    expect(pkg.overrides["brace-expansion"]).not.toBe("5.0.7")
    expect(pkg.overrides["brace-expansion@1"]).toBeUndefined()
    expect(pkg.overrides["brace-expansion@5"]).toBeUndefined()
    expect(major5BraceEntries.length).toBeGreaterThanOrEqual(1)
    for (const [path, metadata] of major5BraceEntries) {
      expect(metadata.version, path).toBe("5.0.8")
      expect(metadata.version, path).not.toBe("5.0.7")
    }
    expect(sha256("package.json")).toBe(
      "c38a1791640b4587c0321f4a13d324a696a4576824e94b73ee83e98d04fc43c0",
    )
    expect(sha256("package-lock.json")).toBe(
      "0076a4f9e35d18da80a9d00661bdb7a963220fd00f8f728b6d7f59ccb7baddbc",
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
        ([name]) => name !== "brace-expansion",
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
