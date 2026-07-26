import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { copyForLanguage } from "../src/brand/copy"

describe("brand copy", () => {
  it("defines every self-service page label in English and Chinese", () => {
    for (const language of ["en", "zh-CN"]) {
      const copy = copyForLanguage(language)
      for (const key of [
        "loginPageTitle",
        "registrationPageTitle",
        "recoveryPageTitle",
        "verificationPageTitle",
        "settingsPageTitle",
        "logoutPageTitle",
        "consentPageTitle",
        "errorPageTitle",
        "notFoundTitle",
        "notFoundReason",
        "unknownClientLabel",
      ] as const) {
        expect(copy[key]).toEqual(expect.any(String))
        expect(copy[key].trim()).not.toBe("")
      }
    }
  })

  it("selects Chinese and falls back to English", () => {
    const chinese = copyForLanguage("zh-CN")
    expect(chinese.signInTitle).toBe("登录 VKWAVE")
    expect(chinese.welcomeTitle).toBe("欢迎使用 VKWAVE")
    expect(chinese.legalLabel).toBe("法律信息")
    expect(chinese.sessionInformation("auth.example.test", "alice")).toContain(
      "alice",
    )
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

  it("keeps danger text readable in dark mode", () => {
    const theme = readFileSync("public/vkwave-theme.css", "utf8")
    expect(theme).toMatch(
      /prefers-color-scheme: dark[\s\S]*--vkwave-danger: #fca5a5/,
    )
    expect(theme).toContain("--vkwave-danger: #b42318;\n\n  color-scheme")
  })
})
