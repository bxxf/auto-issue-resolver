/**
 * MCP Tools for E2B Sandbox
 */

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  SandboxManager,
  type SandboxConfig,
  cloneRepo,
  runCommand,
  readFile,
  writeFile,
  listDirectory,
  searchFiles,
  getCommitsSince,
  gitCheckout,
} from "./sandbox/index.js";

type ToolContent = { type: "text"; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], isError };
}

export function createE2BTools(config: SandboxConfig) {
  const manager = new SandboxManager(config);

  const tools = [
    tool(
      "sandbox_clone",
      "Clone a GitHub repository into the sandbox. Must be called first before other operations.",
      {
        url: z.string().describe("Git clone URL (https://github.com/owner/repo.git)"),
        branch: z.string().optional().describe("Branch to checkout (optional)"),
      },
      async ({ url, branch }) => {
        if (!manager.isInitialized()) {
          const initResult = await manager.initialize();
          if (!initResult.ok) {
            return textResult(`Failed to initialize sandbox: ${initResult.error.message}`, true);
          }
        }

        const result = await cloneRepo(manager, url, branch);
        if (result.ok) {
          return textResult(`Repository cloned to ${result.value}. Use other sandbox tools to explore and modify.`);
        }
        return textResult(`Clone failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_exec",
      "Execute a shell command in the sandbox. Runs in the cloned repository directory.",
      {
        command: z.string().describe("Shell command to execute"),
        timeout: z.number().optional().describe("Timeout in seconds (default: 60)"),
      },
      async ({ command, timeout }) => {
        const result = await runCommand(manager, command, {
          timeoutMs: (timeout ?? 60) * 1000,
        });

        if (result.ok) {
          const { stdout, stderr, exitCode } = result.value;
          const output = [
            stdout && `stdout:\n${stdout}`,
            stderr && `stderr:\n${stderr}`,
            `exit code: ${exitCode}`,
          ].filter(Boolean).join("\n\n");

          return textResult(output, exitCode !== 0);
        }
        return textResult(`Command failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_read",
      "Read contents of a file from the sandbox.",
      {
        path: z.string().describe("File path (relative to repo or absolute)"),
      },
      async ({ path }) => {
        const result = await readFile(manager, path);
        if (result.ok) {
          return textResult(result.value);
        }
        return textResult(`Read failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_write",
      "Write content to a file in the sandbox.",
      {
        path: z.string().describe("File path (relative to repo or absolute)"),
        content: z.string().describe("Content to write"),
      },
      async ({ path, content }) => {
        const result = await writeFile(manager, path, content);
        if (result.ok) {
          return textResult(`File written: ${path}`);
        }
        return textResult(`Write failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_ls",
      "List files in a directory.",
      {
        path: z.string().optional().describe("Directory path (default: repo root)"),
      },
      async ({ path }) => {
        const result = await listDirectory(manager, path);
        if (result.ok) {
          return textResult(result.value.join("\n") || "(empty)");
        }
        return textResult(`List failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_grep",
      "Search for a pattern in files.",
      {
        pattern: z.string().describe("Search pattern (regex supported)"),
        path: z.string().optional().describe("Directory to search (default: repo root)"),
        glob: z.string().optional().describe("File pattern like '*.ts' or '*.js'"),
      },
      async ({ pattern, path, glob }) => {
        const result = await searchFiles(manager, pattern, {
          path,
          filePattern: glob,
        });
        if (result.ok) {
          return textResult(result.value);
        }
        return textResult(`Search failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_url",
      "Get public URL for a port exposed in the sandbox (for testing web servers).",
      {
        port: z.number().describe("Port number"),
      },
      async ({ port }) => {
        const url = manager.getHostUrl(port);
        if (url) {
          return textResult(`Public URL: ${url}`);
        }
        return textResult("Sandbox not initialized", true);
      }
    ),

    tool(
      "sandbox_git_log",
      "Get git commits since a specific date. Useful for checking if an issue might have been fixed by recent commits.",
      {
        since: z.string().describe("ISO date string (e.g., '2024-01-15') - typically use the issue creation date"),
        searchTerms: z.array(z.string()).optional().describe("Filter commits by keywords (e.g., ['fix', 'bug', 'issue'])"),
        maxCount: z.number().optional().describe("Maximum number of commits to return (default: 50)"),
      },
      async ({ since, searchTerms, maxCount }) => {
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          return textResult(`Invalid date: ${since}`, true);
        }

        const result = await getCommitsSince(manager, sinceDate, { searchTerms, maxCount });
        if (result.ok) {
          if (result.value.length === 0) {
            return textResult("No commits found since the specified date");
          }

          const formatted = result.value
            .map((c) => `${c.hash.slice(0, 8)} (${c.date.toISOString().split("T")[0]}) ${c.message}`)
            .join("\n");

          return textResult(`Commits since ${since}:\n\n${formatted}`);
        }
        return textResult(`Git log failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_git_checkout",
      "Checkout a specific commit or branch. Use this to test if an issue existed at a particular point in history.",
      {
        ref: z.string().describe("Git ref to checkout (commit hash, branch name, or tag)"),
      },
      async ({ ref }) => {
        const result = await gitCheckout(manager, ref);
        if (result.ok) {
          return textResult(`Checked out: ${ref}`);
        }
        return textResult(`Checkout failed: ${result.error.message}`, true);
      }
    ),
  ];

  return {
    manager,
    tools,
    cleanup: () => manager.cleanup(),
  };
}

export function createE2BMcpServer(config: SandboxConfig) {
  const { tools, cleanup, manager } = createE2BTools(config);

  const server = createSdkMcpServer({
    name: "e2b-sandbox",
    version: "0.1.0",
    tools,
  });

  return {
    server,
    cleanup,
    manager,
  };
}
