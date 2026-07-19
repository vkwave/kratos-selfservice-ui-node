import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { copyForLanguage } from "../src/brand/copy"

describe("brand copy", () => {
  it("selects Chinese and falls back to English", () => {
    expect(copyForLanguage("zh-CN").signInTitle).toBe("登录 VKWAVE")
    expect(copyForLanguage("de-DE").signInTitle).toBe("Sign in to VKWAVE")
  })

  it("does not render upstream product marketing in branded screens", () => {
    const visibleSources = [
      "views/welcome.hbs",
      "src/routes/welcome.ts",
      "src/routes/sessions.ts",
      "src/pkg/ui.ts",
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")

    expect(visibleSources).not.toMatch(
      /Welcome to the Ory|Ory Account Experience|Default User Interfaces|active Ory Session/,
    )
  })
})
