/**
 * Agent errors.
 */

import { AppError } from "./base.js";

export class AgentError extends AppError {
  readonly code = "AGENT_ERROR";

  constructor(
    readonly phase: string,
    message: string,
    cause?: Error
  ) {
    super(`Agent error in ${phase}: ${message}`, cause);
  }

  get userMessage(): string {
    return `Agent error during ${this.phase}`;
  }
}

export class AgentMaxTurnsError extends AgentError {
  constructor(readonly maxTurns: number) {
    super("execution", `Reached max turns (${maxTurns})`);
  }

  override get userMessage(): string {
    return `Agent reached maximum turns (${this.maxTurns}) without completing`;
  }
}

export class AgentApiError extends AgentError {
  constructor(
    readonly statusCode: number,
    message: string,
    cause?: Error
  ) {
    super("API call", message, cause);
  }

  override get userMessage(): string {
    switch (this.statusCode) {
      case 401:
        return "API authentication failed. Check ANTHROPIC_API_KEY.";
      case 429:
        return "API rate limited. Please wait and retry.";
      case 500:
      case 502:
      case 503:
        return "API temporarily unavailable. Please retry.";
      default:
        return `API error (${this.statusCode})`;
    }
  }
}
