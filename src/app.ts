// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import { DoubleCsrfCookieOptions, doubleCsrf } from "csrf-csrf"
import express, { Express, Request } from "express"
import { engine } from "express-handlebars"
import { brandConfig } from "./brand/config"
import { copyForLanguage } from "./brand/copy"
import {
  addFavicon,
  defaultConfig,
  detectLanguage,
  handlebarsHelpers,
} from "./pkg"
import { middleware as middlewareLogger } from "./pkg/logger"
import { registerRoutes } from "./routes"
import { loadSecurityConfig } from "./security/config"
import { securityHeaders } from "./security/headers"

export const createApp = (env: NodeJS.ProcessEnv = process.env): Express => {
  const app = express()
  const router = express.Router()
  const baseUrl = env.BASE_PATH || "/"
  const security = loadSecurityConfig(env)
  const cookieOptions: DoubleCsrfCookieOptions = {
    // csrf-csrf always adds HttpOnly when it writes this cookie.
    path: "/",
    sameSite: "lax",
    signed: true,
    secure: security.secureCookies,
  }
  const { invalidCsrfTokenError, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => security.csrfCookieSecret,
    cookieName: security.csrfCookieName,
    cookieOptions,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getTokenFromRequest: (req: Request) => req.body._csrf,
  })

  app.disable("x-powered-by")
  app.use(securityHeaders(env))
  app.use(middlewareLogger)
  app.use(cookieParser(security.cookieSecret))
  app.use(addFavicon(defaultConfig))
  app.use(detectLanguage)
  app.use((req, res, next) => {
    res.locals.brand = brandConfig
    res.locals.copy = copyForLanguage(req.header("accept-language"))
    next()
  })
  app.use(express.json({ limit: "256kb" }))
  app.use(bodyParser.urlencoded({ extended: false, limit: "256kb" }))
  app.set("view engine", "hbs")
  app.engine(
    "hbs",
    engine({
      extname: "hbs",
      layoutsDir: `${__dirname}/../views/layouts/`,
      partialsDir: `${__dirname}/../views/partials/`,
      defaultLayout: "auth",
      helpers: handlebarsHelpers,
    }),
  )

  registerRoutes(router, { doubleCsrfProtection, invalidCsrfTokenError })
  app.use(baseUrl, router)
  return app
}
