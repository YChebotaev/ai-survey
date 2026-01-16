import { type Logger } from "pino";
import { ServiceBase } from "./ServiceBase";
import { AiService } from "./AiService";
import type { SupportedLanguage } from "../types";
import {
  SurveysRepository,
  QuestionTemplatesRepository,
  SurveySessionsRepository,
  SessionMessagesRepository,
  SessionReportsRepository,
  type Survey,
  type QuestionTemplate,
  type SurveySession,
  type SessionMessage,
  type SessionReport,
} from "../repositories";

export type SurveySessionServiceConfig = {
  surveysRepository: SurveysRepository;
  questionTemplatesRepository: QuestionTemplatesRepository;
  surveySessionsRepository: SurveySessionsRepository;
  sessionMessagesRepository: SessionMessagesRepository;
  sessionReportsRepository: SessionReportsRepository;
  aiService: AiService;
  logger: Logger;
};

export type StartSessionArgs = {
  externalId: string;
};

export type EndSessionArgs = {
  sessionId: number;
};

export type GetNextQuestionArgs = {
  sessionId: number;
};

export type AddQuestionAnswerArgs = {
  sessionId: number;
  questionId: number;
  answerText: string;
  answerData: string;
};

export type AddClientMessageArgs = {
  sessionId: number;
  clientMessage: string;
};

export type DecideAndAskNextQuestionArgs = {
  sessionId: number;
};

export type ListReportsArgs = {
  accountId: number;
  projectId?: number;
  surveyId?: number;
};

export type GetReportArgs = {
  sessionId: number;
};

export class SurveySessionService extends ServiceBase<SurveySessionServiceConfig> {
  private readonly surveysRepository: SurveysRepository;
  private readonly questionTemplatesRepository: QuestionTemplatesRepository;
  private readonly surveySessionsRepository: SurveySessionsRepository;
  private readonly sessionMessagesRepository: SessionMessagesRepository;
  private readonly sessionReportsRepository: SessionReportsRepository;
  private readonly aiService: AiService;

  constructor({
    surveysRepository,
    questionTemplatesRepository,
    surveySessionsRepository,
    sessionMessagesRepository,
    sessionReportsRepository,
    aiService,
    logger,
  }: SurveySessionServiceConfig) {
    super(logger, {
      surveysRepository,
      questionTemplatesRepository,
      surveySessionsRepository,
      sessionMessagesRepository,
      sessionReportsRepository,
      aiService,
      logger,
    });

    this.surveysRepository = surveysRepository;
    this.questionTemplatesRepository = questionTemplatesRepository;
    this.surveySessionsRepository = surveySessionsRepository;
    this.sessionMessagesRepository = sessionMessagesRepository;
    this.sessionReportsRepository = sessionReportsRepository;
    this.aiService = aiService;
  }

  public async startSession({
    externalId,
  }: StartSessionArgs): Promise<{ session: SurveySession; question: QuestionTemplate | null }> {
    try {
      this.logger.info({ externalId }, "Starting survey session");

      const survey = await this.surveysRepository.findByExternalId(externalId);

      if (!survey) {
        throw new Error(`Survey with externalId ${externalId} not found`);
      }

      const sessionState = JSON.stringify({
        currentOrder: 1,
        completed: false,
      });

      const session = await this.surveySessionsRepository.create({
        accountId: survey.accountId,
        projectId: survey.projectId,
        surveyId: survey.id,
        sessionState,
      });

      if (!session) {
        throw new Error("Failed to create survey session");
      }

      // Find the first question that doesn't have data yet
      // (in case user provides data in a previous session or somehow)
      const allQuestions = await this.questionTemplatesRepository.findBySurveyId(survey.id);
      
      let firstQuestion: QuestionTemplate | null = null;
      let firstQuestionOrder = 1;

      for (const question of allQuestions) {
        // For initial session, we start with the first question
        // But if we're resuming, we should check if data exists
        firstQuestion = question;
        firstQuestionOrder = question.order;
        break;
      }

      // Initial agent message will be created when decideAndAskNextQuestion is called
      // For now, we just initialize the session

      // Initialize report with new structure: conversation and data arrays
      const initialReportData = {
        conversation: [],
        data: [],
      };

      const report = await this.sessionReportsRepository.create({
        accountId: survey.accountId,
        projectId: survey.projectId,
        surveyId: survey.id,
        sessionId: session.id,
        data: JSON.stringify(initialReportData),
      });

      if (!report) {
        this.logger.warn({ sessionId: session.id }, "Failed to create session report");
      }

      this.logger.info({ sessionId: session.id }, "Survey session started");

      return { session, question: firstQuestion || null };
    } catch (error) {
      this.logger.error(error, "Failed to start session");

      throw error;
    }
  }

