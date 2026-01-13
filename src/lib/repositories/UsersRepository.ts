import { RepositoryBase, type RepositoryBaseConfig } from "./RepositoryBase";

export interface UsersRepositoryConfig extends RepositoryBaseConfig {}

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  passwordSalt: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type UserCreateArgs = Omit<
  User,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class UsersRepository extends RepositoryBase<UsersRepositoryConfig> {
  public async create({
    name,
    email,
    phone,
    passwordHash,
    passwordSalt,
  }: UserCreateArgs) {
    const now = new Date().toISOString();

    const [id] = await this.db(this.tableName).insert({
      name,
      email,
      phone,
      passwordHash,
      passwordSalt,
      deleted: false,
      createdAt: now,
      updatedAt: null,
      deletedAt: null,
    });

    if (id == null) {
      throw new Error("Failed to create user");
    }

    return this.getById(id);
  }

  public async getById(id: User["id"]) {
    const result = await this.db(this.tableName)
      .where({ id, deleted: false })
      .first();

    return result as User | undefined;
  }

  public async findByEmail(email: User["email"]) {
    const result = await this.db(this.tableName)
      .where({ email, deleted: false })
      .first();

    return result as User | undefined;
  }
}
