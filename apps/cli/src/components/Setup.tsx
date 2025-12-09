import { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import type { GitHubIssue, GitHubRepo } from "@bxxf/air-core";

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface SetupProps {
  issueUrl: string;
  issue: GitHubIssue | null;
  repo: GitHubRepo | null;
  onUrlSubmit: (url: string) => void;
  onStart: (model: string) => void;
  modelOptions: readonly ModelOption[];
  defaultModel: string;
}

export function Setup({
  issueUrl,
  issue,
  repo,
  onUrlSubmit,
  onStart,
  modelOptions,
  defaultModel,
}: SetupProps) {
  const [url, setUrl] = useState(issueUrl);
  const step = issue ? "model" : "url";

  const handleUrlSubmit = () => {
    if (url.trim()) {
      onUrlSubmit(url.trim());
    }
  };

  const handleModelSelect = (item: { value: string }) => {
    onStart(item.value);
  };

  const selectItems = modelOptions.map((m) => ({
    label: `${m.name} - ${m.description}`,
    value: m.id,
  }));

  if (step === "url" && !issue) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="cyan">? </Text>
          <Text>GitHub Issue URL: </Text>
          <TextInput
            value={url}
            onChange={setUrl}
            onSubmit={handleUrlSubmit}
            placeholder="https://github.com/owner/repo/issues/123"
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to submit</Text>
        </Box>
      </Box>
    );
  }

  // Show issue info and model selection
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Issue info */}
      {issue && repo && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text dimColor>Repository: </Text>
            <Text>{repo.fullName}</Text>
          </Box>
          <Box>
            <Text dimColor>Issue: </Text>
            <Text>#{issue.number} </Text>
            <Text bold>{issue.title}</Text>
          </Box>
          {issue.body && (
            <Box marginTop={1} paddingLeft={2}>
              <Text dimColor wrap="wrap">
                {issue.body.slice(0, 200)}
                {issue.body.length > 200 ? "..." : ""}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Model selection */}
      <Box flexDirection="column">
        <Text color="cyan">? </Text>
        <Text>Select model:</Text>
        <Box marginLeft={2}>
          <SelectInput
            items={selectItems}
            initialIndex={selectItems.findIndex((i) => i.value === defaultModel)}
            onSelect={handleModelSelect}
          />
        </Box>
      </Box>
    </Box>
  );
}