  public async endSession({ sessionId }: EndSessionArgs): Promise<void> {
    try {
      this.logger.info({ sessionId }, "Ending survey session");

      const session = await this.surveySessionsRepository.getById(sessionId);

      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const sessionState = JSON.parse(session.sessionState);
      sessionState.completed = true;

      await this.surveySessionsRepository.updateSessionState(
        sessionId,
        JSON.stringify(sessionState),
      );

      this.logger.info({ sessionId }, "Survey session ended");

      return;
    } catch (error) {
      this.logger.error(error, "Failed to end session");

      throw error;
    }
  }

  public async getNextQuestion({
    sessionId,
  }: GetNextQuestionArgs): Promise<QuestionTemplate | null> {
    try {
      this.logger.info({ sessionId }, "Getting next question");

      const session = await this.surveySessionsRepository.getById(sessionId);

      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const sessionState = JSON.parse(session.sessionState);

      if (sessionState.completed) {
        return null;
      }

      const nextOrder = sessionState.currentOrder + 1;

      const survey = await this.surveysRepository.getById(session.surveyId);

      if (!survey) {
        throw new Error(`Survey with id ${session.surveyId} not found`);
      }

      const nextQuestion = await this.questionTemplatesRepository.findBySurveyIdAndOrder(
        survey.id,
        nextOrder,
      );

      this.logger.info(
        { sessionId, nextOrder, hasQuestion: !!nextQuestion },
        "Next question retrieved",
      );

      return nextQuestion || null;
    } catch (error) {
      this.logger.error(error, "Failed to get next question");

      throw error;
    }
  }

  public async addQuestionAnswer({
    sessionId,
    questionId,
    answerText,
    answerData,
  }: AddQuestionAnswerArgs): Promise<void> {
    try {
      this.logger.info({ sessionId, questionId }, "Adding question answer (deprecated - use addClientMessage instead)");

      // This method is deprecated - use addClientMessage instead
      // Keeping for backward compatibility but it's a no-op now
      // The actual work is done in addClientMessage
      this.logger.warn({ sessionId, questionId }, "addQuestionAnswer is deprecated, use addClientMessage instead");
    } catch (error) {
      this.logger.error(error, "Failed to add question answer");

      throw error;
    }
  }

  public async listReports({
    accountId,
    projectId,
    surveyId,
  }: ListReportsArgs): Promise<SessionReport[]> {
    try {
      this.logger.info({ accountId, projectId, surveyId }, "Listing reports");

      const allReports = await this.sessionReportsRepository.findByAccountId(accountId);

      let results = allReports;

      if (projectId) {
        results = results.filter((r) => r.projectId === projectId);
      }

      if (surveyId) {
        results = results.filter((r) => r.surveyId === surveyId);
      }

      this.logger.info({ count: results.length }, "Reports listed");

      return results as SessionReport[];
    } catch (error) {
      this.logger.error(error, "Failed to list reports");

      throw error;
    }
  }

  public async getReport({ sessionId }: GetReportArgs): Promise<SessionReport | null> {
    try {
      this.logger.info({ sessionId }, "Getting report");

      const report = await this.sessionReportsRepository.findBySessionId(sessionId);

      this.logger.info({ sessionId, found: !!report }, "Report retrieved");

      return report || null;
    } catch (error) {
      this.logger.error(error, "Failed to get report");

      throw error;
    }
  }

  public async getSessionById(sessionId: number): Promise<SurveySession | null> {
    try {
      const session = await this.surveySessionsRepository.getById(sessionId);

      return session || null;
    } catch (error) {
      this.logger.error(error, "Failed to get session");

      throw error;
    }
  }

