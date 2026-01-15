import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { BaseFastifyPlugin, type PluginBaseOptions } from "../../plugin-base";
import { SurveySessionService } from "../../../../services";

export interface DemoPluginOptions extends PluginBaseOptions {
  surveySessionService: SurveySessionService;
}

export class DemoPlugin extends BaseFastifyPlugin<DemoPluginOptions> {
  private readonly surveySessionService: SurveySessionService;

  constructor(fastify: FastifyInstance, config: DemoPluginOptions) {
    super(fastify, config);

    this.surveySessionService = config.surveySessionService;
  }

  protected async initializeRoutes(config: DemoPluginOptions) {
    const { logger } = config;

    const pluginDir = resolve(__dirname);
    const htmlPath = join(pluginDir, "index.html");
    const cssPath = join(pluginDir, "styles", "style.css");
    const jsPath = join(pluginDir, "scripts", "script.js");

    logger.info({ pluginDir, htmlPath, cssPath, jsPath }, "Demo plugin paths");

    if (!existsSync(htmlPath)) {
      logger.error({ htmlPath }, "HTML file not found");
    }
    if (!existsSync(cssPath)) {
      logger.error({ cssPath }, "CSS file not found");
    }
    if (!existsSync(jsPath)) {
      logger.error({ jsPath }, "JS file not found");
    }

    const serveHtml = async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const html = readFileSync(htmlPath, "utf-8");

        return reply.type("text/html").code(200).send(html);
      } catch (error) {
        logger.error(error, "Failed to serve demo HTML");

        return reply.code(500).send({ error: "Failed to serve demo HTML" });
      }
    };

    this.fastify.get("/demo/", serveHtml);
    this.fastify.get("/demo/index.html", serveHtml);

    this.fastify.get("/demo/styles/style.css", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const css = readFileSync(cssPath, "utf-8");

        return reply.type("text/css").code(200).send(css);
      } catch (error) {
        logger.error(error, "Failed to serve demo CSS");

        return reply.code(500).send({ error: "Failed to serve demo CSS" });
      }
    });

    this.fastify.get("/demo/scripts/script.js", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const js = readFileSync(jsPath, "utf-8");

        return reply.type("application/javascript").code(200).send(js);
      } catch (error) {
        logger.error(error, "Failed to serve demo JS");

        return reply.code(500).send({ error: "Failed to serve demo JS" });
      }
    });

    this.fastify.get<{
      Params: {
        sessionId: string;
      };
    }>("/demo/report/:sessionId", async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const sessionIdNum = parseInt(sessionId, 10);

        if (isNaN(sessionIdNum)) {
          return reply.code(400).send({ error: "Invalid sessionId" });
        }

        await this.surveySessionService.ready;

        const report = await this.surveySessionService.getReport({ sessionId: sessionIdNum });

        if (!report) {
          return reply.code(404).send({ error: "Report not found" });
        }

        const reportData = JSON.parse(report.data);

        return reply.code(200).send({
          report: reportData,
        });
      } catch (error: any) {
        logger.error(error, "Failed to get report");

        return reply.code(500).send({
          error: "Failed to get report",
          message: error?.message || String(error),
        });
      }
    });
  }
}

const plugin = fastifyPlugin(
  async (fastify: FastifyInstance, options: DemoPluginOptions) => {
    const demoPlugin = new DemoPlugin(fastify, options);
    await demoPlugin.ready;
  },
  {
    name: "demo-plugin",
  },
);

export default plugin;
