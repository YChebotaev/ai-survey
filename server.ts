import os from "os";
import pino from "pino";
import { createApp, createDb } from "./index";
import { env } from "./src/lib/env";

const originalNetworkInterfaces = os.networkInterfaces;
os.networkInterfaces = () => {
  try {
    return originalNetworkInterfaces();
  } catch (error: any) {
    if (
      error?.code === "ERR_SYSTEM_ERROR" &&
      error?.info?.syscall === "uv_interface_addresses"
    ) {
      return {};
    }
    throw error;
  }
};

const logger = pino();

createDb()
  .then((db) => {
    return createApp({
      db,
      logger,
    }).then((app) => {
      app.start({ host: env.HOST, port: env.PORT });
    });
  })
  .catch((error) => {
    logger.error(error, "Failed to start application");
    process.exit(1);
  });
