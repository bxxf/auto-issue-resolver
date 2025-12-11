import { Box, Text } from "ink";
import type { AgentReport } from "@bxxf/air-core";

interface ResultsProps {
  report: AgentReport;
}

export function Results({ report }: ResultsProps) {
  const statusColors: Record<string, string> = {
    solved: "green",
    already_fixed: "blue",
    partial: "yellow",
    needs_human: "magenta",
    failed: "red",
  };

  const statusLabels: Record<string, string> = {
    solved: "✓ SOLVED",
    already_fixed: "✓ ALREADY FIXED",
    partial: "◐ PARTIAL FIX",
    needs_human: "? NEEDS REVIEW",
    failed: "✗ FAILED",
  };

  const statusColor = statusColors[report.status.type] ?? "gray";
  const statusLabel = statusLabels[report.status.type] ?? "UNKNOWN";

  const duration = (report.durationMs / 1000).toFixed(1);

  return (
    <Box flexDirection="column" marginTop={2}>
      {/* Separator */}
      <Box>
        <Text dimColor>────────────────────────────────────────────────────────────────</Text>
      </Box>

      {/* Header */}
      <Box marginY={1}>
        <Text color={statusColor as any} bold>
          {statusLabel}
        </Text>
      </Box>

      {/* Stats row */}
      <Box>
        <Text dimColor>Turns: </Text>
        <Text>{report.turnsUsed}</Text>
        <Text dimColor>  |  Duration: </Text>
        <Text>{duration}s</Text>
        <Text dimColor>  |  Cost: </Text>
        <Text>${report.costUsd.toFixed(4)}</Text>
        <Text dimColor>  |  Reproduced: </Text>
        <Text color={report.reproduced ? "green" : "yellow"}>
          {report.reproduced ? "Yes" : "No"}
        </Text>
      </Box>

      {/* Root cause */}
      {report.rootCause && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>Root Cause:</Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{report.rootCause}</Text>
          </Box>
        </Box>
      )}

      {/* Summary */}
      {report.status.summary && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>Summary:</Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{report.status.summary}</Text>
          </Box>
        </Box>
      )}

      {/* Fix description for solved status */}
      {"fixDescription" in report.status && report.status.fixDescription && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green" bold>Fix Applied:</Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{report.status.fixDescription}</Text>
          </Box>
        </Box>
      )}

      {/* Fixing commit for already_fixed status */}
      {"fixingCommit" in report.status && report.status.fixingCommit && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="blue" bold>Fixed in Commit:</Text>
          <Box marginLeft={2}>
            <Text>{report.status.fixingCommit}</Text>
          </Box>
        </Box>
      )}

      {/* Remaining work for partial status */}
      {"remainingWork" in report.status && report.status.remainingWork && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>Remaining Work:</Text>
          <Box marginLeft={2}>
            <Text wrap="wrap">{report.status.remainingWork}</Text>
          </Box>
        </Box>
      )}

      {/* Blockers for needs_human status */}
      {"blockers" in report.status && report.status.blockers && report.status.blockers.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="magenta" bold>Blockers:</Text>
          <Box marginLeft={2} flexDirection="column">
            {report.status.blockers.map((blocker, i) => (
              <Text key={i}>• {blocker}</Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Error for failed status */}
      {"error" in report.status && report.status.error && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>Error:</Text>
          <Box marginLeft={2}>
            <Text color="red" wrap="wrap">{report.status.error}</Text>
          </Box>
        </Box>
      )}

      {/* Files changed */}
      {report.changes.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>Files Changed ({report.changes.length}):</Text>
          <Box marginLeft={2} flexDirection="column">
            {report.changes.map((change, i) => (
              <Text key={i} color="yellow">
                {change.path}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Sandbox URL */}
      {report.sandboxUrl && (
        <Box marginTop={1}>
          <Text dimColor>Sandbox: </Text>
          <Text color="cyan">{report.sandboxUrl}</Text>
        </Box>
      )}

      {/* Analysis preview */}
      {report.analysis && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>Analysis:</Text>
          <Box marginLeft={2} flexDirection="column">
            {report.analysis.split("\n").slice(0, 15).map((line, i) => (
              <Text key={i} dimColor wrap="wrap">
                {line}
              </Text>
            ))}
            {report.analysis.split("\n").length > 15 && (
              <Text dimColor>... ({report.analysis.split("\n").length - 15} more lines)</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={2}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
