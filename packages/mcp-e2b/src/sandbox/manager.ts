/**
 * E2B Sandbox lifecycle management with MCP gateway support.
 */

import { Sandbox } from "e2b";
import { SandboxError, SandboxNotInitializedError, Result, type SandboxInfo } from "@bxxf/air-core";

export interface SandboxConfig {
  apiKey: string;
  timeoutMs: number;
  githubToken?: string;
  /** Custom template name override (default: uses MCP gateway) */
  templateName?: string;
  /** Enable Playwright MCP server for browser automation */
  enablePlaywright?: boolean;
}

export interface McpConfig {
  playwright?: Record<string, unknown>;
}

export class SandboxManager {
  private sandbox: Sandbox | null = null;
  private repoPath: string | null = null;
  private startedAt: Date | null = null;
  private mcpUrl: string | null = null;
  private mcpToken: string | null = null;

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
      // Build MCP config if browser automation is enabled
      const mcpConfig: McpConfig = {};

      if (this.config.enablePlaywright) {
        // Playwright MCP server config
        mcpConfig.playwright = {};
      }

      const hasMcp = Object.keys(mcpConfig).length > 0;

      if (hasMcp) {
        // Use E2B's MCP gateway with configured servers
        this.sandbox = await Sandbox.create({
          apiKey: this.config.apiKey,
          timeoutMs: this.config.timeoutMs,
          mcp: mcpConfig as Record<string, Record<string, unknown>>,
        });

        // Get MCP connection details
        this.mcpUrl = this.sandbox.getMcpUrl();
        this.mcpToken = await this.sandbox.getMcpToken() ?? null;
      } else {
        // Use custom template without MCP gateway
        const templateName = this.config.templateName ?? "air-sandbox";
        this.sandbox = await Sandbox.create(templateName, {
          apiKey: this.config.apiKey,
          timeoutMs: this.config.timeoutMs,
        });
      }

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
      this.mcpUrl = null;
      this.mcpToken = null;
    }
  }

  isInitialized(): boolean {
    return this.sandbox !== null;
  }

  hasMcpGateway(): boolean {
    return this.mcpUrl !== null && this.mcpToken !== null;
  }

  getMcpUrl(): string | null {
    return this.mcpUrl;
  }

  getMcpToken(): string | null {
    return this.mcpToken;
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
