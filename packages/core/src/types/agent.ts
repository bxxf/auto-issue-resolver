/**
 * Agent-related types.
 */

import type { GitHubIssue, GitHubRepo } from "./github.js";

export type AgentPhase =
  | "initializing"
  | "cloning"
  | "exploring"
  | "reproducing"
  | "investigating"
  | "fixing"
  | "validating"
  | "reporting"
  | "completed"
  | "failed";

export interface AgentConfig {
  readonly model: string;
  readonly maxTurns?: number;
  readonly maxThinkingTokens: number;
  readonly interactive: boolean;
}

export interface AgentProgress {
  readonly phase: AgentPhase;
  readonly turn: number;
  readonly maxTurns: number;
  readonly message: string;
  readonly timestamp: Date;
}

export type AgentStatus =
  | { readonly type: "solved"; readonly summary: string; readonly fixDescription: string }
  | { readonly type: "already_fixed"; readonly summary: string; readonly fixingCommit: string }
  | { readonly type: "partial"; readonly summary: string; readonly remainingWork: string }
  | { readonly type: "needs_human"; readonly summary: string; readonly blockers: readonly string[] }
  | { readonly type: "failed"; readonly summary: string; readonly error: string };

export interface FileChange {
  readonly path: string;
  readonly diff: string;
}

export interface AgentReport {
  readonly issue: GitHubIssue;
  readonly repo: GitHubRepo;
  readonly status: AgentStatus;
  readonly reproduced: boolean;
  readonly rootCause: string | null;
  readonly analysis: string;
  readonly changes: readonly FileChange[];
  readonly sandboxUrl: string | null;
  readonly turnsUsed: number;
  readonly durationMs: number;
  readonly costUsd: number;
}

export type AgentEvent =
  | { readonly type: "phase_change"; readonly phase: AgentPhase; readonly message: string }
  | { readonly type: "turn_complete"; readonly turn: number; readonly maxTurns: number }
  | { readonly type: "tool_call"; readonly tool: string; readonly input: unknown }
  | { readonly type: "tool_result"; readonly tool: string; readonly success: boolean }
  | { readonly type: "thinking"; readonly content: string }
  | { readonly type: "message"; readonly content: string }
  | { readonly type: "error"; readonly error: string }
  | { readonly type: "complete"; readonly report: AgentReport };
