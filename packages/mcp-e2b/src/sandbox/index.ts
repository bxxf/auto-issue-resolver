/**
 * Sandbox module exports.
 */

export { SandboxManager, type SandboxConfig } from "./manager.js";
export {
  cloneRepo,
  getCommitsSince,
  gitCheckout,
  gitBisectStart,
  gitBisectMark,
  gitBisectReset,
  gitBisectRun,
  type BisectResult,
} from "./repo.js";
export { readFile, writeFile, listDirectory, searchFiles } from "./files.js";
export { runCommand } from "./commands.js";
export {
  executeBrowserActions,
  navigateAndScreenshot,
  fillFormAndSubmit,
  getPageText,
  evaluateScript,
  type BrowserAction,
  type BrowserResult,
  type ElementInfo,
} from "./browser.js";
