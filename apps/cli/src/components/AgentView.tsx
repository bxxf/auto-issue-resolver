import { Box, Text, useStdout } from "ink";
import type { AgentEvent } from "@bxxf/air-core";

interface AgentViewProps {
  events: AgentEvent[];
}

export function AgentView({ events }: AgentViewProps) {
  const { stdout } = useStdout();
  const maxWidth = stdout?.columns ?? 100;

  if (events.length === 0) {
    return <Text dimColor>Waiting for agent...</Text>;
  }

  return (
    <Box flexDirection="column">
      {events.map((event, i) => (
        <EventItem key={i} event={event} maxWidth={maxWidth - 4} />
      ))}
    </Box>
  );
}

function EventItem({ event, maxWidth }: { event: AgentEvent; maxWidth: number }) {
  switch (event.type) {
    case "message":
      return (
        <Box flexDirection="column" marginY={1}>
          <Text color="cyan" bold>{">"} Agent</Text>
          <Box marginLeft={2} flexDirection="column">
            {event.content.split("\n").map((line, i) => (
              <Text key={i} wrap="wrap">{line}</Text>
            ))}
          </Box>
        </Box>
      );

    case "thinking":
      const thinkLines = event.content.split("\n").slice(0, 10);
      return (
        <Box flexDirection="column" marginY={1}>
          <Text color="magenta" dimColor>Thinking...</Text>
          <Box marginLeft={2} flexDirection="column">
            {thinkLines.map((line, i) => (
              <Text key={i} dimColor wrap="wrap">{line.slice(0, maxWidth)}</Text>
            ))}
            {event.content.split("\n").length > 10 && (
              <Text dimColor>...</Text>
            )}
          </Box>
        </Box>
      );

    case "tool_call":
      const toolName = event.tool.replace("mcp__e2b__", "").replace("sandbox_", "");
      const params = formatToolParams(event.input);
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="yellow" bold>{toolName}</Text>
            {params.inline && <Text dimColor> {params.inline}</Text>}
          </Box>
          {params.lines.map((line, i) => (
            <Text key={i} dimColor>  {line}</Text>
          ))}
        </Box>
      );

    case "tool_result":
      // Don't show - terminal already has the output
      return null;

    case "phase_change":
      return (
        <Box marginY={1}>
          <Text color="blue" bold>[ {event.phase.toUpperCase()} ]</Text>
          <Text> {event.message}</Text>
        </Box>
      );

    case "turn_complete":
      // Don't show turn numbers
      return null;

    case "error":
      return (
        <Box marginY={1}>
          <Text color="red" bold>ERROR: </Text>
          <Text color="red">{event.error}</Text>
        </Box>
      );

    default:
      return null;
  }
}

function formatToolParams(input: unknown): { inline: string; lines: string[] } {
  if (!input || typeof input !== "object") return { inline: "", lines: [] };

  const obj = input as Record<string, unknown>;
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);

  // For simple single-value tools, show inline
  if (entries.length === 1) {
    const [, value] = entries[0]!;
    if (typeof value === "string" && value.length < 60 && !value.includes("\n")) {
      return { inline: String(value), lines: [] };
    }
  }

  // For complex tools, show each param on a line
  const lines: string[] = [];
  for (const [key, value] of entries) {
    if (typeof value === "string") {
      if (value.length > 80) {
        lines.push(`${key}: ${value.slice(0, 80)}...`);
      } else if (value.includes("\n")) {
        lines.push(`${key}: (${value.split("\n").length} lines)`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.length} items]`);
    } else if (typeof value === "object") {
      lines.push(`${key}: {...}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return { inline: "", lines };
}
