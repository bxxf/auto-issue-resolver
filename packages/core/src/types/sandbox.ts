/**
 * Sandbox-related types.
 */

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface SandboxInfo {
  readonly id: string;
  readonly repoPath: string | null;
  readonly startedAt: Date;
}

export interface GitCommit {
  readonly hash: string;
  readonly date: Date;
  readonly message: string;
}
