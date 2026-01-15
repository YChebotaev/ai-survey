import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";
import { BaseFastifyPlugin, type PluginBaseOptions } from "../../plugin-base";
import { ProjectsService } from "../../../../services";

export interface ProjectsPluginOptions extends PluginBaseOptions {
  projectsService: ProjectsService;
}

export class ProjectsPlugin extends BaseFastifyPlugin<ProjectsPluginOptions> {
  private readonly projectsService: ProjectsService;

  constructor(fastify: FastifyInstance, config: ProjectsPluginOptions) {
    super(fastify, config);

    this.projectsService = config.projectsService;
  }

  protected async initializeRoutes(config: ProjectsPluginOptions) {
    const { logger } = config;
    
    this.fastify.get<{
      Params: {
        accountId: string;
      };
    }>("/:accountId/projects", async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;

        // TODO: Implement project listing with user authorization check
        logger.info({ accountId }, "Listing projects");

        return reply.code(200).send({
          projects: [],
        });
      } catch (error) {
        logger.error(error, "Failed to list projects");

        return reply.code(500).send({ error: "Failed to list projects" });
      }
    });

    this.fastify.post<{
      Params: {
        accountId: string;
      };
      Body: {
        name: string;
      };
    }>("/:accountId/projects", async (request: FastifyRequest<{ Params: { accountId: string }; Body: { name: string } }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const { name } = request.body;

        await this.projectsService.ready;

        const project = await this.projectsService.createProject({
          accountId: parseInt(accountId, 10),
          name,
        });

        logger.info({ projectId: project.id }, "Project created");

        return reply.code(201).send({ project });
      } catch (error: any) {
        logger.error(error, "Failed to create project");

        return reply.code(500).send({ 
          error: "Failed to create project",
          message: error?.message || String(error),
        });
      }
    });

    this.fastify.post<{
      Params: {
        accountId: string;
        projectId: string;
      };
      Body: {
        externalId: string;
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
    }>("/:accountId/projects/:projectId/survey", async (request: FastifyRequest<{ Params: { accountId: string; projectId: string }; Body: { externalId: string; questionTemplates: Array<{ order: number; dataKey: string; questionTemplate: string; successTemplate: string; failTemplate: string; final: boolean; type?: string }> } }>, reply: FastifyReply) => {
      try {
        const { accountId, projectId } = request.params;
        const { externalId, questionTemplates } = request.body;

        await this.projectsService.ready;

        const survey = await this.projectsService.createSurvey({
          accountId: parseInt(accountId, 10),
          projectId: parseInt(projectId, 10),
          externalId,
          questionTemplates,
        });

        logger.info({ surveyId: survey.id }, "Survey created");

        return reply.code(201).send({ survey });
      } catch (error: any) {
        logger.error(error, "Failed to create survey");

        return reply.code(500).send({ 
          error: "Failed to create survey",
          message: error?.message || String(error),
        });
      }
    });
  }
}

const plugin = fastifyPlugin(
  async (fastify: FastifyInstance, options: ProjectsPluginOptions) => {
    const projectsPlugin = new ProjectsPlugin(fastify, options);
    await projectsPlugin.ready;
  },
  {
    name: "projects-plugin",
  },
);

export default plugin;
