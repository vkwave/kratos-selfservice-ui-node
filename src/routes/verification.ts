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
import { UiText } from "@ory/client"
import { UserAuthCard } from "@ory/elements-markup"
import { appendIfPresent } from "./query"

export const createVerificationRoute: RouteCreator =
  (createHelpers) => (req, res, next) => {
    res.locals.projectName = "Verify account"

    const { flow, return_to = "", message } = req.query
    const { frontend, kratosBrowserUrl, logoUrl } = createHelpers(req, res)

    const initFlowQuery = new URLSearchParams()
    appendIfPresent(initFlowQuery, "return_to", return_to)
    const initFlowUrl = getUrlForFlow(
      kratosBrowserUrl,
      "verification",
      initFlowQuery,
    )

    // The flow is used to identify the settings and registration flow and
    // return data like the csrf_token and so on.
    if (!isQuerySet(flow)) {
      logger.debug("No flow ID found; initializing verification flow")
      res.redirect(303, initFlowUrl)
      return
    }

    return (
      frontend
        .getVerificationFlow({ id: flow, cookie: req.header("cookie") })
        .then(({ data: flow }) => {
          const initRegistrationQuery = new URLSearchParams()
          appendIfPresent(
            initRegistrationQuery,
            "return_to",
            (return_to && return_to.toString()) || flow.return_to,
          )
          const initRegistrationUrl = getUrlForFlow(
            kratosBrowserUrl,
            "registration",
            initRegistrationQuery,
          )

          // check for custom messages in the query string
          if (isQuerySet(message)) {
            const m: UiText[] = JSON.parse(message)

            // add them to the flow data so they can be rendered by the UI
            flow.ui.messages = [...(flow.ui.messages || []), ...m]
          }

          // Render the data using a view (e.g. Jade Template):
          res.render("verification", {
            nodes: flow.ui.nodes,
            card: UserAuthCard(
              {
                flow,
                flowType: "verification",
                cardImage: logoUrl,
                additionalProps: {
                  signupURL: initRegistrationUrl,
                },
              },
              { locale: res.locals.lang },
            ),
          })
        })
        // Handle errors using ExpressJS' next functionality:
        .catch(redirectOnSoftError(res, next, initFlowUrl))
    )
  }

export const registerVerificationRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
) => {
  app.get("/verification", createVerificationRoute(createHelpers))
}
