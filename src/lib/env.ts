import { cleanEnv, str, port } from "envalid";

export const env = cleanEnv(process.env, {
  HOST: str({ default: "0.0.0.0" }),
  PORT: port({ default: 3000 }),
});
