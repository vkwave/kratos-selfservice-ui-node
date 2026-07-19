FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS dependencies

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --fetch-timeout=600000

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build

ARG LINK=no
WORKDIR /usr/src/app
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY contrib/sdk ./contrib/sdk
COPY src ./src
COPY types ./types
RUN if [ "$LINK" = "true" ]; then \
      test -f ./contrib/sdk/generated/package.json; \
      (cd ./contrib/sdk/generated && npm ci && npm run build); \
      rm -rf node_modules/@ory/client/*; \
      cp -r ./contrib/sdk/generated/* node_modules/@ory/client/; \
    fi && \
    npm run build && \
    npm prune --omit=dev

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime

ENV NODE_ENV=production
WORKDIR /usr/src/app
RUN addgroup -S -g 10001 vkwave && \
    adduser -S -D -H -u 10001 -G vkwave vkwave

COPY --from=build --chown=10001:10001 /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /usr/src/app/lib ./lib
COPY --chown=10001:10001 package.json package-lock.json ./
COPY --chown=10001:10001 public ./public
COPY --chown=10001:10001 views ./views

USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -q -O - http://127.0.0.1:3000/health/alive >/dev/null || exit 1
CMD ["node", "lib/index.js"]
