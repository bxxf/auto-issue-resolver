/**
 * @bxxf/air-agent
 *
 * Issue Resolver Agent using Claude Agent SDK with E2B sandbox execution.
 */

export { runAgent, type RunAgentOptions, parseStructuredReport, type LLMReport } from "./agent/index.js";
export { getSystemPrompt, formatIssuePrompt } from "./prompts.js";
