/**
 * Configuration loading and validation.
 */

import { z } from "zod";
import { MissingEnvVarError, ConfigError } from "./errors/index.js";
import { DEFAULT_MODEL, TIMEOUTS, AGENT_DEFAULTS } from "./constants.js";
import type { AppConfig } from "./types/index.js";

const configSchema = z.object({
  github: z.object({
    token: z.string().min(1, "GITHUB_TOKEN is required"),
  }),
  anthropic: z.object({
    apiKey: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  }),
  e2b: z.object({
    apiKey: z.string().min(1, "E2B_API_KEY is required"),
    timeoutMs: z.number().int().positive().default(TIMEOUTS.SANDBOX),
  }),
  agent: z.object({
    maxTurns: z.number().int().positive().optional(),
    maxThinkingTokens: z.number().int().positive().default(AGENT_DEFAULTS.MAX_THINKING_TOKENS),
    defaultModel: z.string().default(DEFAULT_MODEL),
    interactive: z.boolean().default(AGENT_DEFAULTS.INTERACTIVE),
  }),
});

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new MissingEnvVarError(key);
  return value;
}

function getEnvOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new ConfigError(key, `Expected number, got: ${value}`);
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const maxTurnsEnv = process.env["AGENT_MAX_TURNS"];
  const maxTurns = maxTurnsEnv ? parseInt(maxTurnsEnv, 10) : undefined;

  const rawConfig = {
    github: {
      token: getEnv("GITHUB_TOKEN"),
    },
    anthropic: {
      apiKey: getEnv("ANTHROPIC_API_KEY"),
    },
    e2b: {
      apiKey: getEnv("E2B_API_KEY"),
      timeoutMs: getEnvNumber("E2B_TIMEOUT_MS", 600_000),
    },
    agent: {
      maxTurns: maxTurns && !isNaN(maxTurns) ? maxTurns : undefined,
      maxThinkingTokens: getEnvNumber("AGENT_MAX_THINKING_TOKENS", 16_000),
      defaultModel: getEnvOptional("AGENT_DEFAULT_MODEL", DEFAULT_MODEL),
      interactive: getEnvBoolean("AGENT_INTERACTIVE", true),
    },
  };

  const result = configSchema.safeParse(rawConfig);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new ConfigError(firstError?.path.join(".") ?? "unknown", firstError?.message ?? "Invalid configuration");
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getConfig(): AppConfig {
  return cachedConfig ?? loadConfig();
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

export function validateConfig(): void {
  loadConfig();
}

export function isConfigValid(): boolean {
  try {
    loadConfig();
    return true;
  } catch {
    return false;
  }
}
