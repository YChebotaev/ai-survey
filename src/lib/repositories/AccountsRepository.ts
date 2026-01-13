import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface AccountsRepositoryConfig extends RepositoryBaseConfig {}

export type Account = {
  id: number;
  name: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AccountCreateArgs = Omit<
  Account,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class AccountsRepository extends RepositoryBase<AccountsRepositoryConfig> {
  public async create({ name }: AccountCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      name,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create account");
    }

    return this.getById(id);
  }

  public async getById(id: Account["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as Account | undefined;
  }
}
