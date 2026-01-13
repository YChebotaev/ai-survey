import { type Logger } from "pino";
import { ServiceBase } from "./ServiceBase";
import {
  AccountInvitesRepository,
  type AccountInvite,
} from "../repositories";

export type InviteServiceConfig = {
  accountInvitesRepository: AccountInvitesRepository;
  logger: Logger;
};

export type CreateInviteArgs = {
  accountId: number;
  email?: string | null;
  phone?: string | null;
  telegram?: string | null;
};

export type SendInviteArgs = {
  inviteId: number;
};

export class InviteService extends ServiceBase<InviteServiceConfig> {
  private readonly accountInvitesRepository: AccountInvitesRepository;

  constructor({ accountInvitesRepository, logger }: InviteServiceConfig) {
    super(logger, { accountInvitesRepository, logger });

    this.accountInvitesRepository = accountInvitesRepository;
  }

  public async createInvite({
    accountId,
    email,
    phone,
    telegram,
  }: CreateInviteArgs): Promise<AccountInvite> {
    try {
      this.logger.info({ accountId, email, phone, telegram }, "Creating invite");

      const invite = await this.accountInvitesRepository.create({
        accountId,
        email: email ?? null,
        phone: phone ?? null,
        telegram: telegram ?? null,
      });

      if (!invite) {
        throw new Error("Failed to create invite");
      }

      this.logger.info({ inviteId: invite.id }, "Invite created");

      return invite;
    } catch (error) {
      this.logger.error(error, "Failed to create invite");

      throw error;
    }
  }

  public async sendInvite({ inviteId }: SendInviteArgs): Promise<void> {
    try {
      this.logger.info({ inviteId }, "Sending invite");

      const invite = await this.accountInvitesRepository.getById(inviteId);

      if (!invite) {
        throw new Error(`Invite with id ${inviteId} not found`);
      }

      // TODO: Implement actual sending logic (SMS, email, telegram)
      this.logger.info({ inviteId }, "Invite sent");

      return;
    } catch (error) {
      this.logger.error(error, "Failed to send invite");

      throw error;
    }
  }
}
