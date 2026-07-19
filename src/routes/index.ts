// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

export * from "./404"
export * from "./500"
export * from "./error"
export * from "./health"
export * from "./login"
export * from "./consent"
export * from "./recovery"
export * from "./registration"
export * from "./sessions"
export * from "./settings"
export * from "./static"
export * from "./verification"
export * from "./welcome"
export * from "./logout"

import { RequestHandler, Router } from "express"
import { register404Route } from "./404"
import { register500Route } from "./500"
import { registerConsentRoute } from "./consent"
import { csrfErrorHandler } from "./csrfError"
import { registerErrorRoute } from "./error"
import { registerHealthRoute } from "./health"
import { registerLoginRoute } from "./login"
import { registerLogoutRoute } from "./logout"
import { registerRecoveryRoute } from "./recovery"
import { registerRegistrationRoute } from "./registration"
import { registerSessionsRoute } from "./sessions"
import { registerSettingsRoute } from "./settings"
import { registerStaticRoutes } from "./static"
import { registerVerificationRoute } from "./verification"
import { registerWelcomeRoute } from "./welcome"

export interface RouteSecurity {
  doubleCsrfProtection: RequestHandler
  invalidCsrfTokenError: unknown
}

export const registerRoutes = (
  router: Router,
  security: RouteSecurity,
): void => {
  registerStaticRoutes(router)
  registerHealthRoute(router)
  registerLoginRoute(router)
  registerRecoveryRoute(router)
  registerRegistrationRoute(router)
  registerSettingsRoute(router)
  registerVerificationRoute(router)
  registerSessionsRoute(router)
  registerWelcomeRoute(router)
  registerErrorRoute(router)
  router.use("/consent", security.doubleCsrfProtection)
  router.use("/consent", csrfErrorHandler(security.invalidCsrfTokenError))
  registerConsentRoute(router)
  router.use("/logout", security.doubleCsrfProtection)
  router.use("/logout", csrfErrorHandler(security.invalidCsrfTokenError))
  registerLogoutRoute(router)
  router.get("/", (_req, res) => res.redirect(303, "welcome"))
  register404Route(router)
  register500Route(router)
}
