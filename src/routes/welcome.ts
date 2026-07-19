// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import {
  defaultConfig,
  RouteCreator,
  RouteRegistrator,
  setSession,
} from "../pkg"
import { navigationMenu } from "../pkg/ui"
import { CardGradient, Typography } from "@ory/elements-markup"
import { brandConfig } from "../brand/config"
import { copyForLanguage } from "../brand/copy"
import { queryStringOrFallback } from "./query"

export const createWelcomeRoute: RouteCreator =
  (createHelpers) => async (req, res) => {
    const copy = copyForLanguage(req.header("accept-language"))
    res.locals.projectName = copy.productAccountTitle

    const { frontend } = createHelpers(req, res)
    const session = req.session
    const { return_to } = req.query

    // Create a logout URL
    const logoutUrl =
      (
        await frontend
          .createBrowserLogoutFlow({
            cookie: req.header("cookie"),
            returnTo: queryStringOrFallback(return_to),
          })
          .catch(() => ({ data: { logout_url: "" } }))
      ).data.logout_url || ""

    res.render("welcome", {
      layout: "welcome",
      nav: navigationMenu({
        navTitle: res.locals.projectName,
        session,
        logoutUrl,
        selectedLink: "welcome",
        copy,
      }),
      projectInfoText: Typography({
        children: copy.projectInformation(req.header("host") || ""),
        type: "regular",
        size: "small",
        color: "foregroundMuted",
      }),
      concepts: [
        CardGradient({
          heading: copy.accountSettingsCardTitle,
          content: copy.accountSettingsCardDescription,
          action: "settings",
          target: "_self",
        }),
        CardGradient({
          heading: copy.activeSessionsCardTitle,
          content: copy.activeSessionsCardDescription,
          action: "sessions",
          target: "_self",
        }),
        CardGradient({
          heading: copy.accountRecoveryCardTitle,
          content: copy.accountRecoveryCardDescription,
          action: "recovery",
          target: "_self",
        }),
        CardGradient({
          heading: copy.emailVerificationCardTitle,
          content: copy.emailVerificationCardDescription,
          action: "verification",
          target: "_self",
        }),
        CardGradient({
          heading: copy.supportCardTitle,
          content: copy.supportCardDescription,
          action: brandConfig.supportUrl,
          target: "_blank",
        }),
      ].join("\n"),
    })
  }

export const registerWelcomeRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
  route = "/welcome",
) => {
  app.get(route, setSession(createHelpers), createWelcomeRoute(createHelpers))
}
