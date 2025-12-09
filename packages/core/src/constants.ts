/**
 * Application constants.
 */

export const MODELS = {
  SONNET: "claude-sonnet-4-5-20250929",
  OPUS: "claude-opus-4-5-20251101",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const DEFAULT_MODEL: ModelId = MODELS.SONNET;

export const MODEL_OPTIONS = [
  { id: MODELS.SONNET, name: "Claude Sonnet 4.5", description: "Fast and capable" },
  { id: MODELS.OPUS, name: "Claude Opus 4.5", description: "Most capable" },
] as const;

export const TIMEOUTS = {
  SANDBOX: 10 * 60 * 1000,
  COMMAND: 60 * 1000,
  CLONE: 120 * 1000,
  SEARCH: 30 * 1000,
} as const;

export const AGENT_DEFAULTS = {
  MAX_TURNS: undefined as number | undefined,
  MAX_THINKING_TOKENS: 16_000,
  INTERACTIVE: true,
} as const;
