import { type Logger } from "pino";
import { ServiceBase } from "./ServiceBase";
import type { SupportedLanguage } from "../types";
import {
  ProjectsRepository,
  ProjectMembershipsRepository,
  SurveysRepository,
  QuestionTemplatesRepository,
  type Project,
  type ProjectMembership,
  type Survey,
  type QuestionTemplate,
} from "../repositories";

export type ProjectsServiceConfig = {
  projectsRepository: ProjectsRepository;
  projectMembershipsRepository: ProjectMembershipsRepository;
  surveysRepository: SurveysRepository;
  questionTemplatesRepository: QuestionTemplatesRepository;
  logger: Logger;
};

export type CreateProjectArgs = {
  accountId: number;
  name: string;
};

export type JoinUserToProjectArgs = {
  accountId: number;
  userId: number;
  projectId: number;
  role?: string;
};

export type CreateSurveyArgs = {
  accountId: number;
  projectId: number;
  externalId: string;
  lang?: SupportedLanguage;
  questionTemplates: Array<{
    order: number;
    dataKey: string;
    questionTemplate: string;
    successTemplate: string;
    failTemplate: string;
    final: boolean;
    type?: string;
  }>;
};

export class ProjectsService extends ServiceBase<ProjectsServiceConfig> {
  private readonly projectsRepository: ProjectsRepository;
  private readonly projectMembershipsRepository: ProjectMembershipsRepository;
  private readonly surveysRepository: SurveysRepository;
  private readonly questionTemplatesRepository: QuestionTemplatesRepository;

  constructor({
    projectsRepository,
    projectMembershipsRepository,
    surveysRepository,
    questionTemplatesRepository,
    logger,
  }: ProjectsServiceConfig) {
    super(logger, {
      projectsRepository,
      projectMembershipsRepository,
      surveysRepository,
      questionTemplatesRepository,
      logger,
    });

    this.projectsRepository = projectsRepository;
    this.projectMembershipsRepository = projectMembershipsRepository;
    this.surveysRepository = surveysRepository;
    this.questionTemplatesRepository = questionTemplatesRepository;
  }

  public async createProject({
    accountId,
    name,
  }: CreateProjectArgs): Promise<Project> {
    try {
      this.logger.info({ accountId, name }, "Creating project");

      const project = await this.projectsRepository.create({ accountId, name });

      if (!project) {
        throw new Error("Failed to create project");
      }

      this.logger.info({ projectId: project.id }, "Project created");

      return project;
    } catch (error) {
      this.logger.error(error, "Failed to create project");

      throw error;
    }
  }

  public async joinUserToProject({
    accountId,
    userId,
    projectId,
    role = "admin",
  }: JoinUserToProjectArgs): Promise<ProjectMembership> {
    try {
      this.logger.info(
        { accountId, userId, projectId, role },
        "Joining user to project",
      );

      const membership = await this.projectMembershipsRepository.create({
        accountId,
        userId,
        projectId,
        role,
      });

      if (!membership) {
        throw new Error("Failed to create project membership");
      }

      this.logger.info({ membershipId: membership.id }, "User joined to project");

      return membership;
    } catch (error) {
      this.logger.error(error, "Failed to join user to project");

      throw error;
    }
  }

  public async createSurvey({
    accountId,
    projectId,
    externalId,
    lang = "en",
    questionTemplates,
  }: CreateSurveyArgs): Promise<Survey> {
    try {
      this.logger.info(
        { accountId, projectId, externalId, lang, questionCount: questionTemplates.length },
        "Creating survey",
      );

      const survey = await this.surveysRepository.create({
        accountId,
        projectId,
        externalId,
        lang,
      });

      for (const template of questionTemplates) {
        await this.questionTemplatesRepository.create({
          accountId,
          projectId,
          order: template.order,
          dataKey: template.dataKey,
          questionTemplate: template.questionTemplate,
          successTemplate: template.successTemplate,
          failTemplate: template.failTemplate,
          final: template.final,
          type: template.type || "freeform",
        });
      }

      if (!survey) {
        throw new Error("Failed to create survey");
      }

      this.logger.info({ surveyId: survey.id }, "Survey created");

      return survey;
    } catch (error) {
      this.logger.error(error, "Failed to create survey");

      throw error;
    }
  }
}
