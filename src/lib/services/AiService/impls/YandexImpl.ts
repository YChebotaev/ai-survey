import OpenAI from "openai";
import { type Logger } from "pino";
import type {
  RephraseQuestionArgs,
  RephraseCompletionArgs,
  CombineSuccessWithQuestionArgs,
  CombineFailWithQuestionArgs,
  ExtractDataArgs,
} from "../types";
import { aiPrompts } from "../localization";

export type YandexImplConfig = {
  yandexCloudFolder: string;
  yandexCloudApiKey: string;
  yandexCloudModel?: string;
  logger: Logger;
};

export class YandexImpl {
  private readonly client: OpenAI;
  private readonly yandexCloudFolder: string;
  private readonly yandexCloudModel: string;
  private readonly logger: Logger;

  constructor({
    yandexCloudFolder,
    yandexCloudApiKey,
    yandexCloudModel = "yandexgpt/latest",
    logger,
  }: YandexImplConfig) {
    this.yandexCloudFolder = yandexCloudFolder;
    this.yandexCloudModel = yandexCloudModel;
    this.logger = logger;

    this.client = new OpenAI({
      apiKey: yandexCloudApiKey,
      baseURL: "https://rest-assistant.api.cloud.yandex.net/v1",
      defaultHeaders: {
        "OpenAI-Project": yandexCloudFolder,
      },
    });
  }

