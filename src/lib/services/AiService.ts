import { type Logger } from "pino";
import { ServiceBase } from "./ServiceBase";

export type AiServiceConfig = {
  logger: Logger;
};

export type RephraseQuestionArgs = {
  question: string;
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
};

export class AiService extends ServiceBase<AiServiceConfig> {
  constructor({ logger }: AiServiceConfig) {
    super(logger, { logger });
  }

  public async rephraseQuestion({ question }: RephraseQuestionArgs): Promise<string> {
    try {
      this.logger.info({ question }, "Rephrasing question");

      // For now, mock implementation - just return the question as-is
      return question;
    } catch (error) {
      this.logger.error(error, "Failed to rephrase question");

      throw error;
    }
  }

  public async rephraseCompletion({ text }: RephraseCompletionArgs): Promise<string> {
    try {
      this.logger.info({ text }, "Rephrasing completion");

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
  }: CombineSuccessWithQuestionArgs): Promise<string> {
    try {
      this.logger.info({ success, question }, "Combining success with question");

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
  }: CombineFailWithQuestionArgs): Promise<string> {
    try {
      this.logger.info({ fail, question }, "Combining fail with question");

      // For now, mock implementation - combine with empty newline
      return `${fail}\n\n${question}`;
    } catch (error) {
      this.logger.error(error, "Failed to combine fail with question");

      throw error;
    }
  }

  public async extractData({ text, dataKey }: ExtractDataArgs): Promise<Record<string, any> | null> {
    try {
      this.logger.info({ text, dataKey }, "Extracting data");

      // For now, mock implementation - return data (will be stored by dataKey in report)
      // In real implementation, this would use AI to extract meaningful data
      return {
        text,
      };
    } catch (error) {
      this.logger.error(error, "Failed to extract data");

      return null;
    }
  }
}
