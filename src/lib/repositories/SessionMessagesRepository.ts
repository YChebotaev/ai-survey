import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface SessionMessagesRepositoryConfig extends RepositoryBaseConfig {}

export type SessionMessage = {
  id: number;
  accountId: number;
  projectId: number;
  surveyId: number;
  sessionId: number;
  order: number; // Index within session, from 0 for initial agent's message
  partialReport: string; // JSON snapshot of report at this point
  author: "agent" | "client";
  text: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SessionMessageCreateArgs = Omit<
  SessionMessage,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class SessionMessagesRepository extends RepositoryBase<SessionMessagesRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    surveyId,
    sessionId,
    order,
    partialReport,
    author,
    text,
  }: SessionMessageCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      surveyId,
      sessionId,
      order,
      partialReport,
      author,
      text,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create session message");
    }

    return this.getById(id);
  }

  public async getById(id: SessionMessage["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as SessionMessage | undefined;
  }

  public async findBySessionId(sessionId: SessionMessage["sessionId"]) {
    const results = await this.db(this.tableName)
      .where({ sessionId, deleted: false })
      .orderBy("order", "asc");

    return results as SessionMessage[];
  }

  public async getLastMessageBySessionId(sessionId: SessionMessage["sessionId"]) {
    const result = await this.db(this.tableName)
      .where({ sessionId, deleted: false })
      .orderBy("order", "desc")
      .first();

    return result as SessionMessage | undefined;
  }
}
