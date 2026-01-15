import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface SessionQuestionsRepositoryConfig
  extends RepositoryBaseConfig {}

export type SessionQuestion = {
  id: number;
  accountId: number;
  projectId: number;
  surveyId: number;
  sessionId: number;
  questionId: number;
  questionText: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SessionQuestionCreateArgs = Omit<
  SessionQuestion,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class SessionQuestionsRepository extends RepositoryBase<SessionQuestionsRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    surveyId,
    sessionId,
    questionId,
    questionText,
  }: SessionQuestionCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      surveyId,
      sessionId,
      questionId,
      questionText,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create session question");
    }

    return this.getById(id);
  }

  public async getById(id: SessionQuestion["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as SessionQuestion | undefined;
  }

  public async findBySessionId(sessionId: SessionQuestion["sessionId"]) {
    const results = await this.db(this.tableName)
      .where({ sessionId, deleted: false })
      .orderBy("createdAt", "asc");

    return results as SessionQuestion[];
  }
}
