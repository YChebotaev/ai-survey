import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface AccountMembershipsRepositoryConfig
  extends RepositoryBaseConfig {}

export type AccountMembership = {
  id: number;
  accountId: number;
  userId: number;
  role: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AccountMembershipCreateArgs = Omit<
  AccountMembership,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class AccountMembershipsRepository extends RepositoryBase<AccountMembershipsRepositoryConfig> {
  public async create({
    accountId,
    userId,
    role,
  }: AccountMembershipCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      userId,
      role,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create account membership");
    }

    return this.getById(id);
  }

  public async getById(id: AccountMembership["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as AccountMembership | undefined;
  }
}
