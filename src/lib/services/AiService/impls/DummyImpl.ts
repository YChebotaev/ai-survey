import { type Logger } from "pino";
import type {
  RephraseQuestionArgs,
  RephraseCompletionArgs,
  CombineSuccessWithQuestionArgs,
  CombineFailWithQuestionArgs,
  ExtractDataArgs,
} from "../types";

export type DummyImplConfig = {
  logger: Logger;
};

export class DummyImpl {
  private readonly logger: Logger;

  constructor({ logger }: DummyImplConfig) {
    this.logger = logger;
  }

  public async rephraseQuestion({
    question,
    lang,
    currentDataState,
    previousConversation,
  }: RephraseQuestionArgs): Promise<string> {
    try {
      this.logger.info(
        { question, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Rephrasing question",
      );

      // For now, mock implementation - just return the question as-is
      // Dummy implementation accepts params but does nothing with them
      return question;
    } catch (error) {
      this.logger.error(error, "Failed to rephrase question");

      throw error;
    }
  }

  public async rephraseCompletion({ text, lang }: RephraseCompletionArgs): Promise<string> {
    try {
      this.logger.info({ text, lang }, "Rephrasing completion");

      // For now, mock implementation - just return the text as-is
      return text;
    } catch (error) {
      this.logger.error(error, "Failed to rephrase completion");

      throw error;
    }
  }

  public async combineSuccessWithQuestion({
    success,
    question,
    lang,
  }: CombineSuccessWithQuestionArgs): Promise<string> {
    try {
      this.logger.info({ success, question, lang }, "Combining success with question");

      // For now, mock implementation - combine with empty newline
      return `${success}\n\n${question}`;
    } catch (error) {
      this.logger.error(error, "Failed to combine success with question");

      throw error;
    }
  }

  public async combineFailWithQuestion({
    fail,
    question,
    lang,
  }: CombineFailWithQuestionArgs): Promise<string> {
    try {
      this.logger.info({ fail, question, lang }, "Combining fail with question");

      // For now, mock implementation - combine with empty newline
      return `${fail}\n\n${question}`;
    } catch (error) {
      this.logger.error(error, "Failed to combine fail with question");

      throw error;
    }
  }

  public async extractData({
    text,
    dataKey,
    lang,
    currentDataState,
    previousConversation,
  }: ExtractDataArgs): Promise<Record<string, any> | null> {
    try {
      this.logger.info(
        { text, dataKey, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Extracting data",
      );

      // For now, mock implementation - return data (will be stored by dataKey in report)
      // Dummy implementation accepts params but does nothing with them
      return {
        text,
      };
    } catch (error) {
      this.logger.error(error, "Failed to extract data");

      return null;
    }
  }
}
