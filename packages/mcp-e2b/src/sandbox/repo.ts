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

export interface BisectResult {
  readonly found: boolean;
  readonly commit?: GitCommit;
  readonly stepsCount: number;
  readonly log: readonly string[];
}

/**
 * Start a git bisect session
 */
export async function gitBisectStart(
  manager: SandboxManager,
  badRef: string,
  goodRef: string
): Promise<Result<string, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const repoPath = manager.currentRepoPath;
    const cmd = `cd "${repoPath}" && git bisect start && git bisect bad ${badRef} && git bisect good ${goodRef}`;
    const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });

    if (result.exitCode !== 0 && !result.stdout.includes("Bisecting")) {
      return Result.err(new SandboxError("git bisect start", result.stderr));
    }

    // Extract current commit to test
    const match = result.stdout.match(/\[([a-f0-9]+)\]/);
    const currentCommit = match ? match[1] : "unknown";

    return Result.ok(currentCommit ?? "unknown");
  } catch (error) {
    return Result.err(new SandboxError("git bisect start", error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Mark current bisect commit as good or bad
 */
export async function gitBisectMark(
  manager: SandboxManager,
  status: "good" | "bad" | "skip"
): Promise<Result<{ done: boolean; nextCommit?: string; foundCommit?: GitCommit }, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const repoPath = manager.currentRepoPath;
    const cmd = `cd "${repoPath}" && git bisect ${status}`;
    const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });

    // Check if bisect is complete
    if (result.stdout.includes("is the first bad commit")) {
      // Extract the commit info
      const hashMatch = result.stdout.match(/([a-f0-9]{40}) is the first bad commit/);
      const hash = hashMatch ? hashMatch[1] : "";

      // Get commit details
      const logCmd = `cd "${repoPath}" && git log -1 --format="%H|%aI|%s" ${hash}`;
      const logResult = await sandbox.commands.run(logCmd, { timeoutMs: 10_000 });

      if (logResult.exitCode === 0 && logResult.stdout.trim()) {
        const [commitHash, date, ...msgParts] = logResult.stdout.trim().split("|");
        return Result.ok({
          done: true,
          foundCommit: {
            hash: commitHash ?? "",
            date: new Date(date ?? ""),
            message: msgParts.join("|"),
          },
        });
      }

      return Result.ok({ done: true });
    }

    // Still bisecting - extract next commit
    const match = result.stdout.match(/\[([a-f0-9]+)\]/);
    return Result.ok({
      done: false,
      nextCommit: match ? match[1] : undefined,
    });
  } catch (error) {
    return Result.err(new SandboxError("git bisect", error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Reset/end bisect session
 */
export async function gitBisectReset(
  manager: SandboxManager
): Promise<Result<void, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  try {
    const cmd = `cd "${manager.currentRepoPath}" && git bisect reset`;
    const result = await sandbox.commands.run(cmd, { timeoutMs: 30_000 });

    if (result.exitCode !== 0) {
      return Result.err(new SandboxError("git bisect reset", result.stderr));
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(new SandboxError("git bisect reset", error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Run automated bisect with a test command
 */
export async function gitBisectRun(
  manager: SandboxManager,
  badRef: string,
  goodRef: string,
  testCommand: string,
  options: { maxSteps?: number; timeoutPerStep?: number } = {}
): Promise<Result<BisectResult, SandboxError>> {
  const sandbox = manager.sandboxInstance;
  if (!sandbox) return Result.err(new SandboxNotInitializedError());

  const maxSteps = options.maxSteps ?? 20;
  const timeoutPerStep = options.timeoutPerStep ?? 120_000;
  const log: string[] = [];

  try {
    // Start bisect
    const startResult = await gitBisectStart(manager, badRef, goodRef);
    if (!startResult.ok) {
      return Result.err(startResult.error);
    }

    log.push(`Started bisect: bad=${badRef}, good=${goodRef}`);
    log.push(`First commit to test: ${startResult.value}`);

    let steps = 0;

    while (steps < maxSteps) {
      steps++;

      // Run the test command
      const repoPath = manager.currentRepoPath;
      const testResult = await sandbox.commands.run(
        `cd "${repoPath}" && ${testCommand}`,
        { timeoutMs: timeoutPerStep }
      );

      const testPassed = testResult.exitCode === 0;
      log.push(`Step ${steps}: Test ${testPassed ? "passed" : "failed"} (exit: ${testResult.exitCode})`);

      // Mark as good or bad based on test result
      const markResult = await gitBisectMark(manager, testPassed ? "good" : "bad");
      if (!markResult.ok) {
        await gitBisectReset(manager);
        return Result.err(markResult.error);
      }

      if (markResult.value.done) {
        log.push(`Bisect complete! Found bad commit.`);
        await gitBisectReset(manager);

        return Result.ok({
          found: true,
          commit: markResult.value.foundCommit,
          stepsCount: steps,
          log,
        });
      }

      log.push(`Next commit: ${markResult.value.nextCommit}`);
    }

    // Max steps reached
    log.push(`Max steps (${maxSteps}) reached without finding commit`);
    await gitBisectReset(manager);

    return Result.ok({
      found: false,
      stepsCount: steps,
      log,
    });
  } catch (error) {
    await gitBisectReset(manager).catch(() => {});
    return Result.err(new SandboxError("git bisect run", error instanceof Error ? error.message : String(error)));
  }
}
