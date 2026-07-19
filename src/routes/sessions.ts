// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import {
  defaultConfig,
  requireAuth,
  RouteCreator,
  RouteRegistrator,
} from "../pkg"
import { navigationMenu } from "../pkg/ui"
import { CodeBox, Typography } from "@ory/elements-markup"
import { copyForLanguage } from "../brand/copy"

export const createSessionsRoute: RouteCreator =
  (createHelpers) => async (req, res) => {
    const copy = copyForLanguage(req.header("accept-language"))
    res.locals.projectName = copy.sessionTitle
    const { frontend } = createHelpers(req, res)
    const session = req.session

    // Create a logout URL
    const logoutUrl =
      (
        await frontend
          .createBrowserLogoutFlow({ cookie: req.header("cookie") })
          .catch(() => ({ data: { logout_url: "" } }))
      ).data.logout_url || ""

    const identityCredentialTrait =
      session?.identity?.traits.email ||
      session?.identity?.traits.username ||
      ""

    res.render("session", {
      layout: "welcome",
      sessionInfoText: Typography({
        children: copy.sessionInformation(
          req.header("host") || "",
          identityCredentialTrait || undefined,
        ),
        size: "small",
        color: "foregroundMuted",
      }),
      traits: {
        id: session?.identity?.id,
        // sometimes the identity schema could contain recursive objects
        // for this use case we will just stringify the object instead of recursively flatten the object
        ...Object.entries(session?.identity?.traits).reduce<
          Record<string, any>
        >((traits, [key, value]) => {
          traits[key] =
            typeof value === "object" ? JSON.stringify(value) : value
          return traits
        }, {}),
        [copy.signupDateLabel]: session?.identity?.created_at || "",
        [copy.authenticationLevelLabel]:
          session?.authenticator_assurance_level === "aal2"
            ? copy.twoFactorLabel
            : copy.singleFactorLabel,
        ...(session?.expires_at && {
          [copy.sessionExpiresAtLabel]: new Date(
            session?.expires_at,
          ).toUTCString(),
        }),
        ...(session?.authenticated_at && {
          [copy.sessionAuthenticatedAtLabel]: new Date(
            session?.authenticated_at,
          ).toUTCString(),
        }),
      },
      // map the session's authentication level to a human readable string
      // this produces a list of objects
      authMethods: session?.authentication_methods?.reduce<any>(
        (methods, method, i) => {
          methods.push({
            [copy.authenticationMethodLabel]: `${method.method} (${
              method.completed_at && new Date(method.completed_at).toUTCString()
            })`,
          })
          return methods
        },
        [],
      ),
      sessionCodeBox: CodeBox({
        className: "session-code-box",
        children: JSON.stringify(session, null, 2),
      }),
      nav: navigationMenu({
        navTitle: res.locals.projectName,
        session,
        logoutUrl,
        selectedLink: "sessions",
        copy,
      }),
    })
  }

export const registerSessionsRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
  route = "/sessions",
) => {
  app.get(route, requireAuth(createHelpers), createSessionsRoute(createHelpers))
}
