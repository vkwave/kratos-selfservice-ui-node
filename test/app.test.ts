import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../src/app"

describe("self-service app", () => {
  it("reports liveness without contacting ORY", async () => {
    const response = await request(createApp({ NODE_ENV: "test" })).get(
      "/health/alive",
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: "ok" })
  })
})
