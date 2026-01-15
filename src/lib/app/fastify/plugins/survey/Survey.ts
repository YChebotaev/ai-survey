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

        // Get survey to access lang
        const survey = await this.surveySessionService.getSurveyById(session.surveyId);

        if (!survey) {
          return reply.code(404).send({ error: "Survey not found" });
        }

        const lang = (survey.lang === "en" || survey.lang === "ru") ? survey.lang : "en";

        const reformulatedQuestion = await this.aiService.rephraseQuestion({
          question: question.questionTemplate,
          lang,
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

        // Normalize lang to ensure it's valid
        const lang = (survey.lang === "en" || survey.lang === "ru") ? survey.lang : "en";

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

        // Get all question templates to extract all possible dataKeys
        const allQuestionTemplates = await this.surveySessionService.getAllQuestionTemplatesByProjectId(
          survey.projectId,
        );
        const allDataKeys = allQuestionTemplates.map((qt) => qt.dataKey);

        // Extract data using AI service - extract ALL possible data
        const extractDataArgs: {
          text: string;
          currentQuestionDataKey: string;
          allDataKeys: string[];
          lang: SupportedLanguage;
          currentDataState?: Record<string, any>;
          previousConversation?: Array<{ question: string; answer: string }>;
        } = {
          text: answerText,
          currentQuestionDataKey: questionTemplate.dataKey,
          allDataKeys,
          lang,
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
            lang: SupportedLanguage;
            currentDataState?: Record<string, any>;
            previousConversation?: Array<{ question: string; answer: string }>;
          } = {
            question: questionTemplate.questionTemplate,
            lang,
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
            lang,
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
            lang,
          });

          return reply.code(200).send({
            message: finalMessage,
            completed: true,
          });
        }

        // Now store the answer (this will update session state and store all extracted data)
        const answer = await this.surveySessionService.addQuestionAnswer({
          sessionId,
          questionId: questionTemplate.id,
          answerText,
          answerData,
        });

        // Get updated data state after storing the answer
        const updatedDataState = await this.surveySessionService.getCurrentReportData(sessionId);
        
        // Find the next question that doesn't have data yet
        let nextQuestion: QuestionTemplate | null = null;
        let nextOrder = currentOrder + 1;
        const maxOrder = Math.max(...allQuestionTemplates.map((qt) => qt.order));
        
        while (nextOrder <= maxOrder) {
          const candidateQuestion = await this.surveySessionService.getQuestionByProjectIdAndOrder(
            survey.projectId,
            nextOrder,
          );

          if (!candidateQuestion) {
            break;
          }

          // Check if this question's dataKey already has data
          const hasData =
            updatedDataState &&
            candidateQuestion.dataKey in updatedDataState &&
            updatedDataState[candidateQuestion.dataKey] != null &&
            !(
              typeof updatedDataState[candidateQuestion.dataKey] === "object" &&
              Object.keys(updatedDataState[candidateQuestion.dataKey]).length === 0
            );

          if (!hasData) {
            nextQuestion = candidateQuestion;
            break;
          }

          // This question's data already exists, skip it and move to next
          nextOrder++;
        }

        // If there's no next question, end the session
        if (!nextQuestion) {
          await this.surveySessionService.endSession({ sessionId });

          return reply.code(200).send({
            message: "Thank you for completing the survey!",
            completed: true,
          });
        }

        // Update session state to reflect the skipped questions
        await this.surveySessionService.updateSessionOrder(sessionId, nextOrder);

        const updatedConversation = await this.surveySessionService.getConversationHistory(
          sessionId,
        );

        // Check if we skipped any questions and acknowledge it
        const skippedCount = nextOrder - (currentOrder + 1);
        let questionToShow = nextQuestion.questionTemplate;
        let hasAcknowledgedSkipped = false;

        if (skippedCount > 0 && updatedDataState) {
          // Acknowledge that some data was already provided
          const skippedDataKeys = allQuestionTemplates
            .filter((qt) => qt.order > currentOrder && qt.order < nextOrder)
            .map((qt) => qt.dataKey)
            .filter((key) => updatedDataState[key] != null);

          if (skippedDataKeys.length > 0) {
            // Use AI to acknowledge the skipped data and combine with success template
            // We combine success + acknowledgment + question in one step
            // Combine success template with acknowledgment and question
            const combinedAcknowledgePrompt = `${questionTemplate.successTemplate}\n\nThe user has already provided information for: ${skippedDataKeys.join(", ")}. Acknowledge this briefly and naturally, then ask the next question: ${nextQuestion.questionTemplate}`;
            
            const acknowledgeArgs: {
              question: string;
              lang: SupportedLanguage;
              currentDataState?: Record<string, any>;
              previousConversation?: Array<{ question: string; answer: string }>;
            } = {
              question: combinedAcknowledgePrompt,
              lang,
            };

            if (updatedDataState) {
              acknowledgeArgs.currentDataState = updatedDataState;
            }

            if (updatedConversation.length > 0) {
              acknowledgeArgs.previousConversation = updatedConversation;
            }

            const acknowledgedQuestion = await this.aiService.rephraseQuestion(acknowledgeArgs);
            
            questionToShow = acknowledgedQuestion;
            hasAcknowledgedSkipped = true;
          }
        }

        let finalMessage: string;

        if (hasAcknowledgedSkipped) {
          // If we already acknowledged skipped data and combined with success template, use it directly
          finalMessage = questionToShow;
        } else {
          // Normal flow: rephrase question and combine with success template
          const rephraseNextQuestionArgs: {
            question: string;
            lang: SupportedLanguage;
            currentDataState?: Record<string, any>;
            previousConversation?: Array<{ question: string; answer: string }>;
          } = {
            question: questionToShow,
            lang,
          };

          if (updatedDataState) {
            rephraseNextQuestionArgs.currentDataState = updatedDataState;
          }

          if (updatedConversation.length > 0) {
            rephraseNextQuestionArgs.previousConversation = updatedConversation;
          }

          const reformulatedNextQuestion = await this.aiService.rephraseQuestion(rephraseNextQuestionArgs);

          // Combine success template with next question
          finalMessage = await this.aiService.combineSuccessWithQuestion({
            success: questionTemplate.successTemplate,
            question: reformulatedNextQuestion,
            lang,
          });
        }

        logger.info({ sessionId, answerId: answer.id }, "Answer received and next question sent");

        return reply.code(200).send({
          message: finalMessage,
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
