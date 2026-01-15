import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";
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

        const { session, question } = await this.surveySessionService.startSession({
          externalId,
        });

        logger.info({ sessionId: session.id, externalId }, "Survey session initialized");

        if (!question) {
          return reply.code(200).send({
            sessionId: session.id,
            message: "No questions available",
          });
        }

        const reformulatedQuestion = await this.aiService.rephraseQuestion({
          question: question.questionTemplate,
          // Initial question - no data state or conversation yet
        });

        return reply.code(200).send({
          sessionId: session.id,
          question: reformulatedQuestion,
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

        // Get the current question from the session
        const session = await this.surveySessionService.getSessionById(sessionId);

        if (!session) {
          return reply.code(404).send({ error: "Session not found" });
        }

        const sessionState = JSON.parse(session.sessionState);
        const currentOrder = sessionState.currentOrder;

        // Get the survey to find projectId
        const survey = await this.surveySessionService.getSurveyById(session.surveyId);

        if (!survey) {
          return reply.code(404).send({ error: "Survey not found" });
        }

        // Get the question template for the current order
        const questionTemplate = await this.surveySessionService.getQuestionByProjectIdAndOrder(
          survey.projectId,
          currentOrder,
        );

        if (!questionTemplate) {
          return reply.code(404).send({ error: "Question not found" });
        }

        // Get current data state and conversation history
        const currentDataState = await this.surveySessionService.getCurrentReportData(sessionId);
        const previousConversation = await this.surveySessionService.getConversationHistory(
          sessionId,
        );

        // Extract data using AI service
        const extractDataArgs: {
          text: string;
          dataKey: string;
          currentDataState?: Record<string, any>;
          previousConversation?: Array<{ question: string; answer: string }>;
        } = {
          text: answerText,
          dataKey: questionTemplate.dataKey,
        };

        if (currentDataState) {
          extractDataArgs.currentDataState = currentDataState;
        }

        if (previousConversation.length > 0) {
          extractDataArgs.previousConversation = previousConversation;
        }

        const extractedData = await this.aiService.extractData(extractDataArgs);

        if (!extractedData) {
          // If extraction failed, combine fail template with question and repeat
          const rephraseQuestionArgs: {
            question: string;
            currentDataState?: Record<string, any>;
            previousConversation?: Array<{ question: string; answer: string }>;
          } = {
            question: questionTemplate.questionTemplate,
          };

          if (currentDataState) {
            rephraseQuestionArgs.currentDataState = currentDataState;
          }

          if (previousConversation.length > 0) {
            rephraseQuestionArgs.previousConversation = previousConversation;
          }

          const reformulatedQuestion = await this.aiService.rephraseQuestion(rephraseQuestionArgs);

          const failMessage = await this.aiService.combineFailWithQuestion({
            fail: questionTemplate.failTemplate,
            question: reformulatedQuestion,
          });

          return reply.code(200).send({
            message: failMessage,
            sessionId,
          });
        }

        // Store the extracted data
        const answerData = JSON.stringify(extractedData);

        // Check if the current question is final - if so, end after answering
        if (questionTemplate.final) {
          // Store the answer
          const answer = await this.surveySessionService.addQuestionAnswer({
            sessionId,
            questionId: questionTemplate.id,
            answerText,
            answerData,
          });

          await this.surveySessionService.endSession({ sessionId });

          const finalMessage = await this.aiService.rephraseCompletion({
            text: questionTemplate.successTemplate,
          });

          return reply.code(200).send({
            message: finalMessage,
            completed: true,
          });
        }

        // Get the next question BEFORE updating the session state
        const nextOrder = currentOrder + 1;
        const nextQuestion = await this.surveySessionService.getQuestionByProjectIdAndOrder(
          survey.projectId,
          nextOrder,
        );

        // Now store the answer (this will update session state)
        const answer = await this.surveySessionService.addQuestionAnswer({
          sessionId,
          questionId: questionTemplate.id,
          answerText,
          answerData,
        });

        // If there's no next question, end the session
        if (!nextQuestion) {
          await this.surveySessionService.endSession({ sessionId });

          return reply.code(200).send({
            message: "Thank you for completing the survey!",
            completed: true,
          });
        }

        // Get updated data state after storing the answer
        const updatedDataState = await this.surveySessionService.getCurrentReportData(sessionId);
        const updatedConversation = await this.surveySessionService.getConversationHistory(
          sessionId,
        );

        // Rephrase the next question with context
        const rephraseNextQuestionArgs: {
          question: string;
          currentDataState?: Record<string, any>;
          previousConversation?: Array<{ question: string; answer: string }>;
        } = {
          question: nextQuestion.questionTemplate,
        };

        if (updatedDataState) {
          rephraseNextQuestionArgs.currentDataState = updatedDataState;
        }

        if (updatedConversation.length > 0) {
          rephraseNextQuestionArgs.previousConversation = updatedConversation;
        }

        const reformulatedNextQuestion = await this.aiService.rephraseQuestion(rephraseNextQuestionArgs);

        // Combine success template with next question
        const combinedMessage = await this.aiService.combineSuccessWithQuestion({
          success: questionTemplate.successTemplate,
          question: reformulatedNextQuestion,
        });

        logger.info({ sessionId, answerId: answer.id }, "Answer received and next question sent");

        return reply.code(200).send({
          message: combinedMessage,
          sessionId,
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