  private normalizeJsonString(input: string): string | null {
    try {
      // Remove markdown code blocks (```json, ```, etc.)
      let normalized = input.replace(/```[a-z]*\n?/gi, "");

      // Remove escape symbols (backslashes before quotes, etc.)
      normalized = normalized.replace(/\\(.)/g, "$1");

      // Find the JSON object - look for the first { and matching }
      const firstBrace = normalized.indexOf("{");

      if (firstBrace === -1) {
        return null;
      }

      let braceCount = 0;
      let endBrace = -1;

      for (let i = firstBrace; i < normalized.length; i++) {
        if (normalized[i] === "{") {
          braceCount++;
        } else if (normalized[i] === "}") {
          braceCount--;

          if (braceCount === 0) {
            endBrace = i;
            break;
          }
        }
      }

      if (endBrace === -1) {
        return null;
      }

      // Extract only the JSON part
      const jsonString = normalized.substring(firstBrace, endBrace + 1);

      // Trim whitespace
      return jsonString.trim();
    } catch (error) {
      this.logger.error({ error, input }, "Failed to normalize JSON string");

      return null;
    }
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

      const hasDataState = !!(currentDataState && Object.keys(currentDataState).length > 0);
      const hasConversation = !!(previousConversation && previousConversation.length > 0);

      const instructions = hasDataState
        ? aiPrompts[lang].rephraseQuestionWithContext(question, hasDataState, hasConversation)
        : aiPrompts[lang].rephraseQuestion(question);

      let input = question;

      // For subsequent questions (not initial), include context
      if (hasDataState) {
        const dataStateJson = JSON.stringify(currentDataState, null, 2);
        input = `Current data state:\n${dataStateJson}\n\nQuestion to rephrase: ${question}`;
      }

      // Include previous conversation if available
      if (hasConversation) {
        const conversationText = previousConversation
          .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
          .join("\n\n");

        input = `Previous conversation:\n${conversationText}\n\n${input}`;
      }

      const response = await this.client.responses.create({
        model: `gpt://${this.yandexCloudFolder}/${this.yandexCloudModel}`,
        instructions,
        input,
        temperature: 0.3,
        max_output_tokens: 500,
      });

      const result = response.output_text || question;

      this.logger.info(
        { original: question, rephrased: result },
        "Question rephrased",
      );

      return result;
    } catch (error) {
      this.logger.error(error, "Failed to rephrase question");

      throw error;
    }
  }

  public async rephraseCompletion({
    text,
    lang,
  }: RephraseCompletionArgs): Promise<string> {
    try {
      this.logger.info({ text, lang }, "Rephrasing completion");

      const response = await this.client.responses.create({
        model: `gpt://${this.yandexCloudFolder}/${this.yandexCloudModel}`,
        instructions: aiPrompts[lang].rephraseCompletion(text),
        input: text,
        temperature: 0.3,
        max_output_tokens: 500,
      });

      const result = response.output_text || text;

      this.logger.info(
        { original: text, rephrased: result },
        "Completion rephrased",
      );

      return result;
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
      this.logger.info(
        { success, question, lang },
        "Combining success with question",
      );

      const response = await this.client.responses.create({
        model: `gpt://${this.yandexCloudFolder}/${this.yandexCloudModel}`,
        instructions: aiPrompts[lang].combineSuccessWithQuestion(success, question),
        input: `Success message: ${success}\n\nFollow-up question: ${question}`,
        temperature: 0.3,
        max_output_tokens: 500,
      });

      const result = response.output_text || `${success}\n\n${question}`;

      this.logger.info(
        { success, question, combined: result },
        "Success combined with question",
      );

      return result;
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

      const response = await this.client.responses.create({
        model: `gpt://${this.yandexCloudFolder}/${this.yandexCloudModel}`,
        instructions: aiPrompts[lang].combineFailWithQuestion(fail, question),
        input: `Failure message: ${fail}\n\nQuestion to repeat: ${question}`,
        temperature: 0.3,
        max_output_tokens: 500,
      });

      const result = response.output_text || `${fail}\n\n${question}`;

      this.logger.info(
        { fail, question, combined: result },
        "Fail combined with question",
      );

      return result;
    } catch (error) {
      this.logger.error(error, "Failed to combine fail with question");

      throw error;
    }
  }

  public async extractData({
    text,
    currentQuestionDataKey,
    allDataKeys,
    lang,
    currentDataState,
    previousConversation,
  }: ExtractDataArgs): Promise<Record<string, any> | null> {
    try {
      this.logger.info(
        { text, currentQuestionDataKey, allDataKeys, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Extracting data",
      );

      const hasDataState = !!(currentDataState && Object.keys(currentDataState).length > 0);
      const hasConversation = !!(previousConversation && previousConversation.length > 0);

      const instructions = aiPrompts[lang].extractData(
        text,
        currentQuestionDataKey,
        allDataKeys,
        hasDataState,
        hasConversation,
      );

      let input = `Extract meaningful data from this text. Current question is asking for "${currentQuestionDataKey}", but extract ALL data that matches any of these keys: [${allDataKeys.join(", ")}]. Text: ${text}`;

      // Include current data state if available
      if (currentDataState && Object.keys(currentDataState).length > 0) {
        const dataStateJson = JSON.stringify(currentDataState, null, 2);
        input = `Current data state:\n${dataStateJson}\n\n${input}`;
      }

      // Include previous conversation if available
      if (previousConversation && previousConversation.length > 0) {
        const conversationText = previousConversation
          .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
          .join("\n\n");

        input = `Previous conversation:\n${conversationText}\n\n${input}`;
      }

      const response = await this.client.responses.create({
        model: `gpt://${this.yandexCloudFolder}/${this.yandexCloudModel}`,
        instructions,
        input,
        temperature: 0.3,
        max_output_tokens: 500,
      });

      const outputText = response.output_text;

      if (!outputText) {
        this.logger.warn(
          { text, currentQuestionDataKey, allDataKeys },
          "No output from AI for data extraction",
        );

        return null;
      }

      const normalizedJson = this.normalizeJsonString(outputText);

      if (!normalizedJson) {
        this.logger.error(
          { outputText, text, currentQuestionDataKey, allDataKeys },
          "Failed to normalize JSON string from AI response",
        );

        return null;
      }

      try {
        const extractedData = JSON.parse(normalizedJson);

        // Check if extracted data is null or empty object
        if (extractedData == null || (typeof extractedData === "object" && Object.keys(extractedData).length === 0)) {
          this.logger.warn(
            { text, currentQuestionDataKey, allDataKeys, extractedData },
            "Extracted data is null or empty object - will trigger fail branch",
          );

          return null;
        }

        // Check if the currentQuestionDataKey field exists and is meaningful
        // But also accept if ANY dataKey has meaningful data
        const hasCurrentKeyData =
          extractedData[currentQuestionDataKey] != null &&
          !(typeof extractedData[currentQuestionDataKey] === "object" &&
            Object.keys(extractedData[currentQuestionDataKey]).length === 0);

        const hasAnyKeyData = allDataKeys.some(
          (key) =>
            extractedData[key] != null &&
            !(typeof extractedData[key] === "object" && Object.keys(extractedData[key]).length === 0),
        );

        if (!hasCurrentKeyData && !hasAnyKeyData) {
          this.logger.warn(
            { text, currentQuestionDataKey, allDataKeys, extractedData },
            "No meaningful data extracted for any dataKey - will trigger fail branch",
          );

          return null;
        }

        this.logger.info(
          { text, currentQuestionDataKey, allDataKeys, extractedData },
          "Data extracted",
        );

        return extractedData;
      } catch (parseError) {
        this.logger.error(
          { parseError, normalizedJson, outputText, text, currentQuestionDataKey, allDataKeys },
          "Failed to parse normalized JSON",
        );

        return null;
      }
    } catch (error) {
      this.logger.error(error, "Failed to extract data");

      return null;
    }
  }
}
