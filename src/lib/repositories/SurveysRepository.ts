import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface SurveysRepositoryConfig extends RepositoryBaseConfig {}

export type Survey = {
  id: number;
  accountId: number;
  projectId: number;
  externalId: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SurveyCreateArgs = Omit<
  Survey,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class SurveysRepository extends RepositoryBase<SurveysRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    externalId,
  }: SurveyCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      externalId,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create survey");
    }

    return this.getById(id);
  }

  public async getById(id: Survey["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as Survey | undefined;
  }

  public async findByExternalId(externalId: Survey["externalId"]) {
    const result = await this.db(this.tableName)
      .where({ externalId, deleted: false })
      .first();

    return result as Survey | undefined;
  }
}
