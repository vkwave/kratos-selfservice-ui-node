# Production security contract

This fork keeps the official Ory Kratos and Hydra browser-flow semantics while
shipping VKWAVE-owned templates, assets, hardening, and release automation.

## Required runtime configuration

- `KRATOS_PUBLIC_URL`: private Kratos public API URL used by the server.
- `KRATOS_BROWSER_URL`: browser-visible Kratos URL.
- `HYDRA_ADMIN_URL`: private Hydra admin API URL used only by the consent
  backend.
- `COOKIE_SECRET`: at least 32 characters.
- `CSRF_COOKIE_NAME`: a host-only `__Host-` name in production, for example
  `__Host-vkwave_csrf`.
- `CSRF_COOKIE_SECRET`: at least 32 characters.
- `PORT`: container listener, normally `3000`.
- `NODE_ENV`: `production` for production images.
- `AUTH_UI_ALLOW_INSECURE_DEV`: must be `false` in production. `true` is
  accepted only with a non-production `NODE_ENV` for local HTTP development.

The service fails during startup when secrets are weak, production cookies are
not host-prefixed, or insecure development cookies are enabled in production.

## Image and filesystem policy

Production must consume `ghcr.io/vkwave/kratos-selfservice-ui-node` by tag and
immutable digest. Operators must not replace or bind-mount `public/`, `views/`,
or compiled `lib/` at runtime. Branding and behavior changes are source changes
that pass review, CI, image signing, SBOM generation, and provenance generation.

The runtime user is UID/GID `10001`, the image contains production dependencies
only, and TLS is normally terminated by the auth-stack Nginx router.

## Token and logging policy

Standard email/profile claims are copied only when their scopes are granted.
Additional identity traits require an explicit operator allowlist. Reserved
claims, credential data, `metadata_admin`, and prototype-related keys are never
copied. Browser request logs omit query strings, headers, cookies, and bodies;
public error pages expose only a random request ID.
