import fastify, { type FastifyInstance } from "fastify";
import helmetPlugin from "@fastify/helmet";
import corsPlugin from "@fastify/cors";
import swaggerPlugin from "@fastify/swagger";
import swaggerUiPlugin from "@fastify/swagger-ui";
import type { Logger } from "pino";
import type { Runnable } from "../types";
import { plugins } from "./fastify";
import {
  IamService,
  InviteService,
  ProjectsService,
  SurveySessionService,
  AiService,
} from "../services";
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
} from "../repositories";

export type AppStartArgs = [{ host: string; port: number }];

export type AppConfig = {
  trustProxy: boolean;
  helmet?: boolean;
  cors?: boolean;
  swagger?: boolean;
  logger: Logger;
  accountsRepository: AccountsRepository;
  usersRepository: UsersRepository;
  accountMembershipsRepository: AccountMembershipsRepository;
  accountInvitesRepository: AccountInvitesRepository;
  projectsRepository: ProjectsRepository;
  projectMembershipsRepository: ProjectMembershipsRepository;
  surveysRepository: SurveysRepository;
  questionTemplatesRepository: QuestionTemplatesRepository;
  surveySessionsRepository: SurveySessionsRepository;
  sessionQuestionsRepository: SessionQuestionsRepository;
  sessionAnswersRepository: SessionAnswersRepository;
  sessionReportsRepository: SessionReportsRepository;
};

export class App implements Runnable<AppStartArgs, []> {
  public readonly fastify: FastifyInstance;
  private readonly logger: Logger;
  private readonly _ready: Promise<void>;

  public runState: Runnable["runState"] = "created";

  constructor(config: AppConfig) {
    const { trustProxy, logger } = config;

    this.fastify = fastify({
      trustProxy,
      loggerInstance: logger as any,
    });

    this.logger = logger;
    this._ready = this.initialize(config);
  }

  public get ready() {
    return this._ready;
  }

  async start({ host, port }: AppStartArgs[0]) {
    try {
      await this._ready;

      this.runState = "starting";

      this.logger.info("Starting app...");

      const address = await this.fastify.listen({ host, port });

      this.runState = "running";

      this.logger.info(`App is running on ${address}`);
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to start app");

      throw error;
    }
  }

  async stop() {
    this.logger.info("Stopping app...");

    try {
      await this._ready;

      this.runState = "stopping";

      await this.fastify.close();

      this.runState = "stopped";

      this.logger.info("App stopped");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to stop app");

      throw error;
    }
  }

  private async initialize(config: AppConfig) {
    try {
      this.runState = "initializing";

      this.logger.info("Initializing app...");

      await this.initializePre(config);
      await this.initializePlugins(config);
      await this.initializePost(config);

      this.runState = "initialized";

      this.logger.info("App initialized");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to initialize app");

      throw error;
    }
  }

  private async initializePre({
    helmet,
    cors,
    swagger,
  }: Pick<AppConfig, "helmet" | "cors" | "swagger">) {
    if (helmet) {
      await this.fastify.register(helmetPlugin);
    }

    if (cors) {
      await this.fastify.register(corsPlugin, { origin: "*" });
    }

    if (swagger) {
      await this.fastify.register(swaggerPlugin, {
        swagger: {
          info: { title: "API", version: "1.0.0" },
        },
      });
    }
  }

  private async initializePlugins(config: AppConfig) {
    const {
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
      logger,
    } = config;

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

    const aiService = new AiService({
      logger,
    });

    const surveySessionService = new SurveySessionService({
      surveysRepository,
      questionTemplatesRepository,
      surveySessionsRepository,
      sessionQuestionsRepository,
      sessionAnswersRepository,
      sessionReportsRepository,
      aiService,
      logger,
    });

    await this.fastify.register(plugins.iamPlugin as any, {
      iamService,
      logger,
    });

    await this.fastify.register(plugins.projectsPlugin as any, {
      projectsService,
      logger,
    });

    await this.fastify.register(plugins.surveyPlugin as any, {
      surveySessionService,
      aiService,
      logger,
    });
  }

  private async initializePost({ swagger }: Pick<AppConfig, "swagger">) {
    if (swagger) {
      await this.fastify.register(swaggerUiPlugin, {
        routePrefix: "/docs",
      });
    }
  }
}
