import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface SessionAnswersRepositoryConfig extends RepositoryBaseConfig {}

export type SessionAnswer = {
  id: number;
  accountId: number;
  projectId: number;
  surveyId: number;
  sessionId: number;
  questionId: number;
  answerText: string;
  answerData: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SessionAnswerCreateArgs = Omit<
  SessionAnswer,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class SessionAnswersRepository extends RepositoryBase<SessionAnswersRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    surveyId,
    sessionId,
    questionId,
    answerText,
    answerData,
  }: SessionAnswerCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      surveyId,
      sessionId,
      questionId,
      answerText,
      answerData,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create session answer");
    }

    return this.getById(id);
  }

  public async getById(id: SessionAnswer["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as SessionAnswer | undefined;
  }

  public async findBySessionId(sessionId: SessionAnswer["sessionId"]) {
    const results = await this.db(this.tableName)
      .where({ sessionId, deleted: false })
      .orderBy("createdAt", "asc");

    return results as SessionAnswer[];
  }
}
