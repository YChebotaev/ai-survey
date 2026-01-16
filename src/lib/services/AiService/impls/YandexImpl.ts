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
    currentDataState,
    previousConversation,
  }: CombineSuccessWithQuestionArgs): Promise<string> {
    try {
      this.logger.info(
        { success, question, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Combining success with question",
      );

      let input = `Success message: ${success}\n\nFollow-up question: ${question}`;

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
        instructions: aiPrompts[lang].combineSuccessWithQuestion(success, question),
        input,
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
    currentDataState,
    previousConversation,
  }: CombineFailWithQuestionArgs): Promise<string> {
    try {
      this.logger.info(
        { fail, question, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Combining fail with question",
      );

      let input = `Failure message: ${fail}\n\nQuestion: ${question}`;

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
        instructions: aiPrompts[lang].combineFailWithQuestion(fail, question),
        input,
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
    currentQuestionType,
    allDataKeys,
    allQuestionTypes,
    lang,
    currentDataState,
    previousConversation,
  }: ExtractDataArgs): Promise<Record<string, any> | null> {
    try {
      this.logger.info(
        { text, currentQuestionDataKey, currentQuestionType, allDataKeys, allQuestionTypes, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Extracting data",
      );

      const hasDataState = !!(currentDataState && Object.keys(currentDataState).length > 0);
      const hasConversation = !!(previousConversation && previousConversation.length > 0);

      const instructions = aiPrompts[lang].extractData(
        text,
        currentQuestionDataKey,
        currentQuestionType,
        allDataKeys,
        allQuestionTypes,
        hasDataState,
        hasConversation,
      );

      // For "freeform" type, extract the entire text as-is for the current question, but still extract other dataKeys
      let extractionInstruction = "";
      if (currentQuestionType === "freeform") {
        extractionInstruction = `CRITICAL INSTRUCTIONS:
1. For the current question's dataKey "${currentQuestionDataKey}" (type: "freeform"): Extract the ENTIRE answer text as-is. Do not summarize, rephrase, or extract specific parts - use the full text: "${text}"
2. For ALL OTHER dataKeys in [${allDataKeys.filter(k => k !== currentQuestionDataKey).join(", ")}]: Extract meaningful data from the same text as you normally would. The user's response may contain information for multiple questions at once.

IMPORTANT: Even though the current question is "freeform", you MUST still extract data for ALL other dataKeys that appear in the text.`;
      } else {
        extractionInstruction = `Extract meaningful data from this text. Current question is asking for "${currentQuestionDataKey}" with type "${currentQuestionType}", but extract ALL data that matches any of these keys: [${allDataKeys.join(", ")}].`;
      }

      let input = `${extractionInstruction}

CRITICAL: If the user explicitly states there are NO problems, NO obstacles, or that everything is fine/clear/good, you MUST extract this as a meaningful string value like "none", "no", "no problems", "no obstacles", "нет", "нет проблем", or "нет препятствий" (NOT null). For example:
- "no problems" → "no problems" or "none"
- "проблем нет" → "нет проблем" or "нет"
- "everything is clear" → "none" or "no problems"
- "всё понятно" → "нет" or "нет проблем"

Text: ${text}`;

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

      // #region agent log
      this.logger.info({ instructions, input, currentQuestionDataKey, allDataKeys }, "Sending extraction request to AI");
      // #endregion
      
      const response = await this.client.responses.create({
        model: `gpt://${this.yandexCloudFolder}/${this.yandexCloudModel}`,
        instructions,
        input,
        temperature: 0.3,
        max_output_tokens: 500,
      });

      const outputText = response.output_text;
      
      // #region agent log
      this.logger.info({ outputText, currentQuestionDataKey, allDataKeys }, "Received extraction response from AI");
      // #endregion

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
        // Accept "none", "no", "нет", "нет проблем" as valid answers (not null)
        const isNoneValue = (value: any): boolean => {
          if (typeof value === "string") {
            const lower = value.toLowerCase();
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

        const hasCurrentKeyData =
          (extractedData[currentQuestionDataKey] != null || isNoneValue(extractedData[currentQuestionDataKey])) &&
          !(typeof extractedData[currentQuestionDataKey] === "object" &&
            extractedData[currentQuestionDataKey] != null &&
            Object.keys(extractedData[currentQuestionDataKey]).length === 0);

        const hasAnyKeyData = allDataKeys.some(
          (key) =>
            (extractedData[key] != null || isNoneValue(extractedData[key])) &&
            !(typeof extractedData[key] === "object" &&
              extractedData[key] != null &&
              Object.keys(extractedData[key]).length === 0),
        );

        if (!hasCurrentKeyData && !hasAnyKeyData) {
          this.logger.warn(
            { text, currentQuestionDataKey, allDataKeys, extractedData },
            "No meaningful data extracted for any dataKey - will trigger fail branch",
          );

          return null;
        }

        // Post-process: Handle "freeform" type - if current question is freeform and data wasn't extracted, use full text
        if (currentQuestionType === "freeform") {
          if (extractedData[currentQuestionDataKey] == null || extractedData[currentQuestionDataKey] === "") {
            extractedData[currentQuestionDataKey] = text;
            this.logger.info(
              { key: currentQuestionDataKey, type: currentQuestionType },
              "Extracted full text for freeform type",
            );
          }
          
          // Post-process: Try to extract other dataKeys from the text when AI returned null
          // This is a fallback when the AI doesn't extract data for other keys
          this.logger.info(
            { currentQuestionDataKey, allDataKeys, extractedData, text },
            "Starting fallback pattern matching for freeform type",
          );
          
          for (const key of allDataKeys) {
            if (key === currentQuestionDataKey) continue; // Skip current question
            
            // Only try fallback if AI returned null
            if (extractedData[key] == null || extractedData[key] === "") {
              // Try to find relevant text patterns for common dataKeys
              const textLower = text.toLowerCase();
              const keyLower = key.toLowerCase();
              
              this.logger.info(
                { key, keyLower, textLower, text },
                "Attempting fallback extraction for key",
              );
              
              // For "todayPlan" or similar keys, look for patterns like "сегодня", "today", "планирую", "plan"
              if (keyLower.includes("today") || keyLower.includes("plan") || keyLower.includes("планиру")) {
                // Look for sentences containing "today", "сегодня", "plan", "планирую"
                // Improved patterns that match the full sentence
                const todayPatterns = [
                  /(?:сегодня|today)[^.]*(?:планирую|plan|сделаю|will|going to)[^.]*/gi,
                  /(?:планирую|plan|сделаю|will|going to)[^.]*(?:сегодня|today)[^.]*/gi,
                  /сегодня[^.]*планирую[^.]*/gi,
                  /today[^.]*plan[^.]*/gi,
                ];
                
                for (const pattern of todayPatterns) {
                  const match = text.match(pattern);
                  this.logger.info(
                    { key, pattern: pattern.toString(), match: match?.[0] },
                    "Testing today pattern",
                  );
                  if (match && match[0]) {
                    extractedData[key] = match[0].trim();
                    this.logger.info(
                      { key, extractedValue: extractedData[key], method: "fallback-pattern-matching" },
                      "Extracted data using fallback pattern matching",
                    );
                    break;
                  }
                }
              }
              
              // For "yesterdayWork" or similar keys, look for patterns like "вчера", "yesterday"
              if (keyLower.includes("yesterday") || keyLower.includes("вчера") || keyLower.includes("work")) {
                const yesterdayPatterns = [
                  /(?:вчера|yesterday)[^.]*(?:работал|worked|делал|did)[^.]*/gi,
                  /(?:работал|worked|делал|did)[^.]*(?:вчера|yesterday)[^.]*/gi,
                  /вчера[^.]*работал[^.]*/gi,
                  /yesterday[^.]*worked[^.]*/gi,
                ];
                
                for (const pattern of yesterdayPatterns) {
                  const match = text.match(pattern);
                  this.logger.info(
                    { key, pattern: pattern.toString(), match: match?.[0] },
                    "Testing yesterday pattern",
                  );
                  if (match && match[0]) {
                    extractedData[key] = match[0].trim();
                    this.logger.info(
                      { key, extractedValue: extractedData[key], method: "fallback-pattern-matching" },
                      "Extracted data using fallback pattern matching",
                    );
                    break;
                  }
                }
              }
            }
          }
          
          this.logger.info(
            { extractedDataAfterFallback: extractedData },
            "Completed fallback pattern matching",
          );
        }

        // Post-process: if user said "no problems" but AI extracted null, convert to "none"
        // This handles cases where the AI didn't follow the instruction perfectly
        const noProblemsIndicators = [
          "no problems",
          "no obstacles",
          "нет проблем",
          "нет препятствий",
          "всё понятно",
          "всё хорошо",
          "everything is clear",
          "everything is fine",
          "опережаю график",
          "ahead of schedule",
        ];
        const textLower = text.toLowerCase();
        const hasNoProblemsIndicator = noProblemsIndicators.some((indicator) =>
          textLower.includes(indicator.toLowerCase()),
        );

        // If text indicates "no problems" but roadblocks/obstacles dataKey is null, set it to "none"
        for (const key of allDataKeys) {
          if (
            (key.toLowerCase().includes("roadblock") ||
              key.toLowerCase().includes("obstacle") ||
              key.toLowerCase().includes("препятстви")) &&
            (extractedData[key] == null || extractedData[key] === "") &&
            hasNoProblemsIndicator
          ) {
            extractedData[key] = lang === "ru" ? "нет" : "none";
            this.logger.info(
              { key, originalValue: extractedData[key], newValue: extractedData[key] },
              "Converted null to 'none' for no-problems indicator",
            );
          }
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
