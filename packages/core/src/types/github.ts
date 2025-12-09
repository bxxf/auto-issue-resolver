/**
 * GitHub-related types.
 */

import type { IssueNumber, RepoOwner, RepoName } from "./branded.js";

export interface GitHubComment {
  readonly id: number;
  readonly body: string;
  readonly user: string;
  readonly createdAt: Date;
}

export interface GitHubIssue {
  readonly number: IssueNumber;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed";
  readonly labels: readonly string[];
  readonly comments: readonly GitHubComment[];
  readonly htmlUrl: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GitHubRepo {
  readonly owner: RepoOwner;
  readonly name: RepoName;
  readonly fullName: string;
  readonly defaultBranch: string;
  readonly cloneUrl: string;
  readonly isPrivate: boolean;
}

export interface ParsedIssueUrl {
  readonly owner: RepoOwner;
  readonly repo: RepoName;
  readonly issueNumber: IssueNumber;
}