  public async getQuestionByProjectIdAndOrder(
    projectId: number,
    order: number,
  ): Promise<QuestionTemplate | null> {
    try {
      const question = await this.questionTemplatesRepository.findByProjectIdAndOrder(
        projectId,
        order,
      );

      return question || null;
    } catch (error) {
      this.logger.error(error, "Failed to get question");

      throw error;
    }
  }

  public async getQuestionBySurveyIdAndOrder(
    surveyId: number,
    order: number,
  ): Promise<QuestionTemplate | null> {
    try {
      const question = await this.questionTemplatesRepository.findBySurveyIdAndOrder(
        surveyId,
        order,
      );

      return question || null;
    } catch (error) {
      this.logger.error(error, "Failed to get question by surveyId");

      throw error;
    }
  }

  public async getSurveyById(surveyId: number): Promise<Survey | null> {
    try {
      const survey = await this.surveysRepository.getById(surveyId);

      return survey || null;
    } catch (error) {
      this.logger.error(error, "Failed to get survey");

      throw error;
    }
  }

  public async getConversationHistory(
    sessionId: number,
  ): Promise<Array<{ question: string; answer: string }>> {
    try {
      // Try to get from new report structure first
      const report = await this.sessionReportsRepository.findBySessionId(sessionId);
      if (report) {
        try {
          const reportData = JSON.parse(report.data);
          if (reportData.conversation && Array.isArray(reportData.conversation)) {
            // Convert new format to old format for backward compatibility
            const conversation: Array<{ question: string; answer: string }> = [];
            let currentQuestion: string | null = null;

            for (const msg of reportData.conversation) {
              if (msg.author === "agent") {
                currentQuestion = msg.text;
              } else if (msg.author === "client" && currentQuestion) {
                conversation.push({
                  question: currentQuestion,
                  answer: msg.text,
                });
                currentQuestion = null;
              }
            }

            return conversation;
          }
        } catch (parseError) {
          // Fall through to old method
        }
      }

      // Fallback to old method using session messages
      const messages = await this.sessionMessagesRepository.findBySessionId(sessionId);

      const conversation: Array<{ question: string; answer: string }> = [];
      let currentQuestion: string | null = null;

      // Match agent and client messages
      for (const msg of messages) {
        if (msg.author === "agent") {
          currentQuestion = msg.text;
        } else if (msg.author === "client" && currentQuestion) {
          conversation.push({
            question: currentQuestion,
            answer: msg.text,
          });
          currentQuestion = null;
        }
      }

      return conversation;
    } catch (error) {
      this.logger.error(error, "Failed to get conversation history");

      return [];
    }
  }

  public async getCurrentReportData(sessionId: number): Promise<Record<string, any> | null> {
    try {
      const report = await this.sessionReportsRepository.findBySessionId(sessionId);

      if (!report) {
        return null;
      }

      try {
        const reportData = JSON.parse(report.data);
        
        // For backward compatibility, also provide a flat data structure
        // Convert data array to flat object for easy access
        // Priority: "freeform" entries override "extracted" entries for the same key
        const flatData: Record<string, any> = {};
        if (reportData.data && Array.isArray(reportData.data)) {
          // First pass: collect all entries, prioritizing freeform over extracted
          const entriesByKey: Record<string, { value: any; type: string }> = {};
          for (const dataEntry of reportData.data) {
            const existing = entriesByKey[dataEntry.key];
            // If no existing entry, or existing is "extracted" and current is "freeform", use current
            if (!existing || (existing.type === "extracted" && dataEntry.type === "freeform")) {
              entriesByKey[dataEntry.key] = { value: dataEntry.value, type: dataEntry.type };
            }
          }
          // Build flatData from prioritized entries
          for (const [key, entry] of Object.entries(entriesByKey)) {
            flatData[key] = entry.value;
          }
        }
        
        // #region agent log
        this.logger.info({ sessionId, flatDataKeys: Object.keys(flatData), flatData, dataArrayLength: reportData.data?.length || 0 }, "Built _flatData from report");
        fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SurveySessionService.ts:640',message:'Building _flatData from report',data:{sessionId,dataArrayLength:reportData.data?.length||0,dataEntries:reportData.data?.map((d:any)=>({key:d.key,type:d.type,value:d.value}))||[],flatDataKeys:Object.keys(flatData),flatData},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Return both the structured report and flat data for backward compatibility
        return {
          ...reportData,
          _flatData: flatData, // For backward compatibility
        };
      } catch (error) {
        this.logger.error({ error, sessionId }, "Failed to parse report data");

        return null;
      }
    } catch (error) {
      this.logger.error(error, "Failed to get current report data");

      return null;
    }
  }

