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

export const createWelcomeRoute: RouteCreator =
  (createHelpers) => async (req, res) => {
    res.locals.projectName = "VKWAVE Account"

    const { frontend } = createHelpers(req, res)
    const session = req.session
    const { return_to } = req.query

    // Create a logout URL
    const logoutUrl =
      (
        await frontend
          .createBrowserLogoutFlow({
            cookie: req.header("cookie"),
            returnTo: (return_to && return_to.toString()) || "",
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
      }),
      projectInfoText: Typography({
        children: `Your VKWAVE account center is running at ${req.header(
          "host",
        )}.`,
        type: "regular",
        size: "small",
        color: "foregroundMuted",
      }),
      concepts: [
        CardGradient({
          heading: "Account settings",
          content:
            "Update your profile, credentials, and verification methods.",
          action: "settings",
          target: "_self",
        }),
        CardGradient({
          heading: "Active sessions",
          content:
            "Review the identity and authentication level for this session.",
          action: "sessions",
          target: "_self",
        }),
        CardGradient({
          heading: "Account recovery",
          content: "Recover access using your configured recovery address.",
          action: "recovery",
          target: "_self",
        }),
        CardGradient({
          heading: "Email verification",
          content: "Verify the email address associated with your identity.",
          action: "verification",
          target: "_self",
        }),
        CardGradient({
          heading: "Support",
          content: "Get help with account access and security questions.",
          action: "https://vkwave.com/support",
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
