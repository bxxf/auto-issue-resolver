/**
 * Repository operations (clone, git commands).
 */

import { SandboxError, SandboxTimeoutError, SandboxNotInitializedError, Result, type GitCommit } from "@bxxf/air-core";
import type { SandboxManager } from "./manager.js";

export async function cloneRepo(
  manager: SandboxManager,
  cloneUrl: string,
  branch?: string
): Promise<Result<string, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    let authUrl = cloneUrl;
    const token = manager.getGithubToken();
    if (token && cloneUrl.startsWith("https://github.com/")) {
      authUrl = cloneUrl.replace("https://github.com/", `https://${token}@github.com/`);
    }

    const repoName = cloneUrl.split("/").pop()?.replace(".git", "") ?? "repo";
    const repoPath = `/home/user/${repoName}`;

    let cmd = `git clone ${authUrl} ${repoPath}`;
    if (branch) {
      cmd = `git clone --branch ${branch} ${authUrl} ${repoPath}`;
    }

    const result = await sandbox.commands.run(cmd, { timeoutMs: 120_000 });

    if (result.exitCode !== 0) {
      return Result.err(new SandboxError("clone", result.stderr || "Clone failed"));
    }

    manager.setRepoPath(repoPath);
    return Result.ok(repoPath);
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      return Result.err(new SandboxTimeoutError("clone", 120_000));
    }
    return Result.err(
      new SandboxError("clone", error instanceof Error ? error.message : String(error))
    );
  }
}

export async function getCommitsSince(
  manager: SandboxManager,
  sinceDate: Date,
  options: { searchTerms?: string[]; maxCount?: number } = {}
): Promise<Result<GitCommit[], SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  const maxCount = options.maxCount ?? 50;
  const since = sinceDate.toISOString().split("T")[0];
  const repoPath = manager.currentRepoPath;

  try {
    const cmd = `cd "${repoPath}" && git log --since="${since}" --format="%H|%aI|%s" -n ${maxCount}`;
    const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });

    if (result.exitCode !== 0) {
      return Result.err(new SandboxError("git log", result.stderr));
    }

    const commits: GitCommit[] = result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, ...messageParts] = line.split("|");
        return {
          hash: hash ?? "",
          date: new Date(date ?? ""),
          message: messageParts.join("|"),
        };
      });

    if (options.searchTerms?.length) {
      const terms = options.searchTerms.map((t) => t.toLowerCase());
      return Result.ok(commits.filter((c) => terms.some((term) => c.message.toLowerCase().includes(term))));
    }

    return Result.ok(commits);
  } catch (error) {
    return Result.err(new SandboxError("git log", error instanceof Error ? error.message : String(error)));
  }
}

export async function gitCheckout(
  manager: SandboxManager,
  ref: string
): Promise<Result<void, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const cmd = `cd "${manager.currentRepoPath}" && git checkout ${ref}`;
    const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });

    if (result.exitCode !== 0) {
      return Result.err(new SandboxError("git checkout", result.stderr));
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(new SandboxError("git checkout", error instanceof Error ? error.message : String(error)));
  }
}