  public async addAgentQuestionToConversation({
    sessionId,
    questionId,
    questionText,
  }: {
    sessionId: number;
    questionId: number;
    questionText: string;
  }): Promise<void> {
    try {
      const report = await this.sessionReportsRepository.findBySessionId(sessionId);

      if (!report) {
        return;
      }

      const reportData = JSON.parse(report.data);
      
      // Ensure report has the new structure
      if (!reportData.conversation) {
        reportData.conversation = [];
      }
      if (!reportData.data) {
        reportData.data = [];
      }

      // Helper to generate random IDs
      const generateId = (): string => {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      };

      // Add agent question to conversation
      const questionConversationId = generateId();
      reportData.conversation.push({
        id: questionConversationId,
        author: "agent",
        text: questionText,
        questionId,
      });

      await this.sessionReportsRepository.updateBySessionId(
        sessionId,
        JSON.stringify(reportData),
      );
    } catch (error) {
      this.logger.error(error, "Failed to add agent question to conversation");
    }
  }

  public async getAllQuestionTemplatesByProjectId(projectId: number): Promise<QuestionTemplate[]> {
    try {
      const questions = await this.questionTemplatesRepository.findByProjectId(projectId);

      return questions;
    } catch (error) {
      this.logger.error(error, "Failed to get all question templates");

      return [];
    }
  }

  public async getAllQuestionTemplatesBySurveyId(surveyId: number): Promise<QuestionTemplate[]> {
    try {
      const questions = await this.questionTemplatesRepository.findBySurveyId(surveyId);

      return questions;
    } catch (error) {
      this.logger.error(error, "Failed to get all question templates by surveyId");

      return [];
    }
  }

  public async updateSessionOrder(sessionId: number, newOrder: number): Promise<void> {
    try {
      const session = await this.surveySessionsRepository.getById(sessionId);

      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const sessionState = JSON.parse(session.sessionState);
      sessionState.currentOrder = newOrder;

      await this.surveySessionsRepository.updateSessionState(
        sessionId,
        JSON.stringify(sessionState),
      );
    } catch (error) {
      this.logger.error(error, "Failed to update session order");

      throw error;
    }
  }

