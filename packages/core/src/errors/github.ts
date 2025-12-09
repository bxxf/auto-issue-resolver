/**
 * GitHub errors.
 */

import { AppError } from "./base.js";

export class GitHubError extends AppError {
  readonly code = "GITHUB_ERROR";

  constructor(
    readonly operation: string,
    message: string,
    cause?: Error
  ) {
    super(`GitHub ${operation}: ${message}`, cause);
  }

  get userMessage(): string {
    return `GitHub error during ${this.operation}. Check your token and permissions.`;
  }
}

export class InvalidIssueUrlError extends AppError {
  readonly code = "INVALID_ISSUE_URL";

  constructor(readonly url: string) {
    super(`Invalid GitHub issue URL: ${url}`);
  }

  get userMessage(): string {
    return `Invalid URL format. Expected: https://github.com/owner/repo/issues/123`;
  }
}

export class IssueNotFoundError extends GitHubError {
  constructor(
    readonly owner: string,
    readonly repo: string,
    readonly issueNumber: number
  ) {
    super("fetch issue", `Issue #${issueNumber} not found in ${owner}/${repo}`);
  }

  override get userMessage(): string {
    return `Issue #${this.issueNumber} not found in ${this.owner}/${this.repo}`;
  }
}

export class RepoNotFoundError extends GitHubError {
  constructor(
    readonly owner: string,
    readonly repo: string
  ) {
    super("fetch repository", `Repository ${owner}/${repo} not found`);
  }

  override get userMessage(): string {
    return `Repository ${this.owner}/${this.repo} not found or not accessible`;
  }
}

export class GitHubAuthError extends GitHubError {
  constructor(cause?: Error) {
    super("authenticate", "Invalid or expired token", cause);
  }

  override get userMessage(): string {
    return "GitHub authentication failed. Check your GITHUB_TOKEN.";
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(readonly resetAt: Date) {
    super("rate limit", `Rate limited until ${resetAt.toISOString()}`);
  }

  override get userMessage(): string {
    return `GitHub rate limit exceeded. Resets at ${this.resetAt.toLocaleTimeString()}`;
  }
}
