import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface QuestionTemplatesRepositoryConfig
  extends RepositoryBaseConfig {}

export type QuestionTemplate = {
  id: number;
  accountId: number;
  projectId: number;
  order: number;
  dataKey: string;
  questionTemplate: string;
  successTemplate: string;
  failTemplate: string;
  final: boolean;
  type: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type QuestionTemplateCreateArgs = Omit<
  QuestionTemplate,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class QuestionTemplatesRepository extends RepositoryBase<QuestionTemplatesRepositoryConfig> {
  public async create({
    accountId,
    projectId,
    order,
    dataKey,
    questionTemplate,
    successTemplate,
    failTemplate,
    final,
    type,
  }: QuestionTemplateCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      projectId,
      order,
      dataKey,
      questionTemplate,
      successTemplate,
      failTemplate,
      final,
      type,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create question template");
    }

    return this.getById(id);
  }

  public async getById(id: QuestionTemplate["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as QuestionTemplate | undefined;
  }

  public async findByProjectIdAndOrder(
    projectId: number,
    order: QuestionTemplate["order"],
  ) {
    const result = await this.db(this.tableName)
      .where({ projectId, order, deleted: false })
      .first();

    return result as QuestionTemplate | undefined;
  }
}
