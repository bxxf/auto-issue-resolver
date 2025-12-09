/**
 * Application configuration types.
 */

export interface AppConfig {
  readonly github: {
    readonly token: string;
  };
  readonly anthropic: {
    readonly apiKey: string;
  };
  readonly e2b: {
    readonly apiKey: string;
    readonly timeoutMs: number;
  };
  readonly agent: {
    readonly maxTurns?: number;
    readonly maxThinkingTokens: number;
    readonly defaultModel: string;
    readonly interactive: boolean;
  };
}
