import { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
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

type AppPhase = "setup" | "loading" | "running" | "asking" | "complete" | "error";

interface PendingQuestion {
  question: string;
  context: string;
  resolve: (answer: string) => void;
}

export function App({ initialUrl }: { initialUrl?: string }) {
  const { exit } = useApp();

  const [phase, setPhase] = useState<AppPhase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [configValid, setConfigValid] = useState(false);
  const [issueUrl, setIssueUrl] = useState(initialUrl ?? "");
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState("");

  // Extract phase info from events
  const currentPhaseInfo = useMemo(() => {
    const phaseEvents = events.filter((e) => e.type === "phase_change");
    const lastPhase = phaseEvents[phaseEvents.length - 1];
    if (lastPhase?.type === "phase_change") {
      return { phase: lastPhase.phase, message: lastPhase.message };
    }
    return { phase: "initializing", message: "Starting..." };
  }, [events]);

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

  const handleAnswerSubmit = useCallback(() => {
    if (pendingQuestion && userAnswer.trim()) {
      pendingQuestion.resolve(userAnswer.trim());
      setPendingQuestion(null);
      setUserAnswer("");
      setPhase("running");
    }
  }, [pendingQuestion, userAnswer]);

  const handleStart = async (model: string) => {
    if (!issue || !repo) return;

    setPhase("running");
    setEvents([]);

    const config = getConfig();

    const onEvent = (event: AgentEvent) => {
      setEvents((prev) => [...prev, event]);

      if (event.type === "ask_user") {
        setPendingQuestion({
          question: event.question,
          context: event.context,
          resolve: event.resolve,
        });
        setPhase("asking");
      }

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
          model,
          maxThinkingTokens: config.agent.maxThinkingTokens,
          interactive: true,
        },
        sandboxConfig: {
          apiKey: config.e2b.apiKey,
          timeoutMs: config.e2b.timeoutMs,
          githubToken: config.github.token,
          enablePlaywright: true,
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
      <Header
        issue={phase !== "setup" || issue ? issue : undefined}
        phase={phase === "running" || phase === "asking" ? currentPhaseInfo.phase : undefined}
        phaseMessage={phase === "running" || phase === "asking" ? currentPhaseInfo.message : undefined}
        isRunning={phase === "running" || phase === "asking"}
      />

      {phase === "error" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>Error</Text>
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
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

      {(phase === "running" || phase === "asking" || phase === "complete") && (
        <AgentView events={events} />
      )}

      {phase === "asking" && pendingQuestion && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>Agent needs your input:</Text>
          <Box marginTop={1}>
            <Text>{pendingQuestion.question}</Text>
          </Box>
          {pendingQuestion.context && (
            <Box marginTop={1}>
              <Text dimColor>Context: {pendingQuestion.context}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="cyan">{"> "}</Text>
            <TextInput
              value={userAnswer}
              onChange={setUserAnswer}
              onSubmit={handleAnswerSubmit}
            />
          </Box>
        </Box>
      )}

      {phase === "complete" && report && <Results report={report} />}
    </Box>
  );
}
