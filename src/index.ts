// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import * as fs from "fs"
import { createServer } from "http"
import * as https from "https"
import { Server } from "net"
import { createApp } from "./app"
import { logger } from "./pkg/logger"

export const parsePort = (value: string | undefined): number => {
  if (value === undefined || value === "") return 3000
  if (!/^\d+$/.test(value)) throw new Error("PORT must be an integer")
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be between 0 and 65535")
  }
  return port
}

export interface TLSPaths {
  certPath: string
  keyPath: string
}

export const parseTLSPaths = (
  env: NodeJS.ProcessEnv = process.env,
): TLSPaths | undefined => {
  const certPath = env.TLS_CERT_PATH?.trim()
  const keyPath = env.TLS_KEY_PATH?.trim()
  if ((certPath && !keyPath) || (!certPath && keyPath)) {
    throw new Error("TLS_CERT_PATH and TLS_KEY_PATH must be provided together")
  }
  return certPath && keyPath ? { certPath, keyPath } : undefined
}

const listener = (server: Server, proto: "http" | "https") => () => {
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : "unknown"
  logger.info(`Listening on ${proto}://0.0.0.0:${port}`)
}

export const startServer = (env: NodeJS.ProcessEnv = process.env): Server => {
  const port = parsePort(env.PORT)
  const tls = parseTLSPaths(env)
  const app = createApp(env)
  if (tls) {
    const server = https.createServer(
      {
        cert: fs.readFileSync(tls.certPath),
        key: fs.readFileSync(tls.keyPath),
      },
      app,
    )
    server.listen(port, listener(server, "https"))
    return server
  }

  const server = createServer(app)
  server.listen(port, listener(server, "http"))
  return server
}

if (require.main === module) {
  startServer()
}