  public async addClientMessage({
    sessionId,
    clientMessage,
  }: AddClientMessageArgs): Promise<{ partialReport: { conversation: any[]; data: any[] }; fullReport: { conversation: any[]; data: any[] } }> {
    try {
      this.logger.info({ sessionId }, "Adding client message");

      const session = await this.surveySessionsRepository.getById(sessionId);

      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const survey = await this.surveysRepository.getById(session.surveyId);
      if (!survey) {
        throw new Error(`Survey with id ${session.surveyId} not found`);
      }

      const lang = (survey.lang === "en" || survey.lang === "ru") ? survey.lang : "en";

      // Get all questions to extract all possible dataKeys
      const allQuestionTemplates = await this.questionTemplatesRepository.findBySurveyId(session.surveyId);
      const allDataKeys = allQuestionTemplates.map((qt) => qt.dataKey);
      const allQuestionTypes = allQuestionTemplates.reduce(
        (acc, qt) => {
          acc[qt.dataKey] = qt.type;
          return acc;
        },
        {} as Record<string, string>,
      );

      // Get current report data
      const currentReportData = await this.getCurrentReportData(sessionId);
      if (!currentReportData) {
        throw new Error(`Report not found for session ${sessionId}`);
      }

      // Get conversation history
      const previousConversation = await this.getConversationHistory(sessionId);

      // Extract data using AI - extract ALL possible data from the message
      // We need to determine which question was "current" - this is the last agent message
      // Get it from the current report data (which should have the agent message we just added)
      let currentQuestionDataKey = allDataKeys[0];
      
      // Find the last agent message in the current report's conversation
      const lastAgentMsg = (currentReportData.conversation || [])
        .filter((m: any) => m.author === "agent")
        .pop();
      
      if (lastAgentMsg?.questionId) {
        const questionTemplate = await this.questionTemplatesRepository.getById(lastAgentMsg.questionId);
        if (questionTemplate) {
          currentQuestionDataKey = questionTemplate.dataKey;
        }
      }
      const safeCurrentQuestionDataKey = currentQuestionDataKey || allDataKeys[0];
      const safeCurrentQuestionType = (safeCurrentQuestionDataKey && allQuestionTypes[safeCurrentQuestionDataKey]) || "freeform";

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
        text: clientMessage,
        currentQuestionDataKey: safeCurrentQuestionDataKey as string,
        currentQuestionType: safeCurrentQuestionType as string,
        allDataKeys,
        allQuestionTypes,
        lang,
      };

      if (currentReportData._flatData) {
        extractDataArgs.currentDataState = currentReportData._flatData;
      }

      if (previousConversation.length > 0) {
        extractDataArgs.previousConversation = previousConversation;
      }

      const extractedData = await this.aiService.extractData(extractDataArgs);

      if (!extractedData) {
        throw new Error("Failed to extract data from client message");
      }

      // Create partial report from extracted data
      const generateId = (): string => {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      };

      const partialReport = {
        conversation: [{
          id: generateId(),
          author: "client",
          text: clientMessage,
        }],
        data: [] as Array<{ id: string; key: string; value: string; type: string }>,
      };

      // Helper to check if value is "none"
      const isNoneValue = (val: any): boolean => {
        if (typeof val === "string") {
          const lower = val.toLowerCase();
          return (
            lower === "none" ||
            lower === "no" ||
            lower === "нет" ||
            lower.includes("нет проблем") ||
            lower.includes("no problems")
          );
        }
        return false;
      };

      // Store extracted data in partial report
      for (const [key, value] of Object.entries(extractedData)) {
        if (value != null || isNoneValue(value)) {
          if (!(typeof value === "object" && value != null && Object.keys(value).length === 0)) {
            // Determine type: "freeform" if this is the current question's dataKey, "extracted" otherwise
            const isCurrentQuestion = key === safeCurrentQuestionDataKey;
            const dataRecordType = isCurrentQuestion ? "freeform" : "extracted";

            if (dataRecordType === "freeform") {
              // For "freeform": ensure uniqueness - update existing or create new
              const existingDataIndex = partialReport.data.findIndex(
                (d) => d.key === key && d.type === "freeform"
              );

              if (existingDataIndex >= 0 && partialReport.data[existingDataIndex]) {
                partialReport.data[existingDataIndex]!.value = String(value);
              } else {
                const dataId = generateId();
                partialReport.data.push({
                  id: dataId,
                  key,
                  value: String(value),
                  type: "freeform",
                });
              }
            } else {
              // For "extracted": always create new entry
              const dataId = generateId();
              partialReport.data.push({
                id: dataId,
                key,
                value: String(value),
                type: "extracted",
              });
            }
          }
        }
      }

      // Merge partial report into full report
      const fullReport = {
        conversation: [...(currentReportData.conversation || []), ...partialReport.conversation],
        data: [...(currentReportData.data || [])],
      };

      // Merge data: for "freeform", update existing; for "extracted", add new
      for (const partialDataEntry of partialReport.data) {
        if (partialDataEntry.type === "freeform") {
          const existingIndex = fullReport.data.findIndex(
            (d: any) => d.key === partialDataEntry.key && d.type === "freeform"
          );
          if (existingIndex >= 0) {
            fullReport.data[existingIndex] = partialDataEntry;
          } else {
            fullReport.data.push(partialDataEntry);
          }
        } else {
          fullReport.data.push(partialDataEntry);
        }
      }

      // Save client message to SessionMessage
      const lastMessage = await this.sessionMessagesRepository.getLastMessageBySessionId(sessionId);
      const nextOrder = lastMessage ? lastMessage.order + 1 : 1;

      await this.sessionMessagesRepository.create({
        accountId: session.accountId,
        projectId: session.projectId,
        surveyId: session.surveyId,
        sessionId: session.id,
        order: nextOrder,
        partialReport: JSON.stringify(partialReport),
        author: "client",
        text: clientMessage,
      });

      // Update report
      await this.sessionReportsRepository.updateBySessionId(
        sessionId,
        JSON.stringify(fullReport),
      );

      this.logger.info({ sessionId, partialDataCount: partialReport.data.length }, "Client message added");

      return { partialReport, fullReport };
    } catch (error) {
      this.logger.error(error, "Failed to add client message");

      throw error;
    }
  }

  public async decideAndAskNextQuestion({
    sessionId,
  }: DecideAndAskNextQuestionArgs): Promise<{ questionId: number | null; message: string; completed: boolean }> {
    try {
      this.logger.info({ sessionId }, "Deciding and asking next question");

      const session = await this.surveySessionsRepository.getById(sessionId);
      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const survey = await this.surveysRepository.getById(session.surveyId);
      if (!survey) {
        throw new Error(`Survey with id ${session.surveyId} not found`);
      }

      const lang = (survey.lang === "en" || survey.lang === "ru") ? survey.lang : "en";

      // Get all questions
      const allQuestionTemplates = await this.questionTemplatesRepository.findBySurveyId(session.surveyId);
      const sortedQuestions = allQuestionTemplates.sort((a, b) => a.order - b.order);

      // Get current report data
      const currentReportData = await this.getCurrentReportData(sessionId);
      if (!currentReportData) {
        throw new Error(`Report not found for session ${sessionId}`);
      }

      // Build question context with collected data
      const questionsContext = sortedQuestions.map((qt) => {
        // Find data collected for this question's dataKey
        const collectedData = (currentReportData.data || []).filter(
          (d: any) => d.key === qt.dataKey
        );

        return {
          id: qt.id,
          order: qt.order,
          dataKey: qt.dataKey,
          questionTemplate: qt.questionTemplate,
          successTemplate: qt.successTemplate,
          failTemplate: qt.failTemplate,
          type: qt.type,
          final: qt.final,
          collectedData: collectedData.length > 0 ? collectedData : undefined,
        };
      });

      // Get last client message for context
      const messages = await this.sessionMessagesRepository.findBySessionId(sessionId);
      const lastClientMessage = messages.filter(m => m.author === "client").pop()?.text || "";

      // Use AI to decide next question
      const decision = await this.aiService.decideNextQuestion({
        clientMessage: lastClientMessage,
        allQuestions: questionsContext,
        currentReportData: {
          conversation: currentReportData.conversation || [],
          data: currentReportData.data || [],
        },
        lang,
      });

      // Save agent message if there's a question to ask
      if (decision.questionId != null) {
        const lastMessage = await this.sessionMessagesRepository.getLastMessageBySessionId(sessionId);
        const nextOrder = lastMessage ? lastMessage.order + 1 : 0; // First message is order 0

        // Add agent message to report conversation BEFORE saving (so addClientMessage can find it)
        const generateId = (): string => {
          return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        };

        const agentMessageId = generateId();
        const updatedReportData = {
          ...currentReportData,
          conversation: [
            ...(currentReportData.conversation || []),
            {
              id: agentMessageId,
              author: "agent",
              text: decision.message,
              questionId: decision.questionId,
            },
          ],
        };

        // Update report with agent message
        await this.sessionReportsRepository.updateBySessionId(
          sessionId,
          JSON.stringify(updatedReportData),
        );

        await this.sessionMessagesRepository.create({
          accountId: session.accountId,
          projectId: session.projectId,
          surveyId: session.surveyId,
          sessionId: session.id,
          order: nextOrder,
          partialReport: JSON.stringify(updatedReportData),
          author: "agent",
          text: decision.message,
        });
      }

      // If completed, end session
      if (decision.completed) {
        await this.endSession({ sessionId });
      }

      this.logger.info(
        { sessionId, questionId: decision.questionId, completed: decision.completed },
        "Next question decided",
      );

      return decision;
    } catch (error) {
      this.logger.error(error, "Failed to decide and ask next question");

      throw error;
    }
  }
}
