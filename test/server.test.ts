import { describe, expect, it } from "vitest"
import { parsePort } from "../src/index"

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
