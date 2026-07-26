import { createHash } from "crypto"
import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

const read = (path: string): string => readFileSync(path, "utf8")
const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")

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

  it("runs tests and publishes signed immutable images", () => {
    const ci = read(".github/workflows/ci.yml")
    const format = read(".github/workflows/format.yml")
    const release = read(".github/workflows/release.yml")

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
    expect(release).toMatch(/anchore\/sbom-action@[0-9a-f]{40} # v0/)
    expect(release).toContain("cosign sign --yes")
    expect(release).toContain("provenance: mode=max")
    expect(release).toContain("push-by-digest=true")
    expect(release).not.toContain(
      "tags: ${{ env.IMAGE }}:${{ github.ref_name }}",
    )
    const signIndex = release.indexOf("cosign sign --yes")
    const tagIndex = release.indexOf("docker buildx imagetools create")
    expect(signIndex).toBeGreaterThan(-1)
    expect(tagIndex).toBeGreaterThan(signIndex)
    expect(release.slice(tagIndex)).toMatch(
      /--tag\s+"\$\{IMAGE\}:\$\{RELEASE_TAG\}"\s+"\$\{IMAGE\}@\$\{IMAGE_DIGEST\}"/,
    )
    const actionReferences = release
      .split("\n")
      .filter((line) => line.includes("uses:"))
    expect(actionReferences.length).toBeGreaterThan(0)
    for (const reference of actionReferences) {
      expect(reference).toMatch(/@[0-9a-f]{40}\s+#\s+v\S+$/)
    }
    expect(format).toContain("actions/setup-node@v5")
    expect(format).toContain("npm run format:check")
    expect(format).not.toContain("actions/setup-go")
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
      "03923e368d8e5e72237f114d84c8db9fa11ee2a31fd6fd1642613d4c7cf06b79",
    )
    expect(sha256("package-lock.json")).toBe(
      "66dc5ffe533af315e8bf231e529ab972a3d648675ed8996543b75989df6c626a",
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
