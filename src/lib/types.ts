export type InitStates = "created" | "initializing" | "initialized" | "failed";

export type SupportedLanguage = "en" | "ru";

export type Runnable<
  StartArgs extends unknown[] = [],
  StopArgs extends unknown[] = [],
> = {
  runState:
    | "created"
    | "initializing"
    | "initialized"
    | "running"
    | "stopped"
    | "starting"
    | "stopping"
    | "failed";
  start(...args: StartArgs): Promise<void>;
  stop(...args: StopArgs): Promise<void>;
};
