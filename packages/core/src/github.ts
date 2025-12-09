/**
 * GitHub API client.
 */

import { Octokit } from "octokit";
import {
  GitHubError,
  GitHubAuthError,
  GitHubRateLimitError,
  IssueNotFoundError,
  RepoNotFoundError,
  InvalidIssueUrlError,
} from "./errors/index.js";
import { Result } from "./types/result.js";
import { createIssueNumber, createRepoOwner, createRepoName } from "./types/branded.js";
import type { GitHubIssue, GitHubComment, GitHubRepo, ParsedIssueUrl } from "./types/github.js";

export interface GitHubClientConfig {
  token: string;
}

const ISSUE_URL_REGEX = /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;

export function parseIssueUrl(url: string): Result<ParsedIssueUrl, InvalidIssueUrlError> {
  const match = url.match(ISSUE_URL_REGEX);
  if (!match) return Result.err(new InvalidIssueUrlError(url));

  const [, ownerStr, repoStr, numberStr] = match;
  if (!ownerStr || !repoStr || !numberStr) return Result.err(new InvalidIssueUrlError(url));

  try {
    return Result.ok({
      owner: createRepoOwner(ownerStr),
      repo: createRepoName(repoStr),
      issueNumber: createIssueNumber(parseInt(numberStr, 10)),
    });
  } catch {
    return Result.err(new InvalidIssueUrlError(url));
  }
}

export function createGitHubClient(config: GitHubClientConfig) {
  const octokit = new Octokit({ auth: config.token });

  return {
    parseIssueUrl,
    fetchIssue: (parsed: ParsedIssueUrl) => fetchIssue(octokit, parsed),
    fetchRepo: (parsed: ParsedIssueUrl) => fetchRepo(octokit, parsed),
  };
}

async function fetchIssue(
  octokit: Octokit,
  parsed: ParsedIssueUrl
): Promise<Result<GitHubIssue, GitHubError>> {
  const { owner, repo, issueNumber } = parsed;

  try {
    const [issueResponse, commentsResponse] = await Promise.all([
      octokit.rest.issues.get({ owner, repo, issue_number: issueNumber }),
      octokit.rest.issues.listComments({ owner, repo, issue_number: issueNumber, per_page: 100 }),
    ]);

    const issue = issueResponse.data;

    return Result.ok({
      number: createIssueNumber(issue.number),
      title: issue.title,
      body: issue.body ?? "",
      state: issue.state as "open" | "closed",
      labels: extractLabels(issue.labels),
      comments: mapComments(commentsResponse.data),
      htmlUrl: issue.html_url,
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
    });
  } catch (error) {
    return Result.err(mapGitHubError(error, "fetch issue", owner, repo, issueNumber));
  }
}

async function fetchRepo(
  octokit: Octokit,
  parsed: ParsedIssueUrl
): Promise<Result<GitHubRepo, GitHubError>> {
  const { owner, repo } = parsed;

  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });

    return Result.ok({
      owner: createRepoOwner(data.owner.login),
      name: createRepoName(data.name),
      fullName: data.full_name,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
      isPrivate: data.private,
    });
  } catch (error) {
    return Result.err(mapGitHubError(error, "fetch repository", owner, repo));
  }
}

function mapComments(
  data: Array<{ id: number; body?: string | null; user?: { login: string } | null; created_at: string }>
): GitHubComment[] {
  return data.map((c) => ({
    id: c.id,
    body: c.body ?? "",
    user: c.user?.login ?? "unknown",
    createdAt: new Date(c.created_at),
  }));
}

function extractLabels(labels: Array<string | { name?: string | null }>): string[] {
  return labels.map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean);
}

function mapGitHubError(
  error: unknown,
  operation: string,
  owner: string,
  repo: string,
  issueNumber?: number
): GitHubError {
  if (error instanceof Error && "status" in error) {
    const status = (error as { status: number }).status;

    switch (status) {
      case 401:
        return new GitHubAuthError(error);
      case 403:
        if (error.message?.includes("rate limit")) {
          const resetHeader = (error as { response?: { headers?: { "x-ratelimit-reset"?: string } } })
            .response?.headers?.["x-ratelimit-reset"];
          const resetAt = resetHeader
            ? new Date(parseInt(resetHeader, 10) * 1000)
            : new Date(Date.now() + 60000);
          return new GitHubRateLimitError(resetAt);
        }
        return new GitHubAuthError(error);
      case 404:
        return issueNumber !== undefined
          ? new IssueNotFoundError(owner, repo, issueNumber)
          : new RepoNotFoundError(owner, repo);
    }
  }

  return new GitHubError(
    operation,
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? error : undefined
  );
}
