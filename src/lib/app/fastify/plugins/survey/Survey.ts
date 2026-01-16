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

        // Add initial agent question to conversation in report
        await this.surveySessionService.addAgentQuestionToConversation({
          sessionId: session.id,
          questionId: question.id,
          questionText: reformulatedQuestion,
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
        const questionTemplate = await this.surveySessionService.getQuestionBySurveyIdAndOrder(
          survey.id,
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
        const allQuestionTemplates = await this.surveySessionService.getAllQuestionTemplatesBySurveyId(
          survey.id,
        );
        const allDataKeys = allQuestionTemplates.map((qt) => qt.dataKey);
        const allQuestionTypes = allQuestionTemplates.reduce(
          (acc, qt) => {
            acc[qt.dataKey] = qt.type;
            return acc;
          },
          {} as Record<string, string>,
        );

        // Extract data using AI service - extract ALL possible data
        const extractDataArgs: {
          text: string;
          currentQuestionDataKey: string;
          currentQuestionType: string;
          allDataKeys: string[];
          allQuestionTypes: Record<string, string>;
          lang: SupportedLanguage;
          currentDataState?: Record<string, any>;
          previousConversation?: Array<{ question: string; answer: string }>;
        } = {
          text: answerText,
          currentQuestionDataKey: questionTemplate.dataKey,
          currentQuestionType: questionTemplate.type,
          allDataKeys,
          allQuestionTypes,
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

          const combineFailArgs: {
            fail: string;
            question: string;
            lang: SupportedLanguage;
            currentDataState?: Record<string, any>;
            previousConversation?: Array<{ question: string; answer: string }>;
          } = {
            fail: questionTemplate.failTemplate,
            question: questionTemplate.questionTemplate,
            lang,
          };

          if (currentDataState) {
            combineFailArgs.currentDataState = currentDataState;
          }

          if (previousConversation.length > 0) {
            combineFailArgs.previousConversation = previousConversation;
          }

          const failMessage = await this.aiService.combineFailWithQuestion(combineFailArgs);

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
        const updatedDataStateRaw = await this.surveySessionService.getCurrentReportData(sessionId);
        // Use flat data for backward compatibility with existing code
        const updatedDataState = updatedDataStateRaw?._flatData || updatedDataStateRaw || {};
        
        // #region agent log
        logger.info({ sessionId, currentOrder, updatedDataStateKeys: Object.keys(updatedDataState), updatedDataState, allQuestionTemplatesDataKeys: allQuestionTemplates.map(qt => qt.dataKey) }, "Checking for next question");
        fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Survey.ts:268',message:'Checking for next question',data:{sessionId,currentOrder,updatedDataStateKeys:Object.keys(updatedDataState),updatedDataState,allQuestionTemplatesDataKeys:allQuestionTemplates.map(qt=>qt.dataKey)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Find the next question that doesn't have data yet
        let nextQuestion: QuestionTemplate | null = null;
        let nextOrder = currentOrder + 1;
        const maxOrder = Math.max(...allQuestionTemplates.map((qt) => qt.order));
        
        while (nextOrder <= maxOrder) {
          const candidateQuestion = await this.surveySessionService.getQuestionBySurveyIdAndOrder(
            survey.id,
            nextOrder,
          );

          if (!candidateQuestion) {
            break;
          }

          // Check if this question's dataKey already has data
          // Accept null only if it's explicitly set (not missing), but prefer non-null values
          // Also accept string values like "none", "no", "нет", "нет проблем" as valid answers
          const dataValue = updatedDataState?.[candidateQuestion.dataKey];
          
          // #region agent log
          logger.info({ sessionId, nextOrder, candidateQuestionDataKey: candidateQuestion.dataKey, dataValue, hasKeyInState: candidateQuestion.dataKey in updatedDataState, updatedDataState }, "Checking candidate question for data");
          fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Survey.ts:293',message:'Checking candidate question for data',data:{sessionId,nextOrder,candidateQuestionDataKey:candidateQuestion.dataKey,dataValue,hasKeyInState:candidateQuestion.dataKey in updatedDataState,updatedDataState},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
          const hasData =
            updatedDataState &&
            candidateQuestion.dataKey in updatedDataState &&
            (dataValue != null ||
              // Accept explicit "none" / "no" / "нет" values as valid answers
              (typeof dataValue === "string" &&
                (dataValue.toLowerCase() === "none" ||
                  dataValue.toLowerCase() === "no" ||
                  dataValue.toLowerCase() === "нет" ||
                  dataValue.toLowerCase().includes("нет проблем") ||
                  dataValue.toLowerCase().includes("no problems")))) &&
            !(
              typeof dataValue === "object" &&
              dataValue != null &&
              Object.keys(dataValue).length === 0
            );

          // #region agent log
          logger.info({ sessionId, nextOrder, candidateQuestionDataKey: candidateQuestion.dataKey, hasData, dataValue }, "hasData check result");
          fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Survey.ts:315',message:'hasData check result',data:{sessionId,nextOrder,candidateQuestionDataKey:candidateQuestion.dataKey,hasData,dataValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
          // #endregion

          if (!hasData) {
            nextQuestion = candidateQuestion;
            break;
          }

          // This question's data already exists, skip it and move to next
          nextOrder++;
        }

        // Check if all questions are answered (all dataKeys have data)
        // This includes cases where user said "no problems" which should be extracted as "none" or similar
        const isNoneValue = (val: any): boolean => {
          if (val == null) return false;
          if (typeof val === "string") {
            const lower = val.toLowerCase();
            return (
              lower === "none" ||
              lower === "no" ||
              lower === "нет" ||
              lower.includes("нет проблем") ||
              lower.includes("no problems") ||
              lower.includes("нет препятствий") ||
              lower.includes("no obstacles")
            );
          }
          return false;
        };

        // Check using the new report structure (data array) or fallback to flat data
        const reportData = updatedDataStateRaw;
        const dataArray = reportData?.data || [];
        const flatDataForCheck = updatedDataState || {};

        const allDataKeysProvided = allDataKeys.every((key) => {
          // Try to find in data array first
          const dataEntry = dataArray.find((d: any) => d.key === key);
          const value = dataEntry?.value || flatDataForCheck[key];
          
          // Value is provided if:
          // 1. It's not null/undefined, OR
          // 2. It's a valid "none" string value
          const hasValue = value != null || isNoneValue(value);
          // And it's not an empty object
          const isNotEmptyObject = !(typeof value === "object" && value != null && Object.keys(value).length === 0);
          return hasValue && isNotEmptyObject;
        });

        // If all questions are answered OR there's no next question, complete the survey
        if (allDataKeysProvided || !nextQuestion) {
          // Get the final question's success template if available
          const finalQuestion = allQuestionTemplates.find((qt) => qt.final);
          let completionMessage = "Thank you for completing the survey!";

          if (finalQuestion) {
            const lang = (survey.lang === "en" || survey.lang === "ru") ? survey.lang : "en";
            completionMessage = await this.aiService.rephraseCompletion({
              text: finalQuestion.successTemplate,
              lang,
            });
          }

          await this.surveySessionService.endSession({ sessionId });

          return reply.code(200).send({
            message: completionMessage,
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
          // Normal flow: combine success template with next question (reformulation happens inside)
          const combineArgs: {
            success: string;
            question: string;
            lang: SupportedLanguage;
            currentDataState?: Record<string, any>;
            previousConversation?: Array<{ question: string; answer: string }>;
          } = {
            success: questionTemplate.successTemplate,
            question: questionToShow,
            lang,
          };

          if (updatedDataState) {
            combineArgs.currentDataState = updatedDataState;
          }

          if (updatedConversation.length > 0) {
            combineArgs.previousConversation = updatedConversation;
          }

          finalMessage = await this.aiService.combineSuccessWithQuestion(combineArgs);
        }

        // Add agent question to conversation in report
        await this.surveySessionService.addAgentQuestionToConversation({
          sessionId,
          questionId: nextQuestion.id,
          questionText: finalMessage,
        });

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
