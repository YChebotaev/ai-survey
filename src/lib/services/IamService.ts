import { type Logger } from "pino";
import { ServiceBase } from "./ServiceBase";
import {
  AccountsRepository,
  UsersRepository,
  AccountMembershipsRepository,
  type Account,
  type User,
  type AccountMembership,
} from "../repositories";

export type IamServiceConfig = {
  accountsRepository: AccountsRepository;
  usersRepository: UsersRepository;
  accountMembershipsRepository: AccountMembershipsRepository;
  logger: Logger;
};

export type CreateAccountArgs = {
  name: string;
};

export type CreateUserArgs = {
  name: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  passwordSalt: string;
};

export type JoinUserToAccountArgs = {
  accountId: number;
  userId: number;
  role?: string;
};

export class IamService extends ServiceBase<IamServiceConfig> {
  private readonly accountsRepository: AccountsRepository;
  private readonly usersRepository: UsersRepository;
  private readonly accountMembershipsRepository: AccountMembershipsRepository;

  constructor({ accountsRepository, usersRepository, accountMembershipsRepository, logger }: IamServiceConfig) {
    super(logger, { accountsRepository, usersRepository, accountMembershipsRepository, logger });

    this.accountsRepository = accountsRepository;
    this.usersRepository = usersRepository;
    this.accountMembershipsRepository = accountMembershipsRepository;
  }

  public async createAccount({ name }: CreateAccountArgs): Promise<Account> {
    try {
      this.logger.info({ name }, "Creating account");

      const account = await this.accountsRepository.create({ name });

      if (!account) {
        throw new Error("Failed to create account");
      }

      this.logger.info({ accountId: account.id }, "Account created");

      return account;
    } catch (error) {
      this.logger.error(error, "Failed to create account");

      throw error;
    }
  }

  public async createUser({
    name,
    email,
    phone,
    passwordHash,
    passwordSalt,
  }: CreateUserArgs): Promise<User> {
    try {
      this.logger.info({ email }, "Creating user");

      const user = await this.usersRepository.create({
        name,
        email,
        phone: phone ?? null,
        passwordHash,
        passwordSalt,
      });

      if (!user) {
        throw new Error("Failed to create user");
      }

      this.logger.info({ userId: user.id }, "User created");

      return user;
    } catch (error) {
      this.logger.error(error, "Failed to create user");

      throw error;
    }
  }

  public async joinUserToAccount({
    accountId,
    userId,
    role = "admin",
  }: JoinUserToAccountArgs): Promise<AccountMembership> {
    try {
      this.logger.info({ accountId, userId, role }, "Joining user to account");

      const membership = await this.accountMembershipsRepository.create({
        accountId,
        userId,
        role,
      });

      if (!membership) {
        throw new Error("Failed to create account membership");
      }

      this.logger.info({ membershipId: membership.id }, "User joined to account");

      return membership;
    } catch (error) {
      this.logger.error(error, "Failed to join user to account");

      throw error;
    }
  }
}
