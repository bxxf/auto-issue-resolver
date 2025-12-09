/**
 * Configuration errors.
 */

import { AppError } from "./base.js";

export class ConfigError extends AppError {
  readonly code = "CONFIG_ERROR";

  constructor(
    readonly field: string,
    readonly reason: string,
    cause?: Error
  ) {
    super(`Configuration error for '${field}': ${reason}`, cause);
  }

  get userMessage(): string {
    return `Configuration error: ${this.field} - ${this.reason}`;
  }
}

export class MissingEnvVarError extends ConfigError {
  constructor(readonly varName: string) {
    super(varName, `Environment variable ${varName} is required`);
  }

  override get userMessage(): string {
    return `Missing required environment variable: ${this.varName}`;
  }
}
