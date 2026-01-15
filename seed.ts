import pino from "pino";
import { createDb } from "./index";
import {
  AccountsRepository,
  UsersRepository,
  AccountMembershipsRepository,
  ProjectsRepository,
  ProjectMembershipsRepository,
  SurveysRepository,
  QuestionTemplatesRepository,
} from "./src/lib/repositories";
import { IamService, ProjectsService } from "./src/lib/services";

const logger = pino();

const EXTERNAL_ID = "demo-survey";

const seed = async () => {
  try {
    logger.info("Starting seed process");

    const db = await createDb();
    logger.info("Database initialized");

    // Check if survey already exists
    const existingSurvey = await db("surveys")
      .where({ externalId: EXTERNAL_ID, deleted: false })
      .first();

    if (existingSurvey) {
      logger.info({ externalId: EXTERNAL_ID }, "Survey already exists, skipping seed");
      await db.destroy();
      return;
    }

    // Initialize repositories
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

    const projectsRepository = new ProjectsRepository({
      tableName: "projects",
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

    // Initialize services
    const iamService = new IamService({
      accountsRepository,
      usersRepository,
      accountMembershipsRepository,
      logger,
    });

    const projectMembershipsRepository = new ProjectMembershipsRepository({
      tableName: "project_memberships",
      db,
      logger,
    });

    const projectsService = new ProjectsService({
      projectsRepository,
      projectMembershipsRepository,
      surveysRepository,
      questionTemplatesRepository,
      logger,
    });

    await iamService.ready;
    await projectsService.ready;

    // Create account
    const account = await iamService.createAccount({ name: "Demo Account" });
    logger.info({ accountId: account.id }, "Account created");

    // Create user
    const user = await iamService.createUser({
      name: "Demo User",
      email: "demo@example.com",
      passwordHash: "password123", // Placeholder
      passwordSalt: "", // Placeholder
    });
    logger.info({ userId: user.id }, "User created");

    // Join user to account
    const membership = await iamService.joinUserToAccount({
      accountId: account.id,
      userId: user.id,
    });
    logger.info({ membershipId: membership.id }, "User joined to account");

    // Create project
    const project = await projectsService.createProject({
      accountId: account.id,
      name: "Demo Project",
    });
    logger.info({ projectId: project.id }, "Project created");

    // Create survey with questions
    const survey = await projectsService.createSurvey({
      accountId: account.id,
      projectId: project.id,
      externalId: EXTERNAL_ID,
      questionTemplates: [
        {
          order: 1,
          dataKey: "name",
          questionTemplate: "What is your name?",
          successTemplate: "Thank you!",
          failTemplate: "Please provide your name.",
          final: false,
          type: "freeform",
        },
        {
          order: 2,
          dataKey: "email",
          questionTemplate: "What is your email?",
          successTemplate: "Great!",
          failTemplate: "Please provide a valid email.",
          final: false,
          type: "freeform",
        },
        {
          order: 3,
          dataKey: "feedback",
          questionTemplate: "Any feedback?",
          successTemplate: "Thank you for your feedback!",
          failTemplate: "Please provide feedback.",
          final: true,
          type: "freeform",
        },
      ],
    });
    logger.info({ surveyId: survey.id, externalId: EXTERNAL_ID }, "Survey created");

    logger.info("Seed completed successfully");
    logger.info({ externalId: EXTERNAL_ID }, "Demo survey is ready");

    await db.destroy();
  } catch (error: any) {
    logger.error(error, "Seed failed");
    process.exit(1);
  }
};

seed();
