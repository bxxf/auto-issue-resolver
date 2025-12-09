/**
 * Structured logging.
 */

import pc from "picocolors";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LoggerConfig {
  level: LogLevel;
  verbose: boolean;
  timestamps: boolean;
  colors: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const LEVEL_COLORS: Record<LogLevel, (s: string) => string> = {
  debug: pc.dim,
  info: pc.blue,
  warn: pc.yellow,
  error: pc.red,
  silent: (s) => s,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DBG",
  info: "INF",
  warn: "WRN",
  error: "ERR",
  silent: "",
};

export class Logger {
  private config: LoggerConfig = {
    level: "info",
    verbose: false,
    timestamps: true,
    colors: true,
  };

  configure(options: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...options };
  }

  private shouldLog(level: LogLevel): boolean {
    if (level === "silent") return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatTimestamp(): string {
    if (!this.config.timestamps) return "";
    const time = new Date().toISOString().slice(11, 23);
    return this.config.colors ? pc.dim(`[${time}]`) : `[${time}]`;
  }

  private formatLevel(level: LogLevel): string {
    const label = LEVEL_LABELS[level];
    if (!label) return "";
    const colorFn = this.config.colors ? LEVEL_COLORS[level] : (s: string) => s;
    return colorFn(`[${label}]`);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const parts = [this.formatTimestamp(), this.formatLevel(level), message].filter(Boolean);
    let output = parts.join(" ");

    if (data !== undefined) {
      const dataStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      output += "\n" + dataStr.split("\n").map((l) => "    " + l).join("\n");
    }

    if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }
}

export const logger = new Logger();

export function configureLogger(options: Partial<LoggerConfig>): void {
  logger.configure(options);
}
