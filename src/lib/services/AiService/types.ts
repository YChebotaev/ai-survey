export type RephraseQuestionArgs = {
  question: string;
  currentDataState?: Record<string, any>;
  previousConversation?: Array<{ question: string; answer: string }>;
};

export type RephraseCompletionArgs = {
  text: string;
};

export type CombineSuccessWithQuestionArgs = {
  success: string;
  question: string;
};

export type CombineFailWithQuestionArgs = {
  fail: string;
  question: string;
};

export type ExtractDataArgs = {
  text: string;
  dataKey: string;
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
