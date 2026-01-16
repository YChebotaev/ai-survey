import path from "path";
import { mkdirSync, existsSync } from "fs";
import type { Logger } from "pino";
import { App } from "./src/lib/app/App";
import knex, { type Knex } from "knex";
import { env } from "./src/lib/env";
import {
  AccountsRepository,
  UsersRepository,
  AccountMembershipsRepository,
  AccountInvitesRepository,
  ProjectsRepository,
  ProjectMembershipsRepository,
  SurveysRepository,
  QuestionTemplatesRepository,
  SurveySessionsRepository,
  SessionMessagesRepository,
  SessionReportsRepository,
} from "./src/lib/repositories";
import {
  IamService,
  InviteService,
  ProjectsService,
  SurveySessionService,
  AiService,
  DummyImpl,
  YandexImpl,
} from "./src/lib/services";

export const createDb = async () => {
  // Use process.cwd() for ts-node compatibility
  const dbPath = path.join(process.cwd(), "data/db.sqlite");
  const dbDir = path.dirname(dbPath);

  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error: any) {
    throw new Error(`Failed to create database directory at ${dbDir}: ${error.message}`);
  }

  try {
    const k = knex({
      client: "sqlite3",
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
    });

    // Enable foreign keys for SQLite
    await k.raw("PRAGMA foreign_keys = ON");

    // In production (compiled), migrations are in dist/src/lib/migrations
    // In development, they're in src/lib/migrations
    const distMigrationsPath = path.join(process.cwd(), "dist/src/lib/migrations");
    const srcMigrationsPath = path.join(process.cwd(), "src/lib/migrations");
    const migrationDir = existsSync(distMigrationsPath) ? distMigrationsPath : srcMigrationsPath;
    
    if (!existsSync(migrationDir)) {
      throw new Error(`Migration directory not found: ${migrationDir}`);
    }
    
    // Use migrate.latest() to run ALL pending migrations (not just one)
    await k.migrate.latest({
      directory: migrationDir,
    });

    return k;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || "";
    throw new Error(`Failed to initialize database at ${dbPath}: ${errorMessage}${errorStack ? `\n${errorStack}` : ""}`);
  }
};

export const createApp = async ({
  db,
  logger,
}: {
  db: Knex;
  logger: Logger;
}) => {
  const accountsRepository = new AccountsRepository({
    tableName: "accounts",
    db,
    logger,
  });

  const usersRepository = new UsersRepository({
    tableName: "users",
    db,
    logger,
  });

  const accountMembershipsRepository = new AccountMembershipsRepository({
    tableName: "account_memberships",
    db,
    logger,
  });

  const accountInvitesRepository = new AccountInvitesRepository({
    tableName: "account_invites",
    db,
    logger,
  });

  const projectsRepository = new ProjectsRepository({
    tableName: "projects",
    db,
    logger,
  });

  const projectMembershipsRepository = new ProjectMembershipsRepository({
    tableName: "project_memberships",
    db,
    logger,
  });

  const surveysRepository = new SurveysRepository({
    tableName: "surveys",
    db,
    logger,
  });

  const questionTemplatesRepository = new QuestionTemplatesRepository({
    tableName: "question_templates",
    db,
    logger,
  });

  const surveySessionsRepository = new SurveySessionsRepository({
    tableName: "survey_sessions",
    db,
    logger,
  });

  const sessionMessagesRepository = new SessionMessagesRepository({
    tableName: "session_messages",
    db,
    logger,
  });

  const sessionReportsRepository = new SessionReportsRepository({
    tableName: "session_reports",
    db,
    logger,
  });

  const iamService = new IamService({
    accountsRepository,
    usersRepository,
    accountMembershipsRepository,
    logger,
  });

  const inviteService = new InviteService({
    accountInvitesRepository,
    logger,
  });

  const projectsService = new ProjectsService({
    projectsRepository,
    projectMembershipsRepository,
    surveysRepository,
    questionTemplatesRepository,
    logger,
  });

  let aiImpl;

  if (env.AI_MODEL === "yandex") {
    if (!env.YANDEX_CLOUD_FOLDER || !env.YANDEX_CLOUD_API_KEY) {
      throw new Error(
        "YANDEX_CLOUD_FOLDER and YANDEX_CLOUD_API_KEY must be set when AI_MODEL is 'yandex'",
      );
    }

    aiImpl = new YandexImpl({
      yandexCloudFolder: env.YANDEX_CLOUD_FOLDER,
      yandexCloudApiKey: env.YANDEX_CLOUD_API_KEY,
      yandexCloudModel: env.YANDEX_CLOUD_MODEL,
      logger,
    });
  } else {
    aiImpl = new DummyImpl({ logger });
  }

  const aiService = new AiService({
    impl: aiImpl,
    logger,
  });

  const surveySessionService = new SurveySessionService({
    surveysRepository,
    questionTemplatesRepository,
    surveySessionsRepository,
    sessionMessagesRepository,
    sessionReportsRepository,
    aiService,
    logger,
  });

  const app = new App({
    trustProxy: true,
    helmet: true,
    cors: true,
    swagger: true,
    useDemo: env.USE_DEMO,
    logger,
    accountsRepository,
    usersRepository,
    accountMembershipsRepository,
    accountInvitesRepository,
    projectsRepository,
    projectMembershipsRepository,
    surveysRepository,
    questionTemplatesRepository,
    surveySessionsRepository,
    sessionMessagesRepository,
    sessionReportsRepository,
    iamService,
    inviteService,
    projectsService,
    aiService,
    surveySessionService,
  });

  await app.ready;

  return app;
};
