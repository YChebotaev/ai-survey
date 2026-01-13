import pino from "pino";
import { createApp, createDb } from "./index";
import { env } from "./src/lib/env";

createDb().then((db) => {
  return createApp({
    db,
    logger: pino(),
  }).then((app) => {
    app.start({ host: env.HOST, port: env.PORT });
  });
});
