import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../src/app"

describe("self-service app", () => {
  it("reports liveness without contacting ORY", async () => {
    const response = await request(
      createApp({
        NODE_ENV: "test",
        AUTH_UI_ALLOW_INSECURE_DEV: "true",
        COOKIE_SECRET: "12345678901234567890123456789012",
        CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
        CSRF_COOKIE_NAME: "vkwave_csrf_test",
      }),
    ).get("/health/alive")

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: "ok" })
  })
})
