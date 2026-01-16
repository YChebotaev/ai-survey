import { type Logger } from "pino";
import type {
  RephraseQuestionArgs,
  RephraseCompletionArgs,
  CombineSuccessWithQuestionArgs,
  CombineFailWithQuestionArgs,
  ExtractDataArgs,
  DecideNextQuestionArgs,
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
    currentDataState,
    previousConversation,
  }: CombineFailWithQuestionArgs): Promise<string> {
    try {
      this.logger.info(
        { fail, question, lang, hasDataState: !!currentDataState, conversationLength: previousConversation?.length },
        "Combining fail with question",
      );

      // For now, mock implementation - just combine with newline
      // Dummy implementation accepts params but does nothing with them
      return `${fail}\n\n${question}`;
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

      // Dummy implementation: Extract data using simple pattern matching
      // For freeform type, return full text for current question
      // Also try to extract other dataKeys using simple patterns
      const extractedData: Record<string, any> = {};
      
      // Always extract current question's dataKey
      extractedData[currentQuestionDataKey] = text;
      
      // Try to extract other dataKeys using simple pattern matching
      const textLower = text.toLowerCase();
      
      for (const key of allDataKeys) {
        if (key === currentQuestionDataKey) continue; // Skip current question
        
        const keyLower = key.toLowerCase();
        
        // For "todayPlan" or similar keys, look for patterns
        if (keyLower.includes("today") || keyLower.includes("plan") || keyLower.includes("планиру")) {
          // Skip extraction if current question is yesterdayWork and text is ambiguous
          // "Today KCD-12" when answering "What was done yesterday?" is likely about yesterday, not today
          const isAnsweringYesterday = currentQuestionDataKey.toLowerCase().includes("yesterday");
          const isSimpleTodayPattern = /^today\s+[A-Z]+-\d+$/i.test(text.trim());
          const hasTomorrowPattern = /(?:tomorrow|tommorow|завтра)/i.test(text);
          
          // Always try to extract "tomorrow" patterns, even if answering yesterday question
          // Pattern 1: "tomorrow KCD-13" or "tommorow KCD-13"
          const tomorrowPattern = /(?:tomorrow|tommorow|завтра)[\s,]+([A-Z]+-\d+[^.,]*?)(?:\.|,|$)/gi;
          const tomorrowMatch = text.match(tomorrowPattern);
          if (tomorrowMatch && tomorrowMatch[0]) {
            const taskPart = tomorrowMatch[0].replace(/(?:tomorrow|tommorow|завтра)[\s,]+/gi, "").trim();
            if (taskPart) {
              extractedData[key] = taskPart;
              continue;
            }
          }
          
          // Skip "Today" pattern extraction if answering yesterday with simple pattern (unless there's also tomorrow)
          if (isAnsweringYesterday && isSimpleTodayPattern && !hasTomorrowPattern) {
            // Don't extract todayPlan from "Today KCD-12" when answering yesterday question
            // This is likely a misstatement - user meant "yesterday" but said "today"
          } else {
            // Pattern 2: "Today: KCD-14 and KCD-15" or "Today KCD-14 and KCD-15" (with colon or multiple items)
            // Only match if there's a colon or multiple tasks, or if not answering yesterday question
            if (!isAnsweringYesterday || text.includes(":") || text.match(/kcd-\d+.*kcd-\d+/i)) {
              const todayColonPattern = /today[\s:]+([^.,]+?)(?:\.|,|$)/gi;
              const todayColonMatch = text.match(todayColonPattern);
              if (todayColonMatch && todayColonMatch[0]) {
                const taskPart = todayColonMatch[0].replace(/today[\s:]+/gi, "").trim();
                if (taskPart && !taskPart.toLowerCase().includes("done") && !taskPart.toLowerCase().includes("blockers")) {
                  extractedData[key] = taskPart;
                  continue;
                }
              }
            }
            
            // Pattern 3: "will continue", "going to", etc. (already handled by current question, but check if it's in a different context)
            const willPattern = /(?:will|going to|планирую)[\s:]*([^.,]+?)(?:\.|,|$)/gi;
            const willMatch = text.match(willPattern);
            if (willMatch && willMatch[0] && !textLower.includes("yesterday")) {
              const taskPart = willMatch[0].replace(/(?:will|going to|планирую)[\s:]+/gi, "").trim();
              if (taskPart && taskPart.length > 0) {
                extractedData[key] = taskPart;
              }
            }
          }
        }
        
        // For "roadblocks" or similar keys, look for patterns
        if (keyLower.includes("roadblock") || keyLower.includes("obstacle") || keyLower.includes("препятстви") || keyLower.includes("blocker")) {
          // Pattern 1: "Blockers: waiting for API access from DevOps"
          const blockersColonPattern = /blockers?[\s:]+([^.,]+?)(?:\.|,|$)/gi;
          const blockersColonMatch = text.match(blockersColonPattern);
          if (blockersColonMatch && blockersColonMatch[0]) {
            const blockerPart = blockersColonMatch[0].replace(/blockers?[\s:]+/gi, "").trim();
            if (blockerPart) {
              extractedData[key] = blockerPart;
              continue;
            }
          }
          
          // Pattern 2: "waiting for..." (when in context of blockers)
          if (textLower.includes("waiting") || textLower.includes("blocked")) {
            const waitingPattern = /(?:waiting|blocked)[\s:]+([^.,]+?)(?:\.|,|$)/gi;
            const waitingMatch = text.match(waitingPattern);
            if (waitingMatch && waitingMatch[0]) {
              const blockerPart = waitingMatch[0].replace(/(?:waiting|blocked)[\s:]+/gi, "").trim();
              if (blockerPart) {
                extractedData[key] = blockerPart;
              }
            }
          }
        }
      }
      
      // #region agent log
      this.logger.info({ extractedData, text, currentQuestionDataKey, allDataKeys }, "DummyImpl extracted data");
      fetch('http://127.0.0.1:7246/ingest/0478813b-8f08-4062-96b1-32f6e026bdfa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DummyImpl.ts:170',message:'DummyImpl extracted data',data:{extractedData,text,currentQuestionDataKey,allDataKeys},timestamp:Date.now(),sessionId:'debug-session',runId:'test-scenarios',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      return extractedData;
    } catch (error) {
      this.logger.error(error, "Failed to extract data");

      return null;
    }
  }

  public async decideNextQuestion({
    clientMessage,
    allQuestions,
    currentReportData,
    lang,
  }: DecideNextQuestionArgs): Promise<{ questionId: number | null; message: string; completed: boolean }> {
    try {
      this.logger.info(
        { allQuestionsCount: allQuestions.length, dataCount: currentReportData.data.length, lang },
        "Deciding next question",
      );

      // Simple logic: find first question without data, in order
      // This is a dummy implementation - real logic will be in YandexImpl
      let nextQuestion = null;
      let previousQuestion = null;

      for (const question of allQuestions) {
        const hasData = question.collectedData && question.collectedData.length > 0;
        
        if (!hasData && nextQuestion == null) {
          nextQuestion = question;
        }
        
        if (hasData) {
          previousQuestion = question;
        }
      }

      if (nextQuestion == null) {
        // All questions answered
        const lastQuestion = allQuestions[allQuestions.length - 1];
        const completionMessage = lastQuestion?.final 
          ? lastQuestion.successTemplate 
          : "Thank you! Survey completed.";

        return {
          questionId: null,
          message: completionMessage,
          completed: true,
        };
      }

      // Combine previous success template with next question
      let message = nextQuestion.questionTemplate;
      if (previousQuestion && previousQuestion.successTemplate) {
        message = `${previousQuestion.successTemplate}\n\n${nextQuestion.questionTemplate}`;
      }

      return {
        questionId: nextQuestion.id,
        message,
        completed: false,
      };
    } catch (error) {
      this.logger.error(error, "Failed to decide next question");

      throw error;
    }
  }
}
