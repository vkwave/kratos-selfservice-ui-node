import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../src/app"
import { createLoginRoute } from "../src/routes/login"
import { createRecoveryRoute } from "../src/routes/recovery"

const testEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  AUTH_UI_ALLOW_INSECURE_DEV: "true",
  COOKIE_SECRET: "12345678901234567890123456789012",
  CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
  CSRF_COOKIE_NAME: "vkwave_csrf_test",
})

describe("self-service flow routes", () => {
  it("preserves the Hydra login challenge and AAL without empty query keys", async () => {
    const app = express()
    app.get(
      "/login",
      createLoginRoute((() => ({
        kratosBrowserUrl: "https://auth.example.test",
        frontend: {},
      })) as never),
    )

    const response = await request(app).get(
      "/login?login_challenge=challenge-1&aal=aal2",
    )
    const location = new URL(response.headers.location)

    expect(response.status).toBe(303)
    expect(location.searchParams.get("login_challenge")).toBe("challenge-1")
    expect(location.searchParams.get("aal")).toBe("aal2")
    expect(location.searchParams.has("refresh")).toBe(false)
    expect(location.searchParams.has("return_to")).toBe(false)
  })

  it("omits an absent recovery return target", async () => {
    const app = express()
    app.get(
      "/recovery",
      createRecoveryRoute((() => ({
        kratosBrowserUrl: "https://auth.example.test",
        frontend: {},
      })) as never),
    )

    const response = await request(app).get("/recovery")
    const location = new URL(response.headers.location)

    expect(response.status).toBe(303)
    expect(location.searchParams.has("return_to")).toBe(false)
  })

  it("does not render raw upstream error details", async () => {
    const response = await request(createApp(testEnv())).get(
      "/error?error=server_error&error_description=token%20secret%20127.0.0.1",
    )

    expect(response.status).toBe(200)
    expect(response.text).not.toMatch(/token secret|127\.0\.0\.1/i)
    expect(response.text).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )
  })
})
