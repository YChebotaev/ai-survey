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
    allDataKeys: string[],
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
      allDataKeys: string[],
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      const allDataKeysList = allDataKeys.map((key) => `"${key}"`).join(", ");
      let prompt = `You are a helpful assistant that extracts meaningful data from user responses. The user is answering a survey question, but they may provide information for multiple fields at once.

The current question is asking for data under the key "${currentQuestionDataKey}".

However, the user's response may contain information for ANY of the following data keys: [${allDataKeysList}].

Extract ALL possible data from the user's text that matches ANY of these data keys. Return a JSON object where each data key that has meaningful information is included with its extracted value.

IMPORTANT RULES:
1. If the user explicitly states there are NO problems, NO obstacles, or that everything is fine/clear, extract this as a meaningful value like "none", "no", "no problems", or "no obstacles" (NOT null).
2. If the user provides positive information (e.g., "ahead of schedule", "everything is clear"), this can also indicate no obstacles - extract it as "none" or a similar positive indicator.
3. Your response MUST contain the extracted data. If the user's response does not contain meaningful information for a particular data key, you MUST return null for that field. However, if the user explicitly states there are no problems/obstacles, you MUST extract this as a non-null value (like "none" or "no").
4. If the user provides meaningful information for any data key, you MUST extract it and return it in the JSON format. Return only valid JSON, no additional text.`;
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
      allDataKeys: string[],
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      const allDataKeysList = allDataKeys.map((key) => `"${key}"`).join(", ");
      let prompt = `Вы полезный помощник, который извлекает значимые данные из ответов пользователей. Пользователь отвечает на вопрос опроса, но может предоставить информацию для нескольких полей одновременно.

Текущий вопрос запрашивает данные под ключом "${currentQuestionDataKey}".

Однако, ответ пользователя может содержать информацию для ЛЮБОГО из следующих ключей данных: [${allDataKeysList}].

Извлеките ВСЕ возможные данные из текста пользователя, которые соответствуют ЛЮБОМУ из этих ключей данных. Верните JSON объект, где каждый ключ данных, для которого есть значимая информация, включен с его извлеченным значением.

ВАЖНЫЕ ПРАВИЛА:
1. Если пользователь явно указывает, что НЕТ проблем, НЕТ препятствий, или что всё хорошо/понятно, извлеките это как значимое значение, например "нет", "нет проблем", "нет препятствий" или "всё хорошо" (НЕ null).
2. Если пользователь предоставляет положительную информацию (например, "опережаю график", "всё понятно"), это также может указывать на отсутствие препятствий - извлеките это как "нет" или аналогичный положительный индикатор.
3. Ваш ответ ДОЛЖЕН содержать извлеченные данные. Если ответ пользователя не содержит значимой информации для конкретного ключа данных, вы ДОЛЖНЫ вернуть null для этого поля. Однако, если пользователь явно указывает, что нет проблем/препятствий, вы ДОЛЖНЫ извлечь это как ненулевое значение (например, "нет" или "нет проблем").
4. Если пользователь предоставляет значимую информацию для любого ключа данных, вы ДОЛЖНЫ извлечь её и вернуть в формате JSON. Возвращайте только валидный JSON, без дополнительного текста.`;
      return prompt;
    },
  },
};
