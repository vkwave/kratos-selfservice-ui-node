import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

const read = (path: string): string => readFileSync(path, "utf8")

describe("release contract", () => {
  it("builds a pinned three-stage non-root image", () => {
    const dockerfile = read("Dockerfile")
    const pinnedBase =
      /FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2/g

    expect(dockerfile.match(pinnedBase)).toHaveLength(3)
    expect(dockerfile).toContain("USER 10001:10001")
    expect(dockerfile).toContain("HEALTHCHECK")
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
    expect(release).toContain("anchore/sbom-action@v0")
    expect(release).toContain("cosign sign --yes")
    expect(release).toContain("provenance: mode=max")
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
    expect(docs).not.toContain("DANGEROUSLY_DISABLE_SECURE_CSRF_COOKIES")
  })
})
