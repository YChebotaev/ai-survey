import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";
import { BaseFastifyPlugin, type PluginBaseOptions } from "../../plugin-base";
import { IamService } from "../../../../services";

export interface IamPluginOptions extends PluginBaseOptions {
  iamService: IamService;
}

export class IamPlugin extends BaseFastifyPlugin<IamPluginOptions> {
  private readonly iamService: IamService;

  constructor(fastify: FastifyInstance, config: IamPluginOptions) {
    super(fastify, config);

    this.iamService = config.iamService;
  }

  protected async initializeRoutes(config: IamPluginOptions) {
    const { logger } = config;
    
    this.fastify.post<{
      Body: {
        name: string;
        email: string;
        phone?: string;
        password: string;
      };
    }>("/iam/registration", async (request: FastifyRequest<{ Body: { name: string; email: string; phone?: string; password: string } }>, reply: FastifyReply) => {
      try {
        const { name, email, phone, password } = request.body;

        // TODO: Hash password properly
        const passwordHash = password; // Placeholder
        const passwordSalt = ""; // Placeholder

        await this.iamService.ready;

        const account = await this.iamService.createAccount({ name });
        const user = await this.iamService.createUser({
          name,
          email,
          phone: phone ?? null,
          passwordHash,
          passwordSalt,
        });
        const membership = await this.iamService.joinUserToAccount({
          accountId: account.id,
          userId: user.id,
        });

        logger.info({ accountId: account.id, userId: user.id }, "User registered");

        return reply.code(201).send({
          account,
          user,
          membership,
        });
      } catch (error: any) {
        logger.error(error, "Failed to register user");

        return reply.code(500).send({ 
          error: "Failed to register user",
          message: error?.message || String(error),
        });
      }
    });

    this.fastify.post<{
      Body: {
        email: string;
        password: string;
      };
    }>("/iam/token", async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      try {
        const { email, password } = request.body;

        // TODO: Implement JWT token generation
        logger.info({ email }, "Token request");

        return reply.code(200).send({
          token: "placeholder-token",
        });
      } catch (error) {
        logger.error(error, "Failed to generate token");

        return reply.code(500).send({ error: "Failed to generate token" });
      }
    });
  }
}

const plugin = fastifyPlugin(
  async (fastify: FastifyInstance, options: IamPluginOptions) => {
    const iamPlugin = new IamPlugin(fastify, options);
    await iamPlugin.ready;
  },
  {
    name: "iam-plugin",
  },
);

export default plugin;
