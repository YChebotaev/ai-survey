import type { SupportedLanguage } from "../../types";

export type AiPromptLocalization = {
  rephraseQuestion: (question: string) => string;
  rephraseQuestionWithContext: (
    question: string,
    hasDataState: boolean,
    hasConversation: boolean,
  ) => string;
  rephraseCompletion: (text: string) => string;
  combineSuccessWithQuestion: (success: string, question: string) => string;
  combineFailWithQuestion: (fail: string, question: string) => string;
    extractData: (
      text: string,
      currentQuestionDataKey: string,
      currentQuestionType: string,
      allDataKeys: string[],
      allQuestionTypes: Record<string, string>,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => string;
};

export const aiPrompts: Record<SupportedLanguage, AiPromptLocalization> = {
  en: {
    rephraseQuestion: (question: string) =>
      "You are a helpful assistant that rephrases questions to make them more natural and conversational while preserving their original meaning.",
    rephraseQuestionWithContext: (
      question: string,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      let prompt =
        "You are a helpful assistant that rephrases questions to make them more natural and conversational while preserving their original meaning.";
      if (hasDataState) {
        prompt +=
          "\n\nYou have access to the current state of collected data. Use this context to make the question more relevant and personalized.";
      }
      return prompt;
    },
    rephraseCompletion: (text: string) =>
      "You are a helpful assistant that rephrases completion messages to make them more natural and conversational while preserving their original meaning.",
    combineSuccessWithQuestion: (success: string, question: string) =>
      "You are a helpful assistant that combines a success message with a follow-up question in a natural, conversational way. First, rephrase the question to make it more natural and conversational while preserving its original meaning. Then, combine the success message with the rephrased question so they flow smoothly together.",
    combineFailWithQuestion: (fail: string, question: string) =>
      "You are a helpful assistant that combines a failure/retry message with a question in a natural, conversational way. First, rephrase the question to make it more natural and conversational while preserving its original meaning. Then, combine the failure message with the rephrased question so they flow smoothly together, encouraging the user to try again.",
    extractData: (
      text: string,
      currentQuestionDataKey: string,
      currentQuestionType: string,
      allDataKeys: string[],
      allQuestionTypes: Record<string, string>,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      const allDataKeysList = allDataKeys.map((key) => `"${key}"`).join(", ");
      const typeInstructions = Object.entries(allQuestionTypes)
        .map(([key, type]) => {
          if (type === "freeform") {
            return `- "${key}": type is "freeform" - extract the ENTIRE answer text as-is for this key`;
          }
          return `- "${key}": type is "${type}"`;
        })
        .join("\n");

      const otherDataKeys = allDataKeys.filter(k => k !== currentQuestionDataKey);
      const otherDataKeysList = otherDataKeys.map((key) => `"${key}"`).join(", ");
      
      let prompt = `You are a helpful assistant that extracts meaningful data from user responses. The user is answering a survey question, but they may provide information for multiple fields at once.

The current question is asking for data under the key "${currentQuestionDataKey}" with type "${currentQuestionType}".

However, the user's response may contain information for ANY of the following data keys: [${allDataKeysList}].

Question types and extraction rules:
${typeInstructions}

IMPORTANT RULES:
1. For "freeform" type questions: For the CURRENT question's dataKey ("${currentQuestionDataKey}"), extract the ENTIRE answer text as-is. Do not summarize, rephrase, or extract specific parts - use the full text the user provided.
2. CRITICAL: Even if the current question is "freeform", you MUST STILL extract data for ALL OTHER dataKeys (${otherDataKeysList ? `[${otherDataKeysList}]` : "none"}) from the same text. The user may provide answers to multiple questions in a single response.
3. If the user explicitly states there are NO problems, NO obstacles, or that everything is fine/clear, extract this as a meaningful value like "none", "no", "no problems", or "no obstacles" (NOT null).
4. If the user provides positive information (e.g., "ahead of schedule", "everything is clear"), this can also indicate no obstacles - extract it as "none" or a similar positive indicator.
5. Your response MUST contain the extracted data. If the user's response does not contain meaningful information for a particular data key, you MUST return null for that field. However, if the user explicitly states there are no problems/obstacles, you MUST extract this as a non-null value (like "none" or "no").
6. If the user provides meaningful information for any data key, you MUST extract it and return it in the JSON format. Return only valid JSON, no additional text.`;
      return prompt;
    },
  },
  ru: {
    rephraseQuestion: (question: string) =>
      "Вы полезный помощник, который перефразирует вопросы, чтобы сделать их более естественными и разговорными, сохраняя при этом их первоначальный смысл.",
    rephraseQuestionWithContext: (
      question: string,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      let prompt =
        "Вы полезный помощник, который перефразирует вопросы, чтобы сделать их более естественными и разговорными, сохраняя при этом их первоначальный смысл.";
      if (hasDataState) {
        prompt +=
          "\n\nУ вас есть доступ к текущему состоянию собранных данных. Используйте этот контекст, чтобы сделать вопрос более релевантным и персонализированным.";
      }
      return prompt;
    },
    rephraseCompletion: (text: string) =>
      "Вы полезный помощник, который перефразирует сообщения о завершении, чтобы сделать их более естественными и разговорными, сохраняя при этом их первоначальный смысл.",
    combineSuccessWithQuestion: (success: string, question: string) =>
      "Вы полезный помощник, который естественным, разговорным образом объединяет сообщение об успехе со следующим вопросом. Сначала перефразируйте вопрос, чтобы сделать его более естественным и разговорным, сохраняя при этом его первоначальный смысл. Затем объедините сообщение об успехе с перефразированным вопросом так, чтобы они плавно переходили друг в друга.",
    combineFailWithQuestion: (fail: string, question: string) =>
      "Вы полезный помощник, который естественным, разговорным образом объединяет сообщение об ошибке/повторе с вопросом. Сначала перефразируйте вопрос, чтобы сделать его более естественным и разговорным, сохраняя при этом его первоначальный смысл. Затем объедините сообщение об ошибке с перефразированным вопросом так, чтобы они плавно переходили друг в друга, побуждая пользователя попробовать снова.",
    extractData: (
      text: string,
      currentQuestionDataKey: string,
      currentQuestionType: string,
      allDataKeys: string[],
      allQuestionTypes: Record<string, string>,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      const allDataKeysList = allDataKeys.map((key) => `"${key}"`).join(", ");
      const typeInstructions = Object.entries(allQuestionTypes)
        .map(([key, type]) => {
          if (type === "freeform") {
            return `- "${key}": тип "freeform" - извлеките ВЕСЬ текст ответа как есть для этого ключа`;
          }
          return `- "${key}": тип "${type}"`;
        })
        .join("\n");

      const otherDataKeys = allDataKeys.filter(k => k !== currentQuestionDataKey);
      const otherDataKeysList = otherDataKeys.map((key) => `"${key}"`).join(", ");
      
      let prompt = `Вы полезный помощник, который извлекает значимые данные из ответов пользователей. Пользователь отвечает на вопрос опроса, но может предоставить информацию для нескольких полей одновременно.

Текущий вопрос запрашивает данные под ключом "${currentQuestionDataKey}" с типом "${currentQuestionType}".

Однако, ответ пользователя может содержать информацию для ЛЮБОГО из следующих ключей данных: [${allDataKeysList}].

Типы вопросов и правила извлечения:
${typeInstructions}

ВАЖНЫЕ ПРАВИЛА:
1. Для вопросов типа "freeform": Для ТЕКУЩЕГО вопроса с ключом "${currentQuestionDataKey}" извлеките ВЕСЬ текст ответа как есть. Не суммируйте, не перефразируйте и не извлекайте отдельные части - используйте полный текст, который предоставил пользователь.
2. КРИТИЧЕСКИ ВАЖНО: Даже если текущий вопрос имеет тип "freeform", вы ДОЛЖНЫ ВСЕ РАВНО извлекать данные для ВСЕХ ДРУГИХ ключей данных (${otherDataKeysList ? `[${otherDataKeysList}]` : "нет"}) из того же текста. Пользователь может предоставить ответы на несколько вопросов в одном сообщении.
3. Если пользователь явно указывает, что НЕТ проблем, НЕТ препятствий, или что всё хорошо/понятно, извлеките это как значимое значение, например "нет", "нет проблем", "нет препятствий" или "всё хорошо" (НЕ null).
4. Если пользователь предоставляет положительную информацию (например, "опережаю график", "всё понятно"), это также может указывать на отсутствие препятствий - извлеките это как "нет" или аналогичный положительный индикатор.
5. Ваш ответ ДОЛЖЕН содержать извлеченные данные. Если ответ пользователя не содержит значимой информации для конкретного ключа данных, вы ДОЛЖНЫ вернуть null для этого поля. Однако, если пользователь явно указывает, что нет проблем/препятствий, вы ДОЛЖНЫ извлечь это как ненулевое значение (например, "нет" или "нет проблем").
6. Если пользователь предоставляет значимую информацию для любого ключа данных, вы ДОЛЖНЫ извлечь её и вернуть в формате JSON. Возвращайте только валидный JSON, без дополнительного текста.`;
      return prompt;
    },
  },
};
