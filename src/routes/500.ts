// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from "crypto"
import { NextFunction, Request, Response } from "express"
import { logger, RouteRegistrator } from "../pkg"

export const register500Route: RouteRegistrator = (app) => {
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = randomUUID()
    const errorClass =
      typeof err?.name === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(err.name)
        ? err.name
        : "InternalError"

    logger.error("Unhandled self-service request", {
      requestId,
      errorClass,
      method: req.method,
      path: req.path,
    })
    res.status(500).render("error", { requestId })
  })
}
