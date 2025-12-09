/**
 * Base error class for all application errors.
 */

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  readonly timestamp: Date;

  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.timestamp = new Date();
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause instanceof Error ? this.cause.message : undefined,
      stack: this.stack,
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return (error as { isRetryable?: boolean }).isRetryable === true;
  }
  return false;
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) return error.userMessage;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function getErrorCode(error: unknown): string {
  if (isAppError(error)) return error.code;
  if (error instanceof Error) return error.name;
  return "UNKNOWN_ERROR";
}
