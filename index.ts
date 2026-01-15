import path from "path";
import { mkdirSync } from "fs";
import type { Logger } from "pino";
import { App } from "./src/lib/app/App";
import knex, { type Knex } from "knex";
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
  SessionQuestionsRepository,
  SessionAnswersRepository,
  SessionReportsRepository,
} from "./src/lib/repositories";

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

    await k.migrate.up({
      directory: path.join(process.cwd(), "src/lib/migrations"),
    });

    return k;
  } catch (error: any) {
    throw new Error(`Failed to initialize database at ${dbPath}: ${error.message}`);
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

  const sessionQuestionsRepository = new SessionQuestionsRepository({
    tableName: "session_questions",
    db,
    logger,
  });

  const sessionAnswersRepository = new SessionAnswersRepository({
    tableName: "session_answers",
    db,
    logger,
  });

  const sessionReportsRepository = new SessionReportsRepository({
    tableName: "session_reports",
    db,
    logger,
  });

  const app = new App({
    trustProxy: true,
    helmet: true,
    cors: true,
    swagger: true,
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
    sessionQuestionsRepository,
    sessionAnswersRepository,
    sessionReportsRepository,
  });

  await app.ready;

  return app;
};
