/**
 * File operations (read, write, list, search).
 */

import { SandboxError, SandboxNotInitializedError, Result } from "@bxxf/air-core";
import type { SandboxManager } from "./manager.js";

export async function readFile(
  manager: SandboxManager,
  path: string
): Promise<Result<string, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const fullPath = manager.resolvePath(path);
    const content = await sandbox.files.read(fullPath);
    return Result.ok(content);
  } catch (error) {
    return Result.err(new SandboxError("read file", error instanceof Error ? error.message : String(error)));
  }
}

export async function writeFile(
  manager: SandboxManager,
  path: string,
  content: string
): Promise<Result<void, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const fullPath = manager.resolvePath(path);
    await sandbox.files.write(fullPath, content);
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(new SandboxError("write file", error instanceof Error ? error.message : String(error)));
  }
}

export async function listDirectory(
  manager: SandboxManager,
  path?: string
): Promise<Result<string[], SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const fullPath = path ? manager.resolvePath(path) : manager.currentRepoPath ?? "/home/user";
    const result = await sandbox.commands.run(`ls -1 "${fullPath}"`);

    if (result.exitCode !== 0) {
      return Result.err(new SandboxError("list directory", result.stderr));
    }

    return Result.ok(result.stdout.split("\n").filter(Boolean));
  } catch (error) {
    return Result.err(new SandboxError("list directory", error instanceof Error ? error.message : String(error)));
  }
}

export async function searchFiles(
  manager: SandboxManager,
  pattern: string,
  options: { path?: string; filePattern?: string } = {}
): Promise<Result<string, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const searchPath = options.path ? manager.resolvePath(options.path) : manager.currentRepoPath ?? ".";

    let cmd: string;
    if (options.filePattern) {
      cmd = `(rg -n --no-heading -S -g "${options.filePattern}" "${pattern}" "${searchPath}" 2>/dev/null || grep -rn --include="${options.filePattern}" "${pattern}" "${searchPath}" 2>/dev/null) || true`;
    } else {
      cmd = `(rg -n --no-heading -S "${pattern}" "${searchPath}" 2>/dev/null || grep -rn "${pattern}" "${searchPath}" 2>/dev/null) || true`;
    }

    const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });
    return Result.ok(result.stdout || "No matches found");
  } catch (error) {
    return Result.err(new SandboxError("search files", error instanceof Error ? error.message : String(error)));
  }
}
