// Copyright © 2023 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import {
  defaultConfig,
  logger,
  RouteCreator,
  RouteRegistrator,
  setSession,
} from "../pkg"
import { oidcConformityMaybeFakeSession } from "./stub/oidc-cert"
import {
  AcceptOAuth2ConsentRequestSession,
  OAuth2ConsentRequest,
} from "@ory/client"
import { UserConsentCard } from "@ory/elements-markup"
import { Request, Response, NextFunction } from "express"

// Parses a comma-separated env var into a list of trait names to propagate
// from `identity.traits` into the corresponding session token map.
const parseTraitList = (raw: string | undefined): string[] => {
  if (!raw) {
    return []
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export const extractSession = (
  req: Request,
  grantScope: string[],
): AcceptOAuth2ConsentRequestSession => {
  const session: AcceptOAuth2ConsentRequestSession = {
    access_token: {},
    id_token: {},
  }

  const identity = req.session?.identity
  if (!identity) {
    return session
  }

  const traits =
    identity.traits && typeof identity.traits === "object"
      ? (identity.traits as Record<string, unknown>)
      : {}
  const safe: Record<string, unknown> = {}
  if (grantScope.includes("email")) {
    const email = identity.verifiable_addresses?.find(
      (address) => address.via === "email",
    )
    if (email) {
      safe.email = email.value
      safe.email_verified = email.verified
    }
  }

  if (grantScope.includes("profile")) {
    if (typeof traits.username === "string") {
      safe.preferred_username = traits.username
    }
    if (typeof traits.website === "string") {
      safe.website = traits.website
    }
    if (typeof traits.name === "string") {
      safe.name = traits.name
    } else if (traits.name && typeof traits.name === "object") {
      const name = traits.name as { first?: unknown; last?: unknown }
      if (typeof name.first === "string") safe.given_name = name.first
      if (typeof name.last === "string") safe.family_name = name.last
    }
    if (identity.updated_at) {
      const updatedAt = Date.parse(identity.updated_at)
      if (Number.isFinite(updatedAt)) {
        safe.updated_at = Math.floor(updatedAt / 1000)
      }
    }
  }
  Object.assign(session.id_token, safe)
  Object.assign(session.access_token, safe)

  const reserved = new Set([
    "sub",
    "iss",
    "aud",
    "exp",
    "iat",
    "client_id",
    "scope",
    "metadata_admin",
    "credentials",
    "__proto__",
    "constructor",
    "prototype",
  ])
  const copyAllowedTraits = (
    target: Record<string, unknown>,
    rawNames: string | undefined,
  ): void => {
    for (const name of parseTraitList(rawNames)) {
      if (
        reserved.has(name) ||
        Object.prototype.hasOwnProperty.call(target, name)
      ) {
        continue
      }
      if (Object.prototype.hasOwnProperty.call(traits, name)) {
        target[name] = traits[name]
      }
    }
  }
  copyAllowedTraits(
    session.id_token as Record<string, unknown>,
    process.env.SESSION_EXTRA_TRAITS_ID_TOKEN,
  )
  copyAllowedTraits(
    session.access_token as Record<string, unknown>,
    process.env.SESSION_EXTRA_TRAITS_ACCESS_TOKEN,
  )

  return session
}

export interface ConsentViewModel {
  clientName: string
  clientId: string
  redirectHosts: string[]
  scopes: string[]
  resources: string[]
  localhostWarning: boolean
}

export const consentViewModel = (
  request: OAuth2ConsentRequest,
): ConsentViewModel => {
  const redirectHosts = (request.client?.redirect_uris ?? []).flatMap((uri) => {
    try {
      return [new URL(uri).host]
    } catch {
      return []
    }
  })
  return {
    clientName:
      request.client?.client_name ||
      request.client?.client_id ||
      "Unknown client",
    clientId: request.client?.client_id || "",
    redirectHosts,
    scopes: request.requested_scope ?? [],
    resources: request.requested_access_token_audience ?? [],
    localhostWarning: redirectHosts.some((host) =>
      /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host),
    ),
  }
}

// A simple express handler that shows the Hydra consent screen.
export const createConsentRoute: RouteCreator =
  (createHelpers) =>
  async (req: Request, res: Response, next: NextFunction) => {
    res.locals.projectName = "Consent"

    const {
      oauth2,
      isOAuthConsentRouteEnabled,
      shouldSkipConsent: canSkipConsent,
      logoUrl,
    } = createHelpers(req, res)

    if (!isOAuthConsentRouteEnabled()) {
      res.redirect("404")
      return
    }

    const { consent_challenge } = req.query

    // The challenge is used to fetch information about the consent request from ORY hydraAdmin.
    const challenge = String(consent_challenge)
    if (!challenge) {
      next(
        new Error("Expected a consent challenge to be set but received none."),
      )
      return
    }

    // This section processes consent requests and either shows the consent UI or
    // accepts the consent request right away if the user has given consent to this
    // app before
    await oauth2
      .getOAuth2ConsentRequest({ consentChallenge: challenge })
      // This will be called if the HTTP request was successful
      .then(async ({ data: body }) => {
        // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
        if (canSkipConsent(body)) {
          logger.debug("Skipping consent request and accepting it.")
          let grantScope = body.requested_scope || []
          const session = extractSession(req, grantScope)

          // Now it's time to grant the consent request. You could also deny the request if something went terribly wrong
          await oauth2
            .acceptOAuth2ConsentRequest({
              consentChallenge: challenge,
              acceptOAuth2ConsentRequest: {
                // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
                // are requested accidentally.
                grant_scope: grantScope,

                // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
                grant_access_token_audience:
                  body.requested_access_token_audience,

                // The session allows us to set session data for id and access tokens
                session,
              },
            })
            .then(({ data: body }) => {
              logger.debug("Consent request successfuly accepted")
              // All we need to do now is to redirect the user back to hydra!
              res.redirect(String(body.redirect_to))
            })
            .catch(next)
          return
        }

        // this should never happen
        if (!req.csrfToken) {
          logger.warn(
            "Expected CSRF token middleware to be set but received none.",
          )
          next(
            new Error(
              "Expected CSRF token middleware to be set but received none.",
            ),
          )
          return
        }

        // If consent can't be skipped we MUST show the consent UI.
        res.render("consent", {
          consent: consentViewModel(body),
          card: UserConsentCard({
            consent: body,
            csrfToken: req.csrfToken(true),
            cardImage: body.client?.logo_uri || logoUrl,
            client_name:
              body.client?.client_name ||
              body.client?.client_id ||
              "Unknown Client",
            requested_scope: body.requested_scope || [],
            client: body.client,
            action: "consent",
          }),
        })
      })
      // This will handle any error that happens when making HTTP calls to hydra
      .catch(next)
    // The consent request has now either been accepted automatically or rendered.
  }

export const createConsentPostRoute: RouteCreator =
  (createHelpers) => async (req, res, next) => {
    res.locals.projectName = "Consent"
    // The challenge is a hidden input field, so we have to retrieve it from the request body
    const { oauth2, isOAuthConsentRouteEnabled } = createHelpers(req, res)

    if (!isOAuthConsentRouteEnabled()) {
      res.redirect("404")
      return
    }

    const {
      consent_challenge: challenge,
      consent_action,
      remember,
      grant_scope,
    } = req.body

    let grantScope = grant_scope
    if (!Array.isArray(grantScope)) {
      grantScope = [grantScope]
    }
    // extractSession only gets the sesseion data from the request
    // You can extract more data from the Ory Identities admin API
    const session = extractSession(req, grantScope)

    // Let's fetch the consent request again to be able to set `grantAccessTokenAudience` properly.
    // Let's see if the user decided to accept or reject the consent request..
    if (consent_action === "accept") {
      logger.debug("Consent request was accepted by the user")
      await oauth2
        .getOAuth2ConsentRequest({
          consentChallenge: String(challenge),
        })
        .then(async ({ data: body }) => {
          return oauth2
            .acceptOAuth2ConsentRequest({
              consentChallenge: String(challenge),
              acceptOAuth2ConsentRequest: {
                // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
                // are requested accidentally.
                grant_scope: grantScope,

                // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
                // the app is built for the automated OpenID Connect Conformity Test Suite. You
                // can peak inside the code for some ideas, but be aware that all data is fake
                // and this only exists to fake a login system which works in accordance to OpenID Connect.
                //
                // If that variable is not set, the session will be used as-is.
                session: oidcConformityMaybeFakeSession(grantScope, session),

                // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
                grant_access_token_audience:
                  body.requested_access_token_audience,

                // This tells hydra to remember this consent request and allow the same client to request the same
                // scopes from the same user, without showing the UI, in the future.
                remember: Boolean(remember),

                // When this "remember" sesion expires, in seconds. Set this to 0 so it will never expire.
                remember_for: process.env.REMEMBER_CONSENT_SESSION_FOR_SECONDS
                  ? Number(process.env.REMEMBER_CONSENT_SESSION_FOR_SECONDS)
                  : 3600,
              },
            })
            .then(({ data: body }) => {
              const redirectTo = String(body.redirect_to)
              logger.debug("Consent request successfuly accepted", redirectTo)
              // All we need to do now is to redirect the user back!
              res.redirect(redirectTo)
            })
        })
        .catch(next)
      return
    }

    logger.debug("Consent request denied by the user")

    // Looks like the consent request was denied by the user
    await oauth2
      .rejectOAuth2ConsentRequest({
        consentChallenge: String(challenge),
        rejectOAuth2Request: {
          error: "access_denied",
          error_description: "The resource owner denied the request",
        },
      })
      .then(({ data: body }) => {
        // All we need to do now is to redirect the browser back to hydra!
        res.redirect(String(body.redirect_to))
      })
      // This will handle any error that happens when making HTTP calls to hydra
      .catch(next)
  }

export const registerConsentRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
) => {
  app.get(
    "/consent",
    setSession(createHelpers),
    createConsentRoute(createHelpers),
  )
  app.post(
    "/consent",
    setSession(createHelpers),
    createConsentPostRoute(createHelpers),
  )
}
