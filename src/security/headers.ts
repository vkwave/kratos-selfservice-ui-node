// Copyright © 2026 VKWAVE
// SPDX-License-Identifier: Apache-2.0
import { RequestHandler } from "express"

const formActionSources = (env: NodeJS.ProcessEnv): string => {
  const sources = ["'self'"]
  if (env.KRATOS_BROWSER_URL) {
    let url: URL
    try {
      url = new URL(env.KRATOS_BROWSER_URL)
    } catch {
      throw new Error("KRATOS_BROWSER_URL must use http or https")
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("KRATOS_BROWSER_URL must use http or https")
    }
    sources.push(url.origin)
  }
  return sources.join(" ")
}

export const securityHeaders = (
  env: NodeJS.ProcessEnv = process.env,
): RequestHandler => {
  const formAction = formActionSources(env)
  const basePath = (env.BASE_PATH || "").replace(/\/+$/, "")
  const consentPath = `${basePath}/consent`.toLowerCase()
  return (req, res, next) => {
    const requestPath = req.path.toLowerCase()
    const isConsent =
      requestPath === consentPath || requestPath === `${consentPath}/`
    const formActionDirective = isConsent ? "" : `; form-action ${formAction}`
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'${formActionDirective}`,
    )
    res.setHeader("Referrer-Policy", "no-referrer")
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    )
    next()
  }
}
