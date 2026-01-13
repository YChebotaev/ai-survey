import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface SessionReportsRepositoryConfig extends RepositoryBaseConfig {}

export type SessionReport = {
  id: number;
  accountId: number;
  projectId: number;
  surveyId: number;
  sessionId: number;
  data: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SessionReportCreateArgs = Omit<
  SessionReport,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class SessionReportsRepository extends RepositoryBase<SessionReportsRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    surveyId,
    sessionId,
    data,
  }: SessionReportCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      surveyId,
      sessionId,
      data,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create session report");
    }

    return this.getById(id);
  }

  public async getById(id: SessionReport["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as SessionReport | undefined;
  }

  public async findBySessionId(sessionId: SessionReport["sessionId"]) {
    const result = await this.db(this.tableName)
      .where({ sessionId, deleted: false })
      .first();

    return result as SessionReport | undefined;
  }

  public async updateBySessionId(
    sessionId: SessionReport["sessionId"],
    data: SessionReport["data"],
  ) {
    const now = new Date().toISOString();

    await this.db(this.tableName)
      .where({ sessionId, deleted: false })
      .update({
        data,
        updatedAt: now,
      });

    return this.findBySessionId(sessionId);
  }

  public async findByAccountId(accountId: SessionReport["accountId"]) {
    const results = await this.db(this.tableName)
      .where({ accountId, deleted: false });

    return results as SessionReport[];
  }
}
