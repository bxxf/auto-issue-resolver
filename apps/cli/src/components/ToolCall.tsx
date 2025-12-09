import { Box, Text } from "ink";
import type { AgentEvent } from "@bxxf/air-core";

interface ToolCallProps {
  event: AgentEvent & { type: "tool_call" };
  isSelected: boolean;
  isExpanded: boolean;
}

export function ToolCall({ event, isSelected, isExpanded }: ToolCallProps) {
  const { tool, input } = event;
  const { name, summary, details } = formatTool(tool, input);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isSelected ? "cyan" : undefined}>
          {isSelected ? ">" : " "}
        </Text>
        <Text color="cyan"> {name}</Text>
        {summary && (
          <>
            <Text> </Text>
            <Text dimColor>{summary}</Text>
          </>
        )}
      </Box>

      {isExpanded && details && (
        <Box
          flexDirection="column"
          marginLeft={3}
          marginTop={1}
          marginBottom={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text dimColor wrap="wrap">{details}</Text>
        </Box>
      )}
    </Box>
  );
}

type ToolInfo = { name: string; summary: string; details: string };
type InputObj = Record<string, unknown>;

const toolFormatters: Record<string, (obj: InputObj) => ToolInfo> = {
  clone: (obj) => {
    const url = String(obj.url ?? "");
    const repoName = url.split("/").slice(-2).join("/").replace(".git", "");
    return {
      name: "clone",
      summary: repoName,
      details: `URL: ${url}\nBranch: ${obj.branch ?? "default"}`,
    };
  },

  grep: (obj) => {
    const pattern = String(obj.pattern ?? obj.query ?? "");
    const path = obj.path ? String(obj.path) : "";
    const glob = obj.glob ? String(obj.glob) : "";
    return {
      name: "grep",
      summary: `"${pattern}"${path ? ` in ${shortenPath(path)}` : ""}`,
      details: [
        `Pattern: ${pattern}`,
        path && `Path: ${path}`,
        glob && `File pattern: ${glob}`,
      ].filter(Boolean).join("\n"),
    };
  },

  read: (obj) => {
    const filePath = String(obj.file_path ?? obj.path ?? "");
    return {
      name: "read",
      summary: shortenPath(filePath),
      details: `File: ${filePath}`,
    };
  },

  write: (obj) => {
    const filePath = String(obj.file_path ?? obj.path ?? "");
    const content = String(obj.content ?? "");
    return {
      name: "write",
      summary: shortenPath(filePath),
      details: `File: ${filePath}\n\nContent:\n${content.slice(0, 500)}${content.length > 500 ? "\n..." : ""}`,
    };
  },

  exec: (obj) => {
    const cmd = String(obj.command ?? "");
    return {
      name: "exec",
      summary: cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd,
      details: `Command:\n$ ${cmd}`,
    };
  },

  ls: (obj) => {
    const path = String(obj.path ?? ".");
    return {
      name: "ls",
      summary: path,
      details: `Directory: ${path}`,
    };
  },

  git_log: (obj) => {
    const since = String(obj.since ?? "");
    return {
      name: "git log",
      summary: `since ${since}`,
      details: `Since: ${since}\nSearch terms: ${(obj.searchTerms as string[])?.join(", ") ?? "none"}`,
    };
  },

  git_checkout: (obj) => {
    const ref = String(obj.ref ?? "");
    return {
      name: "git checkout",
      summary: ref,
      details: `Ref: ${ref}`,
    };
  },

  url: (obj) => {
    const port = obj.port;
    return {
      name: "get url",
      summary: `port ${port}`,
      details: `Port: ${port}`,
    };
  },
};

const toolPatterns: [string, keyof typeof toolFormatters][] = [
  ["clone", "clone"],
  ["grep", "grep"],
  ["Grep", "grep"],
  ["read", "read"],
  ["Read", "read"],
  ["write", "write"],
  ["Write", "write"],
  ["exec", "exec"],
  ["Bash", "exec"],
  ["ls", "ls"],
  ["git_log", "git_log"],
  ["git_checkout", "git_checkout"],
  ["url", "url"],
];

function formatTool(tool: string, input: unknown): ToolInfo {
  const obj = (input && typeof input === "object" ? input : {}) as InputObj;
  const cleanName = tool.replace("mcp__e2b__", "").replace("sandbox_", "");

  for (const [pattern, formatterKey] of toolPatterns) {
    if (tool.includes(pattern)) {
      const formatter = toolFormatters[formatterKey];
      if (formatter) return formatter(obj);
    }
  }

  return {
    name: cleanName,
    summary: "",
    details: JSON.stringify(input, null, 2),
  };
}

function shortenPath(path: string): string {
  const parts = path.split("/");
  if (parts.length > 3) {
    return ".../" + parts.slice(-2).join("/");
  }
  return path;
}
