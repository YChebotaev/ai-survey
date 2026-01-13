import EventEmitter from "events";
import { type Logger } from "pino";
import { type InitStates } from "../types";
import knex, { Knex } from "knex";

export type RepositoryBaseConfig = {
  tableName: string;
  db: Knex<any, any[]>;
  logger: Logger;
};

export type RepositoryBaseEvents = {
  [key in InitStates]: [];
};

export class RepositoryBase<
  RepositoryConfig extends RepositoryBaseConfig = RepositoryBaseConfig,
> extends EventEmitter<RepositoryBaseEvents> {
  protected readonly db: Knex<any, any[]>;
  protected readonly logger: Logger;
  private _initState: InitStates = "created";
  private readonly _ready: Promise<void>;

  public readonly tableName: string;

  constructor(config: RepositoryConfig) {
    super();

    const { tableName, db, logger } = config;

    this.tableName = tableName;
    this.db = db;
    this.logger = logger;

    this._ready = this._initialize(config);
  }

  public get ready() {
    return this._ready;
  }

  public get initState() {
    return this._initState;
  }

  public set initState(state: InitStates) {
    this._initState = state;

    this.emit(state as keyof RepositoryBaseEvents);
  }

  protected async _initialize(config: RepositoryConfig) {
    try {
      this.initState = "initializing";

      this.logger.info("Initializing repository...");

      await this.initialize(config);

      this.initState = "initialized";

      this.logger.info("Repository initialized");
    } catch (error) {
      this.initState = "failed";

      this.logger.error(error, "Failed to initialize repository");

      throw error;
    }
  }

  protected async initialize(config: RepositoryConfig) {}
}
