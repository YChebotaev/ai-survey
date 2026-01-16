import type { SupportedLanguage } from "../../types";

export type RephraseQuestionArgs = {
  question: string;
  lang: SupportedLanguage;
  currentDataState?: Record<string, any>;
  previousConversation?: Array<{ question: string; answer: string }>;
};

export type RephraseCompletionArgs = {
  text: string;
  lang: SupportedLanguage;
};

export type CombineSuccessWithQuestionArgs = {
  success: string;
  question: string;
  lang: SupportedLanguage;
  currentDataState?: Record<string, any>;
  previousConversation?: Array<{ question: string; answer: string }>;
};

export type CombineFailWithQuestionArgs = {
  fail: string;
  question: string;
  lang: SupportedLanguage;
  currentDataState?: Record<string, any>;
  previousConversation?: Array<{ question: string; answer: string }>;
};

export type ExtractDataArgs = {
  text: string;
  currentQuestionDataKey: string;
  currentQuestionType: string;
  allDataKeys: string[];
  allQuestionTypes: Record<string, string>; // Map of dataKey -> type
  lang: SupportedLanguage;
  currentDataState?: Record<string, any>;
  previousConversation?: Array<{ question: string; answer: string }>;
};

export type QuestionContext = {
  id: number;
  order: number;
  dataKey: string;
  questionTemplate: string;
  successTemplate: string;
  failTemplate: string;
  type: string;
  final: boolean;
  collectedData?: Array<{ id: string; key: string; value: string; type: string }>; // Data collected for this question
};

export type DecideNextQuestionArgs = {
  clientMessage: string;
  allQuestions: QuestionContext[]; // All questions in order, with collected data
  currentReportData: {
    conversation: Array<{ id: string; author: string; text: string; dataId?: string; questionId?: number; answerId?: string }>;
    data: Array<{ id: string; key: string; value: string; type: string }>;
  };
  lang: SupportedLanguage;
};

export interface AiServiceImpl {
  rephraseQuestion(args: RephraseQuestionArgs): Promise<string>;
  rephraseCompletion(args: RephraseCompletionArgs): Promise<string>;
  combineSuccessWithQuestion(args: CombineSuccessWithQuestionArgs): Promise<string>;
  combineFailWithQuestion(args: CombineFailWithQuestionArgs): Promise<string>;
  extractData(args: ExtractDataArgs): Promise<Record<string, any> | null>;
  decideNextQuestion(args: DecideNextQuestionArgs): Promise<{ questionId: number | null; message: string; completed: boolean }>;
}
