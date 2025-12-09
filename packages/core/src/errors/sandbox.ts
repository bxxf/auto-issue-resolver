/**
 * Sandbox errors.
 */

import { AppError } from "./base.js";

export class SandboxError extends AppError {
  readonly code = "SANDBOX_ERROR";

  constructor(
    readonly operation: string,
    message: string,
    cause?: Error
  ) {
    super(`Sandbox ${operation}: ${message}`, cause);
  }

  get userMessage(): string {
    return `Sandbox error during ${this.operation}`;
  }
}

export class SandboxTimeoutError extends SandboxError {
  constructor(
    operation: string,
    readonly timeoutMs: number
  ) {
    super(operation, `Timed out after ${timeoutMs}ms`);
  }

  override get userMessage(): string {
    return `Operation timed out after ${Math.round(this.timeoutMs / 1000)}s`;
  }
}

export class SandboxCommandError extends SandboxError {
  constructor(
    readonly command: string,
    readonly exitCode: number,
    readonly stderr: string
  ) {
    super("run command", `Exit code ${exitCode}`);
  }

  override get userMessage(): string {
    return `Command failed (exit ${this.exitCode})`;
  }
}

export class SandboxNotInitializedError extends SandboxError {
  constructor() {
    super("access", "Sandbox not initialized. Call clone first.");
  }

  override get userMessage(): string {
    return "Sandbox not ready. Repository must be cloned first.";
  }
}
