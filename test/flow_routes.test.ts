import express from "express"
import { engine } from "express-handlebars"
import path from "path"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { createApp } from "../src/app"
import { brandConfig } from "../src/brand/config"
import { copyForLanguage } from "../src/brand/copy"
import { handlebarsHelpers } from "../src/pkg"
import { register404Route } from "../src/routes/404"
import { createConsentRoute } from "../src/routes/consent"
import { createErrorRoute } from "../src/routes/error"
import { createLoginRoute } from "../src/routes/login"
import { createShowLogoutRoute } from "../src/routes/logout"
import { queryStringOrFallback } from "../src/routes/query"
import { createRecoveryRoute } from "../src/routes/recovery"
import { createRegistrationRoute } from "../src/routes/registration"
import { createSettingsRoute } from "../src/routes/settings"
import { createVerificationRoute } from "../src/routes/verification"

vi.mock("@ory/elements-markup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ory/elements-markup")>()
  return {
    ...actual,
    UserAuthCard: () => "",
    UserConsentCard: ({ client_name }: { client_name: string }) => client_name,
    UserErrorCard: () => "",
    UserLogoutCard: () => "",
    UserSettingsScreen: () => ({ Body: "", Nav: "" }),
  }
})

const testEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  AUTH_UI_ALLOW_INSECURE_DEV: "true",
  COOKIE_SECRET: "12345678901234567890123456789012",
  CSRF_COOKIE_SECRET: "abcdefghijklmnopqrstuvwxyz123456",
  CSRF_COOKIE_NAME: "vkwave_csrf_test",
})

const flow = {
  id: "flow-1",
  active: "",
  expires_at: "2026-07-27T00:00:00Z",
  issued_at: "2026-07-26T00:00:00Z",
  request_url: "https://auth.example.test/flow",
  return_to: "",
  ui: {
    action: "https://auth.example.test/submit",
    method: "POST",
    nodes: [],
  },
}

const consentRequest = {
  client: {},
  requested_access_token_audience: [],
  requested_scope: [],
  skip: false,
}

const createHelpers = () =>
  ({
    apiBaseUrl: "https://auth.example.test",
    frontend: {
      createBrowserLogoutFlow: async () => ({ data: { logout_url: "" } }),
      getLoginFlow: async () => ({ data: flow }),
      getRecoveryFlow: async () => ({ data: flow }),
      getRegistrationFlow: async () => ({ data: flow }),
      getSettingsFlow: async () => ({ data: flow }),
      getVerificationFlow: async () => ({ data: flow }),
    },
    identity: {},
    isOAuthConsentRouteEnabled: () => true,
    kratosBrowserUrl: "https://auth.example.test",
    oauth2: {
      getOAuth2ConsentRequest: async () => ({ data: consentRequest }),
      getOAuth2LogoutRequest: async () => ({ data: { skip: false } }),
    },
    shouldSkipConsent: () => false,
    shouldSkipLogoutConsent: () => false,
  }) as never

const createRenderedRouteApp = (
  route: ReturnType<
    | typeof createConsentRoute
    | typeof createErrorRoute
    | typeof createLoginRoute
    | typeof createRecoveryRoute
    | typeof createRegistrationRoute
    | typeof createSettingsRoute
    | typeof createShowLogoutRoute
    | typeof createVerificationRoute
  >,
  routePath: string,
) => {
  const app = express()
  app.set("view engine", "hbs")
  app.engine(
    "hbs",
    engine({
      extname: "hbs",
      layoutsDir: path.resolve("views/layouts"),
      partialsDir: path.resolve("views/partials"),
      defaultLayout: "auth",
      helpers: handlebarsHelpers,
    }),
  )
  app.use((req, res, next) => {
    res.locals.brand = brandConfig
    res.locals.copy = copyForLanguage(req.header("accept-language"))
    res.locals.lang = req.header("accept-language")?.startsWith("zh")
      ? "zh"
      : "en"
    req.csrfToken = () => "test-csrf-token"
    next()
  })
  app.get(routePath, route)
  return app
}

