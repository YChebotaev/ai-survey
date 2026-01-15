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
};

export type CombineFailWithQuestionArgs = {
  fail: string;
  question: string;
  lang: SupportedLanguage;
};

export type ExtractDataArgs = {
  text: string;
  currentQuestionDataKey: string;
  allDataKeys: string[];
  lang: SupportedLanguage;
  currentDataState?: Record<string, any>;
  previousConversation?: Array<{ question: string; answer: string }>;
};

export interface AiServiceImpl {
  rephraseQuestion(args: RephraseQuestionArgs): Promise<string>;
  rephraseCompletion(args: RephraseCompletionArgs): Promise<string>;
  combineSuccessWithQuestion(args: CombineSuccessWithQuestionArgs): Promise<string>;
  combineFailWithQuestion(args: CombineFailWithQuestionArgs): Promise<string>;
  extractData(args: ExtractDataArgs): Promise<Record<string, any> | null>;
}
