import { type Logger } from "pino";
import { ServiceBase } from "../ServiceBase";
import type {
  RephraseQuestionArgs,
  RephraseCompletionArgs,
  CombineSuccessWithQuestionArgs,
  CombineFailWithQuestionArgs,
  ExtractDataArgs,
  DecideNextQuestionArgs,
  AiServiceImpl,
} from "./types";

export type AiServiceConfig = {
  impl: AiServiceImpl;
  logger: Logger;
};

export class AiService extends ServiceBase<AiServiceConfig> {
  private readonly impl: AiServiceImpl;

  constructor({ impl, logger }: AiServiceConfig) {
    super(logger, { impl, logger });

    this.impl = impl;
  }

  public async rephraseQuestion(args: RephraseQuestionArgs): Promise<string> {
    return this.impl.rephraseQuestion(args);
  }

  public async rephraseCompletion(args: RephraseCompletionArgs): Promise<string> {
    return this.impl.rephraseCompletion(args);
  }

  public async combineSuccessWithQuestion(
    args: CombineSuccessWithQuestionArgs,
  ): Promise<string> {
    return this.impl.combineSuccessWithQuestion(args);
  }

  public async combineFailWithQuestion(args: CombineFailWithQuestionArgs): Promise<string> {
    return this.impl.combineFailWithQuestion(args);
  }

  public async extractData(args: ExtractDataArgs): Promise<Record<string, any> | null> {
    return this.impl.extractData(args);
  }

  public async decideNextQuestion(args: DecideNextQuestionArgs): Promise<{ questionId: number | null; message: string; completed: boolean }> {
    return this.impl.decideNextQuestion(args);
  }
}
