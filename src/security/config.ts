// Copyright © 2026 VKWAVE
// SPDX-License-Identifier: Apache-2.0
export interface SecurityConfig {
  production: boolean
  secureCookies: boolean
  cookieSecret: string
  csrfCookieSecret: string
  csrfCookieName: string
}

export const loadSecurityConfig = (
  env: NodeJS.ProcessEnv = process.env,
): SecurityConfig => {
  const production = env.NODE_ENV === "production"
  const allowInsecure = env.AUTH_UI_ALLOW_INSECURE_DEV === "true"
  if (
    env.AUTH_UI_ALLOW_INSECURE_DEV !== undefined &&
    !["true", "false"].includes(env.AUTH_UI_ALLOW_INSECURE_DEV)
  ) {
    throw new Error("AUTH_UI_ALLOW_INSECURE_DEV must be true or false")
  }
  if (production && allowInsecure) {
    throw new Error("insecure development cookies are forbidden in production")
  }

  const cookieSecret = env.COOKIE_SECRET ?? ""
  const csrfCookieSecret = env.CSRF_COOKIE_SECRET ?? ""
  const csrfCookieName = env.CSRF_COOKIE_NAME ?? ""
  if (cookieSecret.length < 32 || csrfCookieSecret.length < 32) {
    throw new Error("cookie secrets must contain at least 32 characters")
  }
  if (!csrfCookieName) {
    throw new Error("CSRF_COOKIE_NAME is required")
  }
  if (production && !csrfCookieName.startsWith("__Host-")) {
    throw new Error("production CSRF cookie must use the __Host- prefix")
  }

  return {
    production,
    secureCookies: production || !allowInsecure,
    cookieSecret,
    csrfCookieSecret,
    csrfCookieName,
  }
}
