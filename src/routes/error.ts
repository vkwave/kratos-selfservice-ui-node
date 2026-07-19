// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from "crypto"
import { FrontendApi } from "@ory/client"
import { isAxiosError } from "axios"
import {
  defaultConfig,
  isQuerySet,
  logger,
  RouteCreator,
  RouteRegistrator,
} from "../pkg"

const safeErrorClass = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value)
    ? value
    : fallback

const fetchErrorClass = async (
  frontend: FrontendApi,
  query: qs.ParsedQs,
): Promise<string> => {
  if (query.error !== undefined) {
    return safeErrorClass(query.error, "oauth_error")
  }
  if (isQuerySet(query.id)) {
    const response = await frontend.getFlowError({ id: query.id })
    if (response.status !== 200) {
      throw new Error("flow error details were unavailable")
    }
    const error = response.data.error as { id?: unknown } | undefined
    return safeErrorClass(error?.id, "ory_flow_error")
  }
  return "unknown_error"
}

export const createErrorRoute: RouteCreator =
  (createHelpers) => async (req, res) => {
    res.locals.projectName = "Account request error"
    const requestId = randomUUID()
    const { frontend } = createHelpers(req, res)
    let errorClass = "unknown_error"

    try {
      errorClass = await fetchErrorClass(frontend, req.query)
    } catch (error) {
      errorClass = isAxiosError(error)
        ? `upstream_${error.response?.status ?? "error"}`
        : "error_details_unavailable"
    }

    logger.warn("Self-service flow error", { requestId, errorClass })
    res.status(200).render("error", { requestId })
  }

export const registerErrorRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
) => {
  app.get("/error", createErrorRoute(createHelpers))
}
