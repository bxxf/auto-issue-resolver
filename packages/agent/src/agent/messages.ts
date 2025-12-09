/**
 * Message processing helpers.
 */

import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentEvent } from "@bxxf/air-core";

export function processAssistantMessage(
  message: SDKAssistantMessage,
  onEvent?: (event: AgentEvent) => void
): void {
  for (const block of message.message.content) {
    switch (block.type) {
      case "thinking":
        if ("thinking" in block) {
          onEvent?.({ type: "thinking", content: block.thinking as string });
        }
        break;

      case "text":
        if ("text" in block) {
          onEvent?.({ type: "message", content: block.text as string });
        }
        break;

      case "tool_use":
        if ("name" in block && "input" in block) {
          onEvent?.({ type: "tool_call", tool: block.name as string, input: block.input });
        }
        break;
    }
  }
}

export function isToolResultSuccess(result: unknown): boolean {
  if (typeof result === "object" && result !== null) {
    if ("isError" in result) return !(result as { isError: boolean }).isError;
    if ("success" in result) return (result as { success: boolean }).success;
  }
  return true;
}
