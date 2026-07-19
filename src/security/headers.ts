// Copyright © 2026 VKWAVE
// SPDX-License-Identifier: Apache-2.0
import { RequestHandler } from "express"

export const securityHeaders = (): RequestHandler => (_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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