const expectChineseTitle = async (
  app: express.Express,
  url: string,
  title: string,
  status = 200,
) => {
  const response = await request(app).get(url).set("Accept-Language", "zh-CN")
  expect(response.status, response.text).toBe(status)
  expect(response.text).toContain(`<title>${title}</title>`)
}

describe("self-service flow routes", () => {
  it("renders the Chinese login page title", async () => {
    await expectChineseTitle(
      createRenderedRouteApp(createLoginRoute(createHelpers), "/login"),
      "/login?flow=flow-1",
      "登录",
    )
  })

  it("renders the Chinese registration page title", async () => {
    await expectChineseTitle(
      createRenderedRouteApp(
        createRegistrationRoute(createHelpers),
        "/registration",
      ),
      "/registration?flow=flow-1",
      "创建账户",
    )
  })

  it("renders the Chinese recovery page title", async () => {
    await expectChineseTitle(
      createRenderedRouteApp(createRecoveryRoute(createHelpers), "/recovery"),
      "/recovery?flow=flow-1",
      "恢复账户",
    )
  })

  it("renders the Chinese verification page title", async () => {
    await expectChineseTitle(
      createRenderedRouteApp(
        createVerificationRoute(createHelpers),
        "/verification",
      ),
      "/verification?flow=flow-1",
      "验证账户",
    )
  })

  it("renders the Chinese settings page title", async () => {
    const app = createRenderedRouteApp(
      createSettingsRoute(createHelpers),
      "/settings",
    )
    app.set("layout", "settings")
    await expectChineseTitle(app, "/settings?flow=flow-1", "账户设置")
  })

  it("renders the Chinese logout page title", async () => {
    await expectChineseTitle(
      createRenderedRouteApp(createShowLogoutRoute(createHelpers), "/logout"),
      "/logout?logout_challenge=logout-1",
      "退出登录",
    )
  })

  it("localizes the consent title and unknown-client fallback", async () => {
    const app = createRenderedRouteApp(
      createConsentRoute(createHelpers),
      "/consent",
    )
    const english = await request(app).get(
      "/consent?consent_challenge=consent-1",
    )
    const chinese = await request(app)
      .get("/consent?consent_challenge=consent-1")
      .set("Accept-Language", "zh-CN")

    expect(english.status).toBe(200)
    expect(english.text).toContain("<title>Authorization consent</title>")
    expect(english.text).toContain("Unknown client")
    expect(english.text).not.toContain("Unknown Client")
    expect(chinese.status).toBe(200)
    expect(chinese.text).toContain("<title>授权确认</title>")
    expect(chinese.text).toContain("未知客户端")
    expect(chinese.text).not.toContain("Unknown client")
    expect(chinese.text).not.toContain("Unknown Client")
  })

  it("localizes the error and not-found page titles", async () => {
    const errorApp = createRenderedRouteApp(
      createErrorRoute(createHelpers),
      "/error",
    )
    await expectChineseTitle(errorApp, "/error", "认证错误")

    const notFoundApp = express()
    notFoundApp.set("view engine", "hbs")
    notFoundApp.engine(
      "hbs",
      engine({
        extname: "hbs",
        layoutsDir: path.resolve("views/layouts"),
        partialsDir: path.resolve("views/partials"),
        defaultLayout: "auth",
        helpers: handlebarsHelpers,
      }),
    )
    notFoundApp.use((req, res, next) => {
      res.locals.brand = brandConfig
      res.locals.copy = copyForLanguage(req.header("accept-language"))
      res.locals.lang = "zh"
      next()
    })
    register404Route(notFoundApp)
    await expectChineseTitle(notFoundApp, "/missing", "页面未找到", 404)
  })

  it("preserves the Hydra login challenge and AAL without empty query keys", async () => {
    const app = express()
    app.use((req, res, next) => {
      res.locals.copy = copyForLanguage(req.header("accept-language"))
      next()
    })
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
    app.use((req, res, next) => {
      res.locals.copy = copyForLanguage(req.header("accept-language"))
      next()
    })
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

  it("falls back instead of coercing repeated query values", () => {
    expect(queryStringOrFallback(["one", "two"], "flow-target")).toBe(
      "flow-target",
    )
    expect(queryStringOrFallback("query-target", "flow-target")).toBe(
      "query-target",
    )
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
