// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { RouteRegistrator } from "../pkg"
import { UserErrorCard } from "@ory/elements-markup"

export const register404Route: RouteRegistrator = (app, createHelpers) => {
  app.get("*", (req, res) => {
    res.locals.projectName = res.locals.copy.notFoundTitle
    res.status(404).render("error", {
      card: UserErrorCard({
        title: res.locals.copy.notFoundTitle,
        cardImage: createHelpers?.(req, res).logoUrl,
        backUrl: "sessions",
        error: {
          id: "404",
          error: {
            reason: res.locals.copy.notFoundReason,
            code: 404,
          },
        },
      }),
    })
  })
}
