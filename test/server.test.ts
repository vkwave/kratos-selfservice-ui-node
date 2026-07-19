import { describe, expect, it } from "vitest"
import { parsePort, parseTLSPaths } from "../src/index"

describe("server port configuration", () => {
  it("preserves ephemeral port zero and defaults only when absent", () => {
    expect(parsePort("0")).toBe(0)
    expect(parsePort(undefined)).toBe(3000)
    expect(parsePort("")).toBe(3000)
  })

  it("rejects non-integer and out-of-range ports", () => {
    expect(() => parsePort("1.5")).toThrow(/PORT/)
    expect(() => parsePort("65536")).toThrow(/PORT/)
    expect(() => parsePort("not-a-port")).toThrow(/PORT/)
  })
})

describe("server TLS configuration", () => {
  it("fails closed when only one TLS path is configured", () => {
    expect(() =>
      parseTLSPaths({ TLS_CERT_PATH: "/run/secrets/tls.crt" }),
    ).toThrow(/must be provided together/)
    expect(() =>
      parseTLSPaths({ TLS_KEY_PATH: "/run/secrets/tls.key" }),
    ).toThrow(/must be provided together/)
  })

  it("trims a complete TLS pair and permits HTTP only when both are absent", () => {
    expect(
      parseTLSPaths({
        TLS_CERT_PATH: " /run/secrets/tls.crt ",
        TLS_KEY_PATH: " /run/secrets/tls.key ",
      }),
    ).toEqual({
      certPath: "/run/secrets/tls.crt",
      keyPath: "/run/secrets/tls.key",
    })
    expect(parseTLSPaths({})).toBeUndefined()
  })
})
