/**
 * Command execution.
 */

import { SandboxError, SandboxTimeoutError, SandboxNotInitializedError, Result, type CommandResult } from "@bxxf/air-core";
import type { SandboxManager } from "./manager.js";

export async function runCommand(
  manager: SandboxManager,
  command: string,
  options: { timeoutMs?: number; cwd?: string } = {}
): Promise<Result<CommandResult, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  const timeoutMs = options.timeoutMs ?? 60_000;
  const cwd = options.cwd ?? manager.currentRepoPath ?? "/home/user";

  try {
    const result = await sandbox.commands.run(command, { cwd, timeoutMs });

    return Result.ok({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      return Result.err(new SandboxTimeoutError("run command", timeoutMs));
    }
    return Result.err(new SandboxError("run command", error instanceof Error ? error.message : String(error)));
  }
}
