import { cleanEnv, str, port } from "envalid";

export const env = cleanEnv(process.env, {
  HOST: str({ default: "0.0.0.0" }),
  PORT: port({ default: 3000 }),
  AI_MODEL: str({ default: "dummy", choices: ["dummy", "yandex"] }),
  YANDEX_CLOUD_FOLDER: str({ default: '' }),
  YANDEX_CLOUD_API_KEY: str({ default: '' }),
  YANDEX_CLOUD_MODEL: str({ default: 'yandexgpt/latest' }),
});
