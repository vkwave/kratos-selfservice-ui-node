// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import * as fs from "fs"
import { createServer } from "http"
import * as https from "https"
import { createApp } from "./app"
import { logger } from "./pkg/logger"

const listener = (port: number, proto: "http" | "https") => () => {
  logger.info(`Listening on ${proto}://0.0.0.0:${port}`)
}

export const startServer = (env: NodeJS.ProcessEnv = process.env): void => {
  const port = Number(env.PORT) || 3000
  const app = createApp(env)
  if (env.TLS_CERT_PATH?.length && env.TLS_KEY_PATH?.length) {
    https
      .createServer(
        {
          cert: fs.readFileSync(env.TLS_CERT_PATH),
          key: fs.readFileSync(env.TLS_KEY_PATH),
        },
        app,
      )
      .listen(port, listener(port, "https"))
    return
  }

  createServer(app).listen(port, listener(port, "http"))
}

if (require.main === module) {
  startServer()
}
