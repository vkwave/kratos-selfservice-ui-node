// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import {
  defaultConfig,
  getUrlForFlow,
  isQuerySet,
  logger,
  redirectOnSoftError,
  RouteCreator,
  RouteRegistrator,
} from "../pkg"
import { UserAuthCard } from "@ory/elements-markup"
import { URLSearchParams } from "url"
import { appendIfPresent } from "./query"

// A simple express handler that shows the registration screen.
export const createRegistrationRoute: RouteCreator =
  (createHelpers) => (req, res, next) => {
    res.locals.projectName = "Create account"

    const {
      flow,
      return_to,
      after_verification_return_to,
      login_challenge,
      organization,
      identity_schema = "",
    } = req.query
    const { frontend, kratosBrowserUrl, logoUrl, extraPartials } =
      createHelpers(req, res)

    const initFlowQuery = new URLSearchParams()
    appendIfPresent(initFlowQuery, "return_to", return_to)
    appendIfPresent(initFlowQuery, "organization", organization)
    appendIfPresent(initFlowQuery, "identity_schema", identity_schema)
    appendIfPresent(
      initFlowQuery,
      "after_verification_return_to",
      after_verification_return_to,
    )
    appendIfPresent(initFlowQuery, "login_challenge", login_challenge)

    const initFlowUrl = getUrlForFlow(
      kratosBrowserUrl,
      "registration",
      initFlowQuery,
    )

    // The flow is used to identify the settings and registration flow and
    // return data like the csrf_token and so on.
    if (!isQuerySet(flow)) {
      logger.debug("No flow ID found; initializing registration flow")
      res.redirect(303, initFlowUrl)
      return
    }

    frontend
      .getRegistrationFlow({ id: flow, cookie: req.header("Cookie") })
      .then(({ data: flow }) => {
        // Render the data using a view (e.g. Jade Template):
        const initLoginQuery = new URLSearchParams({
          return_to:
            (return_to && return_to.toString()) || flow.return_to || "",
          ...(flow.identity_schema && {
            identity_schema: flow.identity_schema.toString(),
          }),
          ...(flow.oauth2_login_request?.challenge && {
            login_challenge: flow.oauth2_login_request.challenge,
          }),
        })

        res.render("registration", {
          nodes: flow.ui.nodes,
          card: UserAuthCard(
            {
              flow,
              flowType: "registration",
              cardImage: logoUrl,
              additionalProps: {
                loginURL: getUrlForFlow(
                  kratosBrowserUrl,
                  "login",
                  initLoginQuery,
                ),
              },
            },
            { locale: res.locals.lang },
          ),
          extraPartial: extraPartials?.registration,
          extraContext: res.locals.extraContext,
        })
      })
      .catch(redirectOnSoftError(res, next, initFlowUrl))
  }

export const registerRegistrationRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
) => {
  app.get("/registration", createRegistrationRoute(createHelpers))
}
