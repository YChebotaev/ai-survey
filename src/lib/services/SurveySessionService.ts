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

      const report = await this.sessionReportsRepository.create({
        accountId: survey.accountId,
        projectId: survey.projectId,
        surveyId: survey.id,
        sessionId: session.id,
        data: JSON.stringify({}),
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
          const extractedData = JSON.parse(answerData);
          
          // Store ALL extracted data (not just the current question's dataKey)
          // This allows extracting multiple dataKeys from a single answer
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

          for (const [key, value] of Object.entries(extractedData)) {
            // Store value if it's not null, or if it's a valid "none" string value
            if (value != null || isNoneValue(value)) {
              if (!(typeof value === "object" && value != null && Object.keys(value).length === 0)) {
                reportData[key] = value;
              }
            }
          }
          
          // Store raw input from user (not from AI)
          if (!reportData._rawInputs) {
            reportData._rawInputs = {};
          }
          reportData._rawInputs[questionTemplate.dataKey] = answerText;

          await this.sessionReportsRepository.updateBySessionId(
            sessionId,
            JSON.stringify(reportData),
          );
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
        return JSON.parse(report.data);
      } catch (error) {
        this.logger.error({ error, sessionId }, "Failed to parse report data");

        return null;
      }
    } catch (error) {
      this.logger.error(error, "Failed to get current report data");

      return null;
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
