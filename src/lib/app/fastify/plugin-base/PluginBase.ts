import EventEmitter from "events";
import type { FastifyInstance } from "fastify";
import { type Logger } from "pino";
import { Runnable } from "../../../types";

export type PluginBaseEvents = {
  [key in Runnable["runState"]]: [];
};

export interface PluginBaseOptions {
  logger: Logger;
}

export class BaseFastifyPlugin<
    PluginConfig extends PluginBaseOptions = PluginBaseOptions,
    StartArgs extends unknown[] = [],
    StopArgs extends unknown[] = [],
  >
  extends EventEmitter<PluginBaseEvents>
  implements Runnable<StartArgs, StopArgs>
{
  private _runState: Runnable["runState"] = "created";
  protected readonly logger: Logger;
  private readonly _ready: Promise<void>;

  constructor(
    protected readonly fastify: FastifyInstance,
    config: PluginConfig,
  ) {
    super();

    this.logger = config.logger;

    this._ready = this.initialize(config);
  }

  public get runState() {
    return this._runState;
  }

  public set runState(state: Runnable["runState"]) {
    this._runState = state;

    this.emit(state as keyof PluginBaseEvents);
  }

  public get ready() {
    return this._ready;
  }

  public async start(...args: StartArgs) {
    try {
      await this.ready;

      this.runState = "starting";

      await this.onStart(...args);

      this.runState = "running";

      this.logger.info("Plugin started");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to start plugin");

      throw error;
    }
  }

  public async stop(...args: StopArgs) {
    try {
      await this.ready;

      this.runState = "stopping";

      await this.onStop(...args);

      this.runState = "stopped";

      this.logger.info("Plugin stopped");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to stop plugin");

      throw error;
    }
  }

  protected async initialize(config: PluginConfig) {
    try {
      this.runState = "initializing";

      this.logger.info("Initializing plugin...");

      await this.initializePre(config);
      await this.initializeRoutes(config);
      await this.initializePost(config);

      this.runState = "initialized";

      this.logger.info("Plugin initialized");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to initialize plugin");

      throw error;
    }
  }

  protected async initializePre(config: PluginConfig) {}

  protected async initializeRoutes(config: PluginConfig) {}

  protected async initializePost(config: PluginConfig) {}

  protected async onStart(...args: StartArgs) {}

  protected async onStop(...args: StopArgs) {}
}
