// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { RouteRegistrator } from "../pkg"
import { Request, Response } from "express"

export const registerHealthRoute: RouteRegistrator = (app) => {
  app.get("/health/alive", (_: Request, res: Response) =>
    res.json({ status: "ok" }),
  )
  app.get("/health/ready", (_: Request, res: Response) =>
    res.json({ status: "ok" }),
  )
}
