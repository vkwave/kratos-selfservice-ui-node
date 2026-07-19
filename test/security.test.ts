import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../src/app"
import { loadSecurityConfig } from "../src/security/config"

describe("security configuration", () => {
  it("rejects insecure production mode", () => {
    expect(() =>
      loadSecurityConfig({
        NODE_ENV: "production",
        AUTH_UI_ALLOW_INSECURE_DEV: "true",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "__Host-vkwave_csrf",
      }),
    ).toThrow(/insecure development cookies/)
  })

  it("sets CSP and anti-framing headers", async () => {
    const response = await request(
      createApp({
        NODE_ENV: "test",
        AUTH_UI_ALLOW_INSECURE_DEV: "true",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "vkwave_csrf_test",
      }),
    ).get("/health/alive")

    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    )
    expect(response.headers["x-content-type-options"]).toBe("nosniff")
    expect(response.headers["x-powered-by"]).toBeUndefined()
  })

  it("allows only the normalized Kratos browser origin for form posts", async () => {
    const response = await request(
      createApp({
        NODE_ENV: "test",
        AUTH_UI_ALLOW_INSECURE_DEV: "true",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "vkwave_csrf_test",
        KRATOS_BROWSER_URL:
          "https://kratos.example.test/self-service/login/browser",
      }),
    ).get("/health/alive")

    expect(response.headers["content-security-policy"]).toContain(
      "form-action 'self' https://kratos.example.test",
    )
    expect(() =>
      createApp({
        NODE_ENV: "test",
        AUTH_UI_ALLOW_INSECURE_DEV: "true",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "vkwave_csrf_test",
        KRATOS_BROWSER_URL: "javascript:alert(1)",
      }),
    ).toThrow(/KRATOS_BROWSER_URL must use http or https/)
  })

  it("rejects weak secrets and non-host production cookies", () => {
    expect(() =>
      loadSecurityConfig({
        NODE_ENV: "test",
        COOKIE_SECRET: "short",
        CSRF_COOKIE_SECRET: "short",
        CSRF_COOKIE_NAME: "vkwave_csrf_test",
      }),
    ).toThrow(/at least 32 characters/)

    expect(() =>
      loadSecurityConfig({
        NODE_ENV: "production",
        AUTH_UI_ALLOW_INSECURE_DEV: "false",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "vkwave_csrf",
      }),
    ).toThrow(/__Host-/)
  })

  it("rejects request bodies larger than 256kb", async () => {
    const response = await request(
      createApp({
        NODE_ENV: "test",
        AUTH_UI_ALLOW_INSECURE_DEV: "true",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "vkwave_csrf_test",
      }),
    )
      .post("/unknown")
      .send({ payload: "x".repeat(300 * 1024) })

    expect(response.status).toBe(413)
  })
})
