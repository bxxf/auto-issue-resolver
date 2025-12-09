import { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import {
  loadConfig,
  getConfig,
  parseIssueUrl,
  createGitHubClient,
  MODEL_OPTIONS,
  DEFAULT_MODEL,
  type AgentEvent,
  type AgentReport,
  type GitHubIssue,
  type GitHubRepo,
} from "@bxxf/air-core";
import { runAgent } from "@bxxf/air-agent";

import { Header } from "./Header.js";
import { Setup } from "./Setup.js";
import { AgentView } from "./AgentView.js";
import { Results } from "./Results.js";

type AppPhase = "setup" | "loading" | "running" | "complete" | "error";

interface AppProps {
  initialUrl?: string;
  maxTurns?: number;
}

export function App({ initialUrl, maxTurns }: AppProps) {
  const { exit } = useApp();

  const [phase, setPhase] = useState<AppPhase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [configValid, setConfigValid] = useState(false);
  const [issueUrl, setIssueUrl] = useState(initialUrl ?? "");
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [report, setReport] = useState<AgentReport | null>(null);

  useEffect(() => {
    try {
      loadConfig();
      setConfigValid(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  const handleUrlSubmit = async (url: string) => {
    setIssueUrl(url);
    setPhase("loading");

    const parsed = parseIssueUrl(url);
    if (!parsed.ok) {
      setError(parsed.error.userMessage);
      setPhase("error");
      return;
    }

    try {
      const config = getConfig();
      const github = createGitHubClient({ token: config.github.token });

      const [issueResult, repoResult] = await Promise.all([
        github.fetchIssue(parsed.value),
        github.fetchRepo(parsed.value),
      ]);

      if (!issueResult.ok) {
        setError(issueResult.error.userMessage);
        setPhase("error");
        return;
      }

      if (!repoResult.ok) {
        setError(repoResult.error.userMessage);
        setPhase("error");
        return;
      }

      setIssue(issueResult.value);
      setRepo(repoResult.value);
      setPhase("setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const handleStart = async (selectedModel: string) => {
    if (!issue || !repo) return;

    setPhase("running");
    setEvents([]);

    const config = getConfig();

    const onEvent = (event: AgentEvent) => {
      setEvents((prev) => [...prev, event]);

      if (event.type === "complete") {
        setReport(event.report);
        setPhase("complete");
      }

      if (event.type === "error") {
        setError(event.error);
        setPhase("error");
      }
    };

    try {
      const result = await runAgent({
        issue,
        repo,
        config: {
          model: selectedModel,
          maxTurns: maxTurns ?? config.agent.maxTurns,
          maxThinkingTokens: config.agent.maxThinkingTokens,
          interactive: true,
        },
        sandboxConfig: {
          apiKey: config.e2b.apiKey,
          timeoutMs: config.e2b.timeoutMs,
          githubToken: config.github.token,
        },
        onEvent,
      });

      if (!result.ok) {
        setError(result.error.message);
        setPhase("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header />

      {phase === "error" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>
            Error
          </Text>
          <Text color="red">{error}</Text>
          <Box marginTop={1}>
            <Text dimColor>Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      )}

      {phase === "setup" && configValid && (
        <Setup
          issueUrl={issueUrl}
          issue={issue}
          repo={repo}
          onUrlSubmit={handleUrlSubmit}
          onStart={handleStart}
          modelOptions={MODEL_OPTIONS}
          defaultModel={DEFAULT_MODEL}
        />
      )}

      {phase === "loading" && (
        <Box marginTop={1}>
          <Text color="cyan">Loading issue details...</Text>
        </Box>
      )}

      {phase === "running" && (
        <AgentView events={events} />
      )}

      {phase === "complete" && report && (
        <Results report={report} />
      )}
    </Box>
  );
}
