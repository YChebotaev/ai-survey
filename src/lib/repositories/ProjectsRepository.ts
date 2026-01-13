import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface ProjectsRepositoryConfig extends RepositoryBaseConfig {}

export type Project = {
  id: number;
  accountId: number;
  name: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type ProjectCreateArgs = Omit<
  Project,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class ProjectsRepository extends RepositoryBase<ProjectsRepositoryConfig> {
  public async create({ accountId, name }: ProjectCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      name,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create project");
    }

    return this.getById(id);
  }

  public async getById(id: Project["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as Project | undefined;
  }
}
