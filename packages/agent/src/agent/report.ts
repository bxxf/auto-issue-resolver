/**
 * Report parsing and building.
 */

import type { GitHubIssue, GitHubRepo, AgentReport, AgentStatus } from "@bxxf/air-core";
import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

export interface LLMReport {
  status: "solved" | "already_fixed" | "partial" | "needs_human" | "failed";
  reproduced: boolean;
  rootCause?: string;
  summary: string;
  filesChanged?: string[];
  fixDescription?: string;
  fixingCommit?: string;
  remainingWork?: string;
  blockers?: string[];
  error?: string;
}

export function parseStructuredReport(text: string): LLMReport | null {
  // Try ```json ... ``` format first
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1]) as LLMReport;
    } catch {
      // Continue to other formats
    }
  }

  // Try ``` ... ``` format (code block without language)
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch?.[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (typeof parsed === "object" && parsed !== null && "status" in parsed) {
        return parsed as LLMReport;
      }
    } catch {
      // Continue to other formats
    }
  }

  // Try to find raw JSON object in text
  const jsonObjectMatch = text.match(/\{[\s\S]*"status"\s*:\s*"[^"]+"/);
  if (jsonObjectMatch) {
    const startIdx = text.indexOf(jsonObjectMatch[0]);
    let braceCount = 0;
    let endIdx = startIdx;

    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === "{") braceCount++;
      if (text[i] === "}") braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }

    if (endIdx > startIdx) {
      try {
        return JSON.parse(text.slice(startIdx, endIdx)) as LLMReport;
      } catch {
        // Fall through
      }
    }
  }

  return null;
}

export function buildReport(
  issue: GitHubIssue,
  repo: GitHubRepo,
  result: SDKResultMessage | null,
  turns: number,
  durationMs: number,
  costUsd: number,
  sandboxUrl: string | null
): AgentReport {
  const resultText = result && "result" in result ? result.result : "";
  const isError = result?.is_error ?? false;

  const parsed = parseStructuredReport(resultText);

  if (parsed) {
    const status = buildStatusFromParsed(parsed);
    const changes = (parsed.filesChanged ?? []).map(path => ({ path, diff: "" }));

    return {
      issue,
      repo,
      status,
      reproduced: parsed.reproduced,
      rootCause: parsed.rootCause ?? null,
      analysis: resultText,
      changes,
      sandboxUrl,
      turnsUsed: turns,
      durationMs,
      costUsd,
    };
  }

  const fallbackStatus: AgentStatus = isError
    ? { type: "failed", summary: resultText.slice(0, 500), error: "Agent error" }
    : { type: "needs_human", summary: resultText.slice(0, 500), blockers: ["Could not parse structured output"] };

  return {
    issue,
    repo,
    status: fallbackStatus,
    reproduced: false,
    rootCause: null,
    analysis: resultText,
    changes: [],
    sandboxUrl,
    turnsUsed: turns,
    durationMs,
    costUsd,
  };
}

function buildStatusFromParsed(parsed: LLMReport): AgentStatus {
  switch (parsed.status) {
    case "solved":
      return {
        type: "solved",
        summary: parsed.summary,
        fixDescription: parsed.fixDescription ?? "Fix applied",
      };
    case "already_fixed":
      return {
        type: "already_fixed",
        summary: parsed.summary,
        fixingCommit: parsed.fixingCommit ?? "unknown",
      };
    case "partial":
      return {
        type: "partial",
        summary: parsed.summary,
        remainingWork: parsed.remainingWork ?? "Additional work needed",
      };
    case "needs_human":
      return {
        type: "needs_human",
        summary: parsed.summary,
        blockers: parsed.blockers ?? ["Human review required"],
      };
    case "failed":
      return {
        type: "failed",
        summary: parsed.summary,
        error: parsed.error ?? "Agent failed",
      };
  }
}
