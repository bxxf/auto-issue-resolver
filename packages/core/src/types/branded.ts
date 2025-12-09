/**
 * Branded types for compile-time type safety.
 */

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type IssueNumber = Brand<number, "IssueNumber">;
export type RepoOwner = Brand<string, "RepoOwner">;
export type RepoName = Brand<string, "RepoName">;

export function createIssueNumber(n: number): IssueNumber {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid issue number: ${n}`);
  }
  return n as IssueNumber;
}

export function createRepoOwner(s: string): RepoOwner {
  if (!s || s.includes("/")) {
    throw new Error(`Invalid repo owner: ${s}`);
  }
  return s as RepoOwner;
}

export function createRepoName(s: string): RepoName {
  if (!s || s.includes("/")) {
    throw new Error(`Invalid repo name: ${s}`);
  }
  return s as RepoName;
}
