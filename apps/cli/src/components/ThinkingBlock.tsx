import { Box, Text } from "ink";
import type { AgentEvent } from "@bxxf/air-core";

interface ThinkingBlockProps {
  event: AgentEvent & { type: "thinking" };
  isSelected: boolean;
  isExpanded: boolean;
}

export function ThinkingBlock({ event, isSelected, isExpanded }: ThinkingBlockProps) {
  const { content } = event;
  const lines = content.split("\n");
  const preview = lines[0]?.slice(0, 60) ?? "";
  const hasMore = content.length > 60 || lines.length > 1;

  return (
    <Box flexDirection="column">
      {/* Main line */}
      <Box>
        <Text color={isSelected ? "cyan" : undefined}>
          {isSelected ? ">" : " "}
        </Text>
        <Text color="magenta"> thinking</Text>
        <Text dimColor> {preview}{hasMore && !isExpanded ? "..." : ""}</Text>
      </Box>

      {/* Expanded content */}
      {isExpanded && (
        <Box
          flexDirection="column"
          marginLeft={3}
          marginTop={1}
          marginBottom={1}
          borderStyle="single"
          borderColor="magenta"
          paddingX={1}
        >
          {lines.slice(0, 20).map((line, i) => (
            <Text key={i} dimColor wrap="wrap">
              {line}
            </Text>
          ))}
          {lines.length > 20 && (
            <Text dimColor>... {lines.length - 20} more lines</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
