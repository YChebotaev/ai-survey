import { type Logger } from "pino";
import { ServiceBase } from "./ServiceBase";
import { AiService } from "./AiService";
import {
  SurveysRepository,
  QuestionTemplatesRepository,
  SurveySessionsRepository,
  SessionQuestionsRepository,
  SessionAnswersRepository,
  SessionReportsRepository,
  type Survey,
  type QuestionTemplate,
  type SurveySession,
  type SessionQuestion,
  type SessionAnswer,
  type SessionReport,
} from "../repositories";

export type SurveySessionServiceConfig = {
  surveysRepository: SurveysRepository;
  questionTemplatesRepository: QuestionTemplatesRepository;
  surveySessionsRepository: SurveySessionsRepository;
  sessionQuestionsRepository: SessionQuestionsRepository;
  sessionAnswersRepository: SessionAnswersRepository;
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
  private readonly sessionQuestionsRepository: SessionQuestionsRepository;
  private readonly sessionAnswersRepository: SessionAnswersRepository;
  private readonly sessionReportsRepository: SessionReportsRepository;
  private readonly aiService: AiService;

  constructor({
    surveysRepository,
    questionTemplatesRepository,
    surveySessionsRepository,
    sessionQuestionsRepository,
    sessionAnswersRepository,
    sessionReportsRepository,
    aiService,
    logger,
  }: SurveySessionServiceConfig) {
    super(logger, {
      surveysRepository,
      questionTemplatesRepository,
      surveySessionsRepository,
      sessionQuestionsRepository,
      sessionAnswersRepository,
      sessionReportsRepository,
      aiService,
      logger,
    });

    this.surveysRepository = surveysRepository;
    this.questionTemplatesRepository = questionTemplatesRepository;
    this.surveySessionsRepository = surveySessionsRepository;
    this.sessionQuestionsRepository = sessionQuestionsRepository;
    this.sessionAnswersRepository = sessionAnswersRepository;
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

      if (firstQuestion) {
        const sessionQuestion = await this.sessionQuestionsRepository.create({
          accountId: survey.accountId,
          projectId: survey.projectId,
          surveyId: survey.id,
          sessionId: session.id,
          questionId: firstQuestion.id,
          questionText: firstQuestion.questionTemplate,
        });

        if (!sessionQuestion) {
          this.logger.warn({ sessionId: session.id, questionId: firstQuestion.id }, "Failed to create session question");
        }
      }

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
  }: AddQuestionAnswerArgs): Promise<SessionAnswer> {
    try {
      this.logger.info({ sessionId, questionId }, "Adding question answer");

      const session = await this.surveySessionsRepository.getById(sessionId);

      if (!session) {
        throw new Error(`Session with id ${sessionId} not found`);
      }

      const answer = await this.sessionAnswersRepository.create({
        accountId: session.accountId,
        projectId: session.projectId,
        surveyId: session.surveyId,
        sessionId: session.id,
        questionId,
        answerText,
        answerData,
      });

      if (!answer) {
        throw new Error("Failed to create session answer");
      }

      const sessionState = JSON.parse(session.sessionState);
      sessionState.currentOrder += 1;

      await this.surveySessionsRepository.updateSessionState(
        sessionId,
        JSON.stringify(sessionState),
      );

      const report = await this.sessionReportsRepository.findBySessionId(sessionId);

      if (report) {
        const questionTemplate = await this.questionTemplatesRepository.getById(questionId);
        
        if (questionTemplate) {
          const reportData = JSON.parse(report.data);
          
          // Ensure report has the new structure
          if (!reportData.conversation) {
            reportData.conversation = [];
          }
          if (!reportData.data) {
            reportData.data = [];
          }

          const extractedData = JSON.parse(answerData);
          
          // Get all question templates to find types for each dataKey
          const session = await this.surveySessionsRepository.getById(sessionId);
          if (!session) {
            throw new Error(`Session with id ${sessionId} not found`);
          }
          const allQuestionTemplates = await this.questionTemplatesRepository.findBySurveyId(session.surveyId);
          
          // Helper to generate random IDs
          const generateId = (): string => {
            return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          };

          // Accept "none", "no", "нет", "нет проблем" as valid values (not null)
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

          // Store ALL extracted data in the new format
          // Determine if data is "freeform" (direct answer to current question) or "extracted" (AI extracted from other questions)
          const currentQuestionDataKey = questionTemplate.dataKey;
          
          // #region agent log
          this.logger.info({ sessionId, questionId, currentQuestionDataKey, extractedDataKeys: Object.keys(extractedData), extractedData, answerText }, "Storing extracted data");
          fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SurveySessionService.ts:345',message:'Storing extracted data',data:{sessionId,questionId,currentQuestionDataKey,extractedDataKeys:Object.keys(extractedData),extractedData,answerText},timestamp:Date.now(),sessionId:'debug-session',runId:'test-scenarios',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          for (const [key, value] of Object.entries(extractedData)) {
            // Store value if it's not null, or if it's a valid "none" string value
            if (value != null || isNoneValue(value)) {
              if (!(typeof value === "object" && value != null && Object.keys(value).length === 0)) {
                // Determine data record type:
                // - "freeform": if this is the dataKey for the current question being answered (direct answer)
                // - "extracted": if this is a different dataKey (AI extracted from a message not specifically for this question)
                const isCurrentQuestion = key === currentQuestionDataKey;
                const dataRecordType = isCurrentQuestion ? "freeform" : "extracted";
                
                if (dataRecordType === "freeform") {
                  // For "freeform": ensure uniqueness - update existing or create new
                  const existingDataIndex = reportData.data.findIndex(
                    (d: any) => d.key === key && d.type === "freeform"
                  );
                  
                  if (existingDataIndex >= 0) {
                    // Update existing freeform entry (should be unique per key)
                    reportData.data[existingDataIndex].value = String(value);
                  } else {
                    // Create new freeform entry
                    const dataId = generateId();
                    reportData.data.push({
                      id: dataId,
                      key,
                      value: String(value),
                      type: "freeform",
                    });
                  }
                } else {
                  // For "extracted": always create new entry (allow duplicates with same key but different ids)
                  const dataId = generateId();
                  reportData.data.push({
                    id: dataId,
                    key,
                    value: String(value),
                    type: "extracted",
                  });
                  // #region agent log
                  this.logger.info({ sessionId, key, value, dataId, dataArrayLength: reportData.data.length, isCurrentQuestion: key === currentQuestionDataKey }, "Created extracted data entry");
                  fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SurveySessionService.ts:384',message:'Created extracted data entry',data:{sessionId,key,value,dataId,dataArrayLength:reportData.data.length,isCurrentQuestion:key===currentQuestionDataKey},timestamp:Date.now(),sessionId:'debug-session',runId:'test-scenarios',hypothesisId:'B'})}).catch(()=>{});
                  // #endregion
                }
              }
            }
          }

          // Add client answer to conversation
          const answerConversationId = generateId();
          // Find data entries for all keys that were extracted
          // For freeform, find the unique entry; for extracted, find the most recent one
          const answerDataIds: string[] = [];
          for (const [key, value] of Object.entries(extractedData)) {
            if (value != null || isNoneValue(value)) {
              if (!(typeof value === "object" && value != null && Object.keys(value).length === 0)) {
                const isCurrentQuestion = key === currentQuestionDataKey;
                let dataEntry;
                
                if (isCurrentQuestion) {
                  // For freeform, find the unique entry
                  dataEntry = reportData.data.find((d: any) => d.key === key && d.type === "freeform");
                } else {
                  // For extracted, find the most recent one (last in array)
                  const extractedEntries = reportData.data.filter((d: any) => d.key === key && d.type === "extracted");
                  dataEntry = extractedEntries[extractedEntries.length - 1];
                }
                
                if (dataEntry) {
                  answerDataIds.push(dataEntry.id);
                }
              }
            }
          }
          
          reportData.conversation.push({
            id: answerConversationId,
            author: "client",
            text: answerText,
            dataId: answerDataIds.length > 0 ? answerDataIds[0] : undefined, // Primary dataId (first one)
            answerId: answer.id,
          });

          await this.sessionReportsRepository.updateBySessionId(
            sessionId,
            JSON.stringify(reportData),
          );
          
          // #region agent log
          this.logger.info({ sessionId, dataArrayLength: reportData.data.length, dataEntries: reportData.data.map((d: any) => ({ key: d.key, type: d.type, value: d.value })) }, "Report updated after storing data");
          fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SurveySessionService.ts:438',message:'Report updated after storing data',data:{sessionId,dataArrayLength:reportData.data.length,dataEntries:reportData.data.map((d:any)=>({key:d.key,type:d.type,value:d.value}))},timestamp:Date.now(),sessionId:'debug-session',runId:'test-scenarios',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      }

      this.logger.info({ answerId: answer.id }, "Question answer added");

      return answer;
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

      // Fallback to old method using session questions and answers
      const questions = await this.sessionQuestionsRepository.findBySessionId(sessionId);
      const answers = await this.sessionAnswersRepository.findBySessionId(sessionId);

      const conversation: Array<{ question: string; answer: string }> = [];

      // Match questions and answers by order (they should be in chronological order)
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const answer = answers[i];

        if (question && answer) {
          conversation.push({
            question: question.questionText,
            answer: answer.answerText,
          });
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
}
