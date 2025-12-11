import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { GitHubIssue } from "@bxxf/air-core";

interface HeaderProps {
  issue?: GitHubIssue | null;
  phase?: string;
  phaseMessage?: string;
  isRunning?: boolean;
}

export function Header({
  issue,
  phase,
  phaseMessage,
  isRunning = false,
}: HeaderProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">AIR</Text>
        <Text dimColor> Auto Issue Resolver</Text>
      </Box>

      {issue && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text dimColor>Issue: </Text>
            <Text color="white" bold>#{issue.number}</Text>
            <Text> {truncate(issue.title, 60)}</Text>
          </Box>
          <Box>
            <Text dimColor>Repo:  </Text>
            <Text color="blue">{issue.htmlUrl.split("/").slice(3, 5).join("/")}</Text>
          </Box>
        </Box>
      )}

      {isRunning && phase && (
        <Box marginTop={1}>
          <Text color="green"><Spinner type="dots" /></Text>
          <Text> </Text>
          <Text color="yellow" bold>{phase}</Text>
          {phaseMessage && <Text dimColor> - {phaseMessage}</Text>}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{"─".repeat(70)}</Text>
      </Box>
    </Box>
  );
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
