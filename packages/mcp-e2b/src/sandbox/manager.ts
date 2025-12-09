/**
 * E2B Sandbox lifecycle management.
 */

import { Sandbox } from "e2b";
import { SandboxError, SandboxNotInitializedError, Result, type SandboxInfo } from "@bxxf/air-core";

export interface SandboxConfig {
  apiKey: string;
  timeoutMs: number;
  githubToken?: string;
}

export class SandboxManager {
  private sandbox: Sandbox | null = null;
  private repoPath: string | null = null;
  private startedAt: Date | null = null;

  constructor(private readonly config: SandboxConfig) {}

  get sandboxInstance(): Sandbox | null {
    return this.sandbox;
  }

  get currentRepoPath(): string | null {
    return this.repoPath;
  }

  setRepoPath(path: string): void {
    this.repoPath = path;
  }

  async initialize(): Promise<Result<SandboxInfo, SandboxError>> {
    try {
      this.sandbox = await Sandbox.create("air-sandbox", {
        apiKey: this.config.apiKey,
        timeoutMs: this.config.timeoutMs,
      });
      this.startedAt = new Date();

      return Result.ok({
        id: this.sandbox.sandboxId,
        repoPath: null,
        startedAt: this.startedAt,
      });
    } catch (error) {
      return Result.err(
        new SandboxError(
          "initialize",
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.kill();
      } catch {
        // Cleanup errors are non-fatal
      }
      this.sandbox = null;
      this.repoPath = null;
      this.startedAt = null;
    }
  }

  isInitialized(): boolean {
    return this.sandbox !== null;
  }

  getInfo(): SandboxInfo | null {
    if (!this.sandbox || !this.startedAt) return null;
    return {
      id: this.sandbox.sandboxId,
      repoPath: this.repoPath,
      startedAt: this.startedAt,
    };
  }

  getHostUrl(port: number): string | null {
    if (!this.sandbox) return null;
    return `https://${this.sandbox.getHost(port)}`;
  }

  ensureInitialized(): Sandbox {
    if (!this.sandbox) throw new SandboxNotInitializedError();
    return this.sandbox;
  }

  resolvePath(path: string): string {
    if (path.startsWith("/")) return path;
    return this.repoPath ? `${this.repoPath}/${path}` : `/home/user/${path}`;
  }

  getGithubToken(): string | undefined {
    return this.config.githubToken;
  }
}
