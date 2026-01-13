import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface AccountInvitesRepositoryConfig extends RepositoryBaseConfig {}

export type AccountInvite = {
  id: number;
  accountId: number;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AccountInviteCreateArgs = Omit<
  AccountInvite,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class AccountInvitesRepository extends RepositoryBase<AccountInvitesRepositoryConfig> {
  public async create({
    accountId,
    email,
    phone,
    telegram,
  }: AccountInviteCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      accountId,
      email,
      phone,
      telegram,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create account invite");
    }

    return this.getById(id);
  }

  public async getById(id: AccountInvite["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as AccountInvite | undefined;
  }
}
