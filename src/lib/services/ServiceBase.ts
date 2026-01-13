import EventEmitter from "events";
import { type Logger } from "pino";
import { type Runnable } from "../types";

export type ServiceBaseEvents = {
  [key in Runnable["runState"]]: [];
};

export class ServiceBase<
    ServiceConfig = {},
    StartArgs extends unknown[] = [],
    StopArgs extends unknown[] = [],
  >
  extends EventEmitter<ServiceBaseEvents>
  implements Runnable<StartArgs, StopArgs>
{
  private _runState: Runnable["runState"] = "created";
  private readonly _ready: Promise<void>;

  constructor(protected readonly logger: Logger, config: ServiceConfig) {
    super();

    this._ready = this._initialize(config);
  }

  public get runState() {
    return this._runState;
  }

  public set runState(state: Runnable["runState"]) {
    this._runState = state;

    this.emit(state as keyof ServiceBaseEvents);
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

      this.logger.info("Service started");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to start service");

      throw error;
    }
  }

  public async stop(...args: StopArgs) {
    try {
      await this.ready;

      this.runState = "stopping";

      await this.onStop(...args);

      this.runState = "stopped";

      this.logger.info("Service stopped");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to stop service");

      throw error;
    }
  }

  protected async _initialize(config: ServiceConfig) {
    try {
      this.runState = "initializing";

      this.logger.info("Initializing service...");

      await this.initialize(config);

      this.runState = "initialized";

      this.logger.info("Service initialized");
    } catch (error) {
      this.runState = "failed";

      this.logger.error(error, "Failed to initialize service");

      throw error;
    }
  }

  protected async initialize(config: ServiceConfig) {}

  protected async onStart(...args: StartArgs) {}

  protected async onStop(...args: StopArgs) {}
}
