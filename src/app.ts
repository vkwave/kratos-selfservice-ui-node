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

export const createApp = (env: NodeJS.ProcessEnv = process.env): Express => {
  const app = express()
  const router = express.Router()
  const baseUrl = env.BASE_PATH || "/"
  const cookieName = env.CSRF_COOKIE_NAME || "__Host-ax-x-csrf-token"
  const cookieOptions: DoubleCsrfCookieOptions = {
    sameSite: "lax",
    signed: true,
    secure: !env.DANGEROUSLY_DISABLE_SECURE_CSRF_COOKIES,
  }
  const { invalidCsrfTokenError, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => env.CSRF_COOKIE_SECRET || "",
    cookieName,
    cookieOptions,
    ignoredMethods: ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"],
    getTokenFromRequest: (req: Request) => req.body._csrf,
  })

  app.use(middlewareLogger)
  app.use(cookieParser(env.COOKIE_SECRET || ""))
  app.use(addFavicon(defaultConfig))
  app.use(detectLanguage)
  app.use((req, res, next) => {
    res.locals.brand = brandConfig
    res.locals.copy = copyForLanguage(req.header("accept-language"))
    next()
  })
  app.use(bodyParser.urlencoded({ extended: false }))
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
