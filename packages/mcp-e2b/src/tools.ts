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
  gitBisectRun,
  executeBrowserActions,
  type BrowserAction,
} from "./sandbox/index.js";

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ToolContent = TextContent | ImageContent;
type ToolResult = { content: ToolContent[]; isError?: boolean };

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], isError };
}

function imageResult(base64Data: string, text?: string): ToolResult {
  const content: ToolContent[] = [];
  if (base64Data) {
    content.push({ type: "image", data: base64Data, mimeType: "image/png" });
  }
  if (text) {
    content.push({ type: "text", text });
  }
  return { content, isError: false };
}

export interface ToolCallbacks {
  onAskUser?: (question: string, context: string) => Promise<string>;
}

export function createE2BTools(config: SandboxConfig, callbacks?: ToolCallbacks) {
  const manager = new SandboxManager(config);

  const tools = [
    // === CORE TOOLS ===
    tool(
      "sandbox_clone",
      "Clone a GitHub repository. MUST be called first.",
      {
        url: z.string().describe("Git clone URL"),
        branch: z.string().optional().describe("Branch to checkout"),
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
          return textResult(`Cloned to ${result.value}`);
        }
        return textResult(`Clone failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_exec",
      "Run a shell command. Returns stdout, stderr, and exit code.",
      {
        command: z.string().describe("Command to run"),
        timeout: z.number().optional().describe("Timeout in seconds (default: 60)"),
      },
      async ({ command, timeout }) => {
        const result = await runCommand(manager, command, {
          timeoutMs: (timeout ?? 60) * 1000,
        });

        if (result.ok) {
          const { stdout, stderr, exitCode } = result.value;
          const parts: string[] = [];

          if (stdout?.trim()) parts.push(stdout.trim());
          if (stderr?.trim()) parts.push(`[stderr]: ${stderr.trim()}`);
          if (parts.length === 0) parts.push("(no output)");
          parts.push(`[exit: ${exitCode}]`);

          return textResult(parts.join("\n"), exitCode !== 0);
        }
        return textResult(`Command failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_read",
      "Read a file's contents.",
      {
        path: z.string().describe("File path"),
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
      "Write/overwrite a file completely.",
      {
        path: z.string().describe("File path"),
        content: z.string().describe("Full file content"),
      },
      async ({ path, content }) => {
        const result = await writeFile(manager, path, content);
        if (result.ok) {
          return textResult(`Written: ${path}`);
        }
        return textResult(`Write failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_edit",
      "Edit a file by replacing a specific string. More efficient than rewriting the whole file.",
      {
        path: z.string().describe("File path"),
        old_string: z.string().describe("Exact string to find and replace (must be unique in file)"),
        new_string: z.string().describe("Replacement string"),
      },
      async ({ path, old_string, new_string }) => {
        const readResult = await readFile(manager, path);
        if (!readResult.ok) {
          return textResult(`Failed to read file: ${readResult.error.message}`, true);
        }

        const content = readResult.value;
        const occurrences = content.split(old_string).length - 1;

        if (occurrences === 0) {
          return textResult(`String not found in file. Make sure the old_string matches exactly (including whitespace).`, true);
        }

        if (occurrences > 1) {
          return textResult(`Found ${occurrences} occurrences of the string. old_string must be unique. Add more context to make it unique.`, true);
        }

        const newContent = content.replace(old_string, new_string);
        const writeResult = await writeFile(manager, path, newContent);

        if (writeResult.ok) {
          return textResult(`Edited ${path}: replaced 1 occurrence`);
        }
        return textResult(`Write failed: ${writeResult.error.message}`, true);
      }
    ),

    tool(
      "sandbox_grep",
      "Search for a pattern in files. Use this instead of browsing directories.",
      {
        pattern: z.string().describe("Search pattern (regex supported)"),
        path: z.string().optional().describe("Directory to search"),
        glob: z.string().optional().describe("File pattern like '*.ts'"),
      },
      async ({ pattern, path, glob }) => {
        const result = await searchFiles(manager, pattern, {
          path,
          filePattern: glob,
        });
        if (result.ok) {
          return textResult(result.value || "(no matches)");
        }
        return textResult(`Search failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_ls",
      "List files in a directory.",
      {
        path: z.string().optional().describe("Directory path"),
      },
      async ({ path }) => {
        const result = await listDirectory(manager, path);
        if (result.ok) {
          return textResult(result.value.join("\n") || "(empty)");
        }
        return textResult(`List failed: ${result.error.message}`, true);
      }
    ),

    // === GIT TOOLS ===
    tool(
      "sandbox_git_log",
      "Get commits since a date. Useful for finding recent fixes.",
      {
        since: z.string().describe("ISO date (e.g., '2024-01-15')"),
        searchTerms: z.array(z.string()).optional().describe("Filter by keywords"),
        maxCount: z.number().optional().describe("Max commits (default: 50)"),
      },
      async ({ since, searchTerms, maxCount }) => {
        const sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          return textResult(`Invalid date: ${since}`, true);
        }

        const result = await getCommitsSince(manager, sinceDate, { searchTerms, maxCount });
        if (result.ok) {
          if (result.value.length === 0) {
            return textResult("No commits found");
          }
          const formatted = result.value
            .map((c) => `${c.hash.slice(0, 8)} ${c.date.toISOString().split("T")[0]} ${c.message}`)
            .join("\n");
          return textResult(formatted);
        }
        return textResult(`Git log failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_git_checkout",
      "Checkout a commit/branch to test historical state.",
      {
        ref: z.string().describe("Commit hash, branch, or tag"),
      },
      async ({ ref }) => {
        const result = await gitCheckout(manager, ref);
        if (result.ok) {
          return textResult(`Checked out: ${ref}`);
        }
        return textResult(`Checkout failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_bisect",
      "Git bisect to find the commit that introduced a bug.",
      {
        badRef: z.string().describe("Commit where bug exists (usually HEAD)"),
        goodRef: z.string().describe("Commit where bug did NOT exist"),
        testCommand: z.string().describe("Command that exits 0 if good, non-zero if bad"),
        maxSteps: z.number().optional().describe("Max steps (default: 20)"),
      },
      async ({ badRef, goodRef, testCommand, maxSteps }) => {
        const result = await gitBisectRun(manager, badRef, goodRef, testCommand, { maxSteps });

        if (!result.ok) {
          return textResult(`Bisect failed: ${result.error.message}`, true);
        }

        const { found, commit, stepsCount, log } = result.value;

        if (found && commit) {
          return textResult([
            `Found bad commit in ${stepsCount} steps:`,
            `  ${commit.hash.slice(0, 8)} ${commit.date.toISOString().split("T")[0]}`,
            `  ${commit.message}`,
          ].join("\n"));
        }

        return textResult(`Bisect inconclusive after ${stepsCount} steps.\n${log.join("\n")}`);
      }
    ),

    // === BROWSER TOOLS (for UI bugs) ===
    tool(
      "sandbox_browser",
      "Navigate to a URL and take a screenshot. For UI bug reproduction.",
      {
        url: z.string().describe("URL to visit"),
        waitFor: z.string().optional().describe("CSS selector to wait for"),
        actions: z.array(z.object({
          type: z.enum(["click", "fill", "wait"]),
          selector: z.string(),
          value: z.string().optional(),
        })).optional().describe("Actions to perform before screenshot"),
      },
      async ({ url, waitFor, actions: inputActions }) => {
        const actions: BrowserAction[] = [
          { type: "navigate", url },
        ];

        if (waitFor) {
          actions.push({ type: "wait", selector: waitFor, timeout: 10000 });
        } else {
          actions.push({ type: "wait_time", ms: 2000 });
        }

        if (inputActions) {
          for (const action of inputActions) {
            if (action.type === "click") {
              actions.push({ type: "click", selector: action.selector });
            } else if (action.type === "fill" && action.value) {
              actions.push({ type: "fill", selector: action.selector, value: action.value });
            } else if (action.type === "wait") {
              actions.push({ type: "wait", selector: action.selector, timeout: 5000 });
            }
          }
        }

        actions.push({ type: "screenshot" });

        const result = await executeBrowserActions(manager, actions);
        if (result.ok) {
          const { success, screenshot, error, logs } = result.value;
          if (!success) {
            return textResult(`Browser error: ${error}`, true);
          }

          const info = logs?.length ? `Console: ${logs.join("\n")}` : "Page loaded";

          if (screenshot) {
            return imageResult(screenshot, info);
          }
          return textResult(info);
        }
        return textResult(`Browser failed: ${result.error.message}`, true);
      }
    ),

    tool(
      "sandbox_url",
      "Get public URL for a port (for testing local servers).",
      {
        port: z.number().describe("Port number"),
      },
      async ({ port }) => {
        const url = manager.getHostUrl(port);
        if (url) {
          return textResult(url);
        }
        return textResult("Sandbox not initialized", true);
      }
    ),

    // === HUMAN IN THE LOOP ===
    tool(
      "ask_user",
      "Ask the user a question when you need information you can't find (API keys, credentials, clarification on requirements, etc). Use this when stuck.",
      {
        question: z.string().describe("Clear question for the user"),
        context: z.string().describe("Why you need this info / what you've tried"),
      },
      async ({ question, context }) => {
        if (!callbacks?.onAskUser) {
          return textResult("User interaction not available in this mode.", true);
        }

        try {
          const answer = await callbacks.onAskUser(question, context);
          return textResult(`User response: ${answer}`);
        } catch (err) {
          return textResult(`Failed to get user input: ${err}`, true);
        }
      }
    ),
  ];

  return {
    manager,
    tools,
    cleanup: () => manager.cleanup(),
  };
}

export function createE2BMcpServer(config: SandboxConfig, callbacks?: ToolCallbacks) {
  const { tools, cleanup, manager } = createE2BTools(config, callbacks);

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
