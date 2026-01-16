import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";
import type { SupportedLanguage } from "../../../../types";
import type { QuestionTemplate } from "../../../../repositories";
import { BaseFastifyPlugin, type PluginBaseOptions } from "../../plugin-base";
import { SurveySessionService, AiService } from "../../../../services";

export interface SurveyPluginOptions extends PluginBaseOptions {
  surveySessionService: SurveySessionService;
  aiService: AiService;
}

export class SurveyPlugin extends BaseFastifyPlugin<SurveyPluginOptions> {
  private readonly surveySessionService: SurveySessionService;
  private readonly aiService: AiService;

  constructor(fastify: FastifyInstance, config: SurveyPluginOptions) {
    super(fastify, config);

    this.surveySessionService = config.surveySessionService;
    this.aiService = config.aiService;
  }

  protected async initializeRoutes(config: SurveyPluginOptions) {
    const { logger } = config;
    
    this.fastify.post<{
      Params: {
        externalId: string;
      };
    }>("/s/:externalId/init", async (request: FastifyRequest<{ Params: { externalId: string } }>, reply: FastifyReply) => {
      try {
        const { externalId } = request.params;

        await this.surveySessionService.ready;
        await this.aiService.ready;

        const { session } = await this.surveySessionService.startSession({
          externalId,
        });

        logger.info({ sessionId: session.id, externalId }, "Survey session initialized");

        // Use new flow: decide and ask next question (will be the first question)
        const decision = await this.surveySessionService.decideAndAskNextQuestion({
          sessionId: session.id,
        });

        if (decision.completed) {
          return reply.code(200).send({
            sessionId: session.id,
            message: decision.message,
            completed: true,
          });
        }

        return reply.code(200).send({
          sessionId: session.id,
          question: decision.message,
          completed: false,
        });
      } catch (error: any) {
        logger.error(error, "Failed to initialize survey session");

        return reply.code(500).send({ 
          error: "Failed to initialize survey session",
          message: error?.message || String(error),
        });
      }
    });

    this.fastify.post<{
      Params: {
        externalId: string;
      };
      Body: {
        sessionId: number;
        answerText: string;
      };
    }>("/s/:externalId/respond", async (request: FastifyRequest<{ Params: { externalId: string }; Body: { sessionId: number; answerText: string } }>, reply: FastifyReply) => {
      try {
        const { externalId } = request.params;
        const { sessionId, answerText } = request.body;

        // Get the session
        const session = await this.surveySessionService.getSessionById(sessionId);

        if (!session) {
          return reply.code(404).send({ error: "Session not found" });
        }

        // Use new flow: add client message, then decide next question
        await this.surveySessionService.addClientMessage({
          sessionId,
          clientMessage: answerText,
        });

        // Decide and ask next question (AI-driven)
        const decision = await this.surveySessionService.decideAndAskNextQuestion({
          sessionId,
        });

        return reply.code(200).send({
          message: decision.message,
          sessionId,
          completed: decision.completed,
        });
      } catch (error: any) {
        logger.error(error, "Failed to process survey response");

        return reply.code(500).send({ 
          error: "Failed to process survey response",
          message: error?.message || String(error),
        });
      }
    });
  }
}

const plugin = fastifyPlugin(
  async (fastify: FastifyInstance, options: SurveyPluginOptions) => {
    const surveyPlugin = new SurveyPlugin(fastify, options);
    await surveyPlugin.ready;
  },
  {
    name: "survey-plugin",
  },
);

export default plugin;
