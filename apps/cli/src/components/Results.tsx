import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { AgentReport } from "@bxxf/air-core";

interface ResultsProps {
  report: AgentReport;
}

type Tab = "summary" | "files" | "analysis";

export function Results({ report }: ResultsProps) {
  const [tab, setTab] = useState<Tab>("summary");

  // Handle tab switching
  useInput((input) => {
    if (input === "1") setTab("summary");
    if (input === "2") setTab("files");
    if (input === "3") setTab("analysis");
  });

  const statusColors: Record<string, string> = {
    solved: "green",
    already_fixed: "blue",
    partial: "yellow",
    needs_human: "magenta",
    failed: "red",
  };

  const statusLabels: Record<string, string> = {
    solved: "SOLVED",
    already_fixed: "ALREADY FIXED",
    partial: "PARTIAL",
    needs_human: "NEEDS REVIEW",
    failed: "FAILED",
  };

  const statusColor = statusColors[report.status.type] ?? "gray";
  const statusLabel = statusLabels[report.status.type] ?? "UNKNOWN";

  const duration = (report.durationMs / 1000).toFixed(1);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="green">Complete</Text>
      </Box>

      {/* Tabs */}
      <Box marginBottom={1}>
        <TabButton label="Summary" num="1" active={tab === "summary"} />
        <Text> </Text>
        <TabButton label="Files" num="2" active={tab === "files"} />
        <Text> </Text>
        <TabButton label="Analysis" num="3" active={tab === "analysis"} />
      </Box>

      {/* Tab content */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="cyan"
        paddingX={1}
        paddingY={1}
      >
        {tab === "summary" && (
          <SummaryTab
            report={report}
            statusColor={statusColor}
            statusLabel={statusLabel}
            duration={duration}
          />
        )}

        {tab === "files" && <FilesTab report={report} />}

        {tab === "analysis" && <AnalysisTab report={report} />}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press 1/2/3 to switch tabs, Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}

function TabButton({ label, num, active }: { label: string; num: string; active: boolean }) {
  return (
    <Box>
      <Text color={active ? "cyan" : "gray"} bold={active}>
        [{num}] {label}
      </Text>
    </Box>
  );
}

function SummaryTab({
  report,
  statusColor,
  statusLabel,
  duration,
}: {
  report: AgentReport;
  statusColor: string;
  statusLabel: string;
  duration: string;
}) {
  return (
    <Box flexDirection="column">
      {/* Status row */}
      <Box>
        <Text dimColor>Status:      </Text>
        <Text color={statusColor} bold>
          {statusLabel}
        </Text>
      </Box>

      {/* Reproduced */}
      <Box>
        <Text dimColor>Reproduced:  </Text>
        <Text>{report.reproduced ? "Yes" : "No"}</Text>
      </Box>

      {/* Turns */}
      <Box>
        <Text dimColor>Turns:       </Text>
        <Text>{report.turnsUsed}</Text>
      </Box>

      {/* Duration */}
      <Box>
        <Text dimColor>Duration:    </Text>
        <Text>{duration}s</Text>
      </Box>

      {/* Cost */}
      <Box>
        <Text dimColor>Cost:        </Text>
        <Text>${report.costUsd.toFixed(4)}</Text>
      </Box>

      {/* Root cause */}
      {report.rootCause && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Root Cause</Text>
          <Text dimColor wrap="wrap">{report.rootCause}</Text>
        </Box>
      )}

      {/* Summary */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Summary</Text>
        <Text dimColor wrap="wrap">{report.status.summary}</Text>
      </Box>

      {/* Sandbox URL */}
      {report.sandboxUrl && (
        <Box marginTop={1}>
          <Text dimColor>Sandbox: </Text>
          <Text color="cyan">{report.sandboxUrl}</Text>
        </Box>
      )}
    </Box>
  );
}

function FilesTab({ report }: { report: AgentReport }) {
  if (report.changes.length === 0) {
    return <Text dimColor>No files changed</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Files Changed ({report.changes.length})</Text>
      </Box>
      {report.changes.map((change, i) => (
        <Box key={i}>
          <Text color="yellow">{change.path}</Text>
        </Box>
      ))}
    </Box>
  );
}

function AnalysisTab({ report }: { report: AgentReport }) {
  const lines = report.analysis.split("\n");

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Full Analysis</Text>
      </Box>
      {lines.slice(0, 30).map((line, i) => (
        <Text key={i} dimColor wrap="wrap">
          {line}
        </Text>
      ))}
      {lines.length > 30 && (
        <Box marginTop={1}>
          <Text dimColor>... {lines.length - 30} more lines</Text>
        </Box>
      )}
    </Box>
  );
}
