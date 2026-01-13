import path from "path";
import type { Logger } from "pino";
import { App } from "./src/lib/app/App";
import knex, { type Knex } from "knex";

export const createDb = async () => {
  const k = knex({
    client: "sqlite3",
    connection: {
      filename: path.join(__dirname, "data/db.sqlite"),
    },
    useNullAsDefault: true,
  });

  await k.migrate.up({
    directory: path.join(__dirname, "src/lib/migrations"),
  });

  return k;
};

export const createApp = async ({
  db,
  logger,
}: {
  db: Knex;
  logger: Logger;
}) => {
  const app = new App({
    trustProxy: true,
    helmet: true,
    cors: true,
    swagger: true,
    logger,
  });

  await app.ready;

  return app;
};
