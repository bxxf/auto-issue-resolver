/**
 * Agent runner - main query execution.
 */

import {
  query,
  type Options,
  type SDKResultMessage,
  type McpServerConfig,
} from "@anthropic-ai/claude-agent-sdk";
import {
  Result,
  type GitHubIssue,
  type GitHubRepo,
  type AgentConfig,
  type AgentReport,
  type AgentEvent,
} from "@bxxf/air-core";
import { createE2BMcpServer, type SandboxConfig } from "@bxxf/air-mcp-e2b";
import { getSystemPrompt, formatIssuePrompt } from "../prompts.js";
import { processAssistantMessage, isToolResultSuccess } from "./messages.js";
import { buildReport } from "./report.js";

export interface RunAgentOptions {
  issue: GitHubIssue;
  repo: GitHubRepo;
  config: AgentConfig;
  sandboxConfig: SandboxConfig;
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

export async function runAgent(options: RunAgentOptions): Promise<Result<AgentReport, Error>> {
  const { issue, repo, config, sandboxConfig, onEvent, signal } = options;
  const startTime = Date.now();

  // Create a promise-based mechanism for user questions
  const pendingQuestion: { reject: ((err: Error) => void) | null } = { reject: null };

  const onAskUser = (question: string, context: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      pendingQuestion.reject = reject;
      onEvent?.({
        type: "ask_user",
        question,
        context,
        resolve: (answer: string) => {
          pendingQuestion.reject = null;
          resolve(answer);
        },
      });
    });
  };

  const { server: e2bServer, cleanup: cleanupSandbox, manager: sandboxManager } = createE2BMcpServer(
    sandboxConfig,
    { onAskUser }
  );

  onEvent?.({ type: "phase_change", phase: "initializing", message: "Starting sandbox..." });

  // Always initialize sandbox early
  const initResult = await sandboxManager.initialize();
  if (!initResult.ok) {
    onEvent?.({ type: "error", error: `Sandbox init failed: ${initResult.error.message}` });
    return Result.err(initResult.error);
  }

  const mcpServers: Record<string, McpServerConfig> = {
    "e2b": e2bServer,
  };

  // Add Playwright MCP if enabled and available
  if (sandboxConfig.enablePlaywright && sandboxManager.hasMcpGateway()) {
    const mcpUrl = sandboxManager.getMcpUrl();
    const mcpToken = sandboxManager.getMcpToken();
    if (mcpUrl && mcpToken) {
      mcpServers["playwright"] = {
        type: "http",
        url: mcpUrl,
        headers: { Authorization: `Bearer ${mcpToken}` },
      };
      onEvent?.({ type: "phase_change", phase: "initializing", message: `Playwright MCP at ${mcpUrl}` });
    }
  }

  const queryOptions: Options = {
    model: config.model,
    systemPrompt: getSystemPrompt(),
    maxThinkingTokens: config.maxThinkingTokens,
    // No maxTurns - let it run until done
    tools: undefined,
    mcpServers,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    includePartialMessages: config.interactive,
    abortController: signal ? { signal } as AbortController : undefined,
  };

  const prompt = formatIssuePrompt(issue, repo);
  let turnCount = 0;
  let finalResult: SDKResultMessage | null = null;
  let totalCost = 0;

  try {
    onEvent?.({ type: "phase_change", phase: "exploring", message: "Analyzing issue..." });

    const stream = query({ prompt, options: queryOptions });

    for await (const message of stream) {
      switch (message.type) {
        case "system":
          break;

        case "assistant":
          turnCount++;
          onEvent?.({ type: "turn_complete", turn: turnCount });
          processAssistantMessage(message, onEvent);
          break;

        case "user":
          if (message.tool_use_result !== undefined) {
            const success = isToolResultSuccess(message.tool_use_result);
            onEvent?.({ type: "tool_result", tool: "unknown", success });
          }
          break;

        case "result":
          finalResult = message;
          totalCost = message.total_cost_usd;
          break;
      }
    }
  } catch (error) {
    // Reject any pending question
    if (pendingQuestion.reject) {
      pendingQuestion.reject(new Error("Agent terminated"));
    }
    onEvent?.({ type: "error", error: error instanceof Error ? error.message : String(error) });
    return Result.err(error instanceof Error ? error : new Error(String(error)));
  } finally {
    onEvent?.({ type: "phase_change", phase: "completed", message: "Cleaning up..." });
    await cleanupSandbox();
  }

  const durationMs = Date.now() - startTime;
  const sandboxUrl = sandboxManager.getHostUrl(3000);
  const report = buildReport(issue, repo, finalResult, turnCount, durationMs, totalCost, sandboxUrl);
  onEvent?.({ type: "complete", report });

  return Result.ok(report);
}
