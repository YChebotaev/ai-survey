import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface SurveySessionsRepositoryConfig extends RepositoryBaseConfig {}

export type SurveySession = {
  id: number;
  accountId: number;
  projectId: number;
  surveyId: number;
  sessionState: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SurveySessionCreateArgs = Omit<
  SurveySession,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class SurveySessionsRepository extends RepositoryBase<SurveySessionsRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    surveyId,
    sessionState,
  }: SurveySessionCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      surveyId,
      sessionState,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create survey session");
    }

    return this.getById(id);
  }

  public async getById(id: SurveySession["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as SurveySession | undefined;
  }

  public async updateSessionState(
    id: SurveySession["id"],
    sessionState: string,
  ) {
    const now = new Date().toISOString();

    await this.db(this.tableName)
      .where({ id, deleted: false })
      .update({
        sessionState,
        updatedAt: now,
      });

    return this.getById(id);
  }
}
