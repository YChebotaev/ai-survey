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
    dataKey: string,
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
      "You are a helpful assistant that combines a success message with a follow-up question in a natural, conversational way. The success message should flow smoothly into the question.",
    combineFailWithQuestion: (fail: string, question: string) =>
      "You are a helpful assistant that combines a failure/retry message with a question in a natural, conversational way. The failure message should flow smoothly into the question, encouraging the user to try again.",
    extractData: (
      text: string,
      dataKey: string,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      let prompt = `You are a helpful assistant that extracts meaningful data from user responses. Extract the key information from the user's text and return it as a JSON object. The data should be stored under the key "${dataKey}". 

IMPORTANT: Your response MUST contain the extracted data. If the user's response does not contain meaningful information for the requested data, you MUST return null or an empty object for that field. However, if the user provides meaningful information, you MUST extract it and return it in the JSON format. Return only valid JSON, no additional text.`;
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
      "Вы полезный помощник, который естественным, разговорным образом объединяет сообщение об успехе со следующим вопросом. Сообщение об успехе должно плавно переходить в вопрос.",
    combineFailWithQuestion: (fail: string, question: string) =>
      "Вы полезный помощник, который естественным, разговорным образом объединяет сообщение об ошибке/повторе с вопросом. Сообщение об ошибке должно плавно переходить в вопрос, побуждая пользователя попробовать снова.",
    extractData: (
      text: string,
      dataKey: string,
      hasDataState: boolean,
      hasConversation: boolean,
    ) => {
      let prompt = `Вы полезный помощник, который извлекает значимые данные из ответов пользователей. Извлеките ключевую информацию из текста пользователя и верните её в виде JSON объекта. Данные должны быть сохранены под ключом "${dataKey}". 

ВАЖНО: Ваш ответ ДОЛЖЕН содержать извлеченные данные. Если ответ пользователя не содержит значимой информации для запрошенных данных, вы ДОЛЖНЫ вернуть null или пустой объект для этого поля. Однако, если пользователь предоставляет значимую информацию, вы ДОЛЖНЫ извлечь её и вернуть в формате JSON. Возвращайте только валидный JSON, без дополнительного текста.`;
      return prompt;
    },
  },
};
