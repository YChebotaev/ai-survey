import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface ProjectMembershipsRepositoryConfig
  extends RepositoryBaseConfig {}

export type ProjectMembership = {
  id: number;
  accountId: number;
  userId: number;
  projectId: number;
  role: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type ProjectMembershipCreateArgs = Omit<
  ProjectMembership,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class ProjectMembershipsRepository extends RepositoryBase<ProjectMembershipsRepositoryConfig> {
  public async create({
    accountId,
    userId,
    projectId,
    role,
  }: ProjectMembershipCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      userId,
      projectId,
      role,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create project membership");
    }

    return this.getById(id);
  }

  public async getById(id: ProjectMembership["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as ProjectMembership | undefined;
  }
}
