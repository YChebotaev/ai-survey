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
  SessionMessagesRepository,
  SessionReportsRepository,
} from "../repositories";

export type AppStartArgs = [{ host: string; port: number }];

export type AppConfig = {
  trustProxy: boolean;
  helmet?: boolean;
  cors?: boolean;
  swagger?: boolean;
  useDemo?: boolean;
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
  sessionMessagesRepository: SessionMessagesRepository;
  sessionReportsRepository: SessionReportsRepository;
  iamService: IamService;
  inviteService: InviteService;
  projectsService: ProjectsService;
  aiService: AiService;
  surveySessionService: SurveySessionService;
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

      await this.fastify.listen({ host, port });

      this.runState = "running";

      this.logger.info(`App is running on http://${host}:${port}`);
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
      iamService,
      projectsService,
      aiService,
      surveySessionService,
      useDemo,
      logger,
    } = config;

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

    if (useDemo) {
      await this.fastify.register(plugins.demoPlugin as any, {
        surveySessionService,
        logger,
      });
    }
  }

  private async initializePost({ swagger }: Pick<AppConfig, "swagger">) {
    if (swagger) {
      await this.fastify.register(swaggerUiPlugin, {
        routePrefix: "/docs",
      });
    }
  }
}
