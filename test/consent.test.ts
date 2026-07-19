import { readFileSync } from "fs"
import { afterEach, describe, expect, it } from "vitest"
import { consentViewModel, extractSession } from "../src/routes/consent"

const originalAccessTokenTraits = process.env.SESSION_EXTRA_TRAITS_ACCESS_TOKEN
const originalIdTokenTraits = process.env.SESSION_EXTRA_TRAITS_ID_TOKEN

afterEach(() => {
  if (originalAccessTokenTraits === undefined) {
    delete process.env.SESSION_EXTRA_TRAITS_ACCESS_TOKEN
  } else {
    process.env.SESSION_EXTRA_TRAITS_ACCESS_TOKEN = originalAccessTokenTraits
  }
  if (originalIdTokenTraits === undefined) {
    delete process.env.SESSION_EXTRA_TRAITS_ID_TOKEN
  } else {
    process.env.SESSION_EXTRA_TRAITS_ID_TOKEN = originalIdTokenTraits
  }
})

describe("Hydra consent", () => {
  it("copies safe profile fields into the access-token session", () => {
    const req = {
      session: {
        identity: {
          id: "identity-1",
          traits: { username: "alice", name: "Alice" },
          verifiable_addresses: [
            { via: "email", value: "alice@example.test", verified: true },
          ],
        },
      },
    } as never

    const session = extractSession(req, ["openid", "profile", "email"])
    expect(session.access_token).toMatchObject({
      email: "alice@example.test",
      email_verified: true,
      preferred_username: "alice",
      name: "Alice",
    })
  })

  it("preserves structured profile claims and blocks reserved trait names", () => {
    process.env.SESSION_EXTRA_TRAITS_ACCESS_TOKEN =
      "plan,sub,metadata_admin,__proto__"
    const req = {
      session: {
        identity: {
          updated_at: "2026-07-19T00:00:00Z",
          traits: {
            name: { first: "Alice", last: "Wave" },
            website: "https://alice.example.test",
            plan: "pro",
            sub: "forged",
            metadata_admin: { roles: ["auth_admin"] },
            __proto__: { polluted: true },
          },
        },
      },
    } as never

    const session = extractSession(req, ["profile"])
    expect(session.access_token).toMatchObject({
      given_name: "Alice",
      family_name: "Wave",
      website: "https://alice.example.test",
      updated_at: 1784419200,
      plan: "pro",
    })
    expect(session.access_token).not.toHaveProperty("sub")
    expect(session.access_token).not.toHaveProperty("metadata_admin")
    expect(session.access_token).not.toHaveProperty("polluted")
  })

  it("shows resource, redirect host, scopes, and localhost warning", () => {
    const model = consentViewModel({
      client: {
        client_id: "https://client.example/meta.json",
        client_name: "Example Client",
        redirect_uris: ["http://127.0.0.1:3210/callback"],
      },
      requested_scope: ["mcp:tools"],
      requested_access_token_audience: ["https://api.example.test/mcp"],
    } as never)

    expect(model.redirectHosts).toEqual(["127.0.0.1:3210"])
    expect(model.localhostWarning).toBe(true)
    expect(model.resources).toEqual(["https://api.example.test/mcp"])
  })

  it("separates repeated values in the consent template", () => {
    const template = readFileSync("views/consent.hbs", "utf8")
    expect(template.match(/#unless @last/g)).toHaveLength(3)
  })
})
