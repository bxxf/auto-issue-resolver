/**
 * Browser automation operations using Playwright in E2B sandbox.
 */

import { SandboxError, SandboxNotInitializedError, Result } from "@bxxf/air-core";
import type { SandboxManager } from "./manager.js";
import { runCommand } from "./commands.js";
import { writeFile } from "./files.js";

export interface BrowserResult {
  readonly success: boolean;
  readonly screenshot?: string; // base64 encoded
  readonly html?: string;
  readonly text?: string;
  readonly error?: string;
  readonly logs?: readonly string[];
}

export interface ElementInfo {
  readonly selector: string;
  readonly text: string;
  readonly visible: boolean;
  readonly bounds?: { x: number; y: number; width: number; height: number };
}

const PLAYWRIGHT_SCRIPT_PATH = "/tmp/air-playwright-script.js";
const SCREENSHOT_PATH = "/tmp/air-screenshot.png";

/**
 * Generate a Playwright script for execution
 */
function generatePlaywrightScript(actions: BrowserAction[]): string {
  const actionCode = actions
    .map((action) => {
      switch (action.type) {
        case "navigate":
          return `await page.goto(${JSON.stringify(action.url)}, { waitUntil: 'networkidle' });`;

        case "click":
          return `await page.click(${JSON.stringify(action.selector)});`;

        case "fill":
          return `await page.fill(${JSON.stringify(action.selector)}, ${JSON.stringify(action.value)});`;

        case "screenshot":
          return `await page.screenshot({ path: ${JSON.stringify(SCREENSHOT_PATH)}, fullPage: ${action.fullPage ?? false} });`;

        case "wait":
          return `await page.waitForSelector(${JSON.stringify(action.selector)}, { timeout: ${action.timeout ?? 5000} });`;

        case "wait_time":
          return `await page.waitForTimeout(${action.ms});`;

        case "evaluate":
          return `results.push({ type: 'evaluate', value: await page.evaluate(() => { ${action.script} }) });`;

        case "get_text":
          return `results.push({ type: 'text', selector: ${JSON.stringify(action.selector)}, value: await page.textContent(${JSON.stringify(action.selector)}) });`;

        case "get_html":
          return `results.push({ type: 'html', value: await page.content() });`;

        case "type":
          return `await page.type(${JSON.stringify(action.selector)}, ${JSON.stringify(action.text)});`;

        case "press":
          return `await page.keyboard.press(${JSON.stringify(action.key)});`;

        case "select":
          return `await page.selectOption(${JSON.stringify(action.selector)}, ${JSON.stringify(action.value)});`;

        case "hover":
          return `await page.hover(${JSON.stringify(action.selector)});`;

        case "scroll":
          return `await page.evaluate(() => window.scrollBy(0, ${action.y ?? 500}));`;

        default:
          return `// Unknown action: ${JSON.stringify(action)}`;
      }
    })
    .join("\n    ");

  return `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const results = [];
  const consoleLogs = [];

  page.on('console', msg => consoleLogs.push(msg.text()));

  try {
    ${actionCode}

    console.log(JSON.stringify({
      success: true,
      results,
      logs: consoleLogs
    }));
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      logs: consoleLogs
    }));
  } finally {
    await browser.close();
  }
})();
`.trim();
}

export type BrowserAction =
  | { type: "navigate"; url: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "type"; selector: string; text: string }
  | { type: "screenshot"; fullPage?: boolean }
  | { type: "wait"; selector: string; timeout?: number }
  | { type: "wait_time"; ms: number }
  | { type: "evaluate"; script: string }
  | { type: "get_text"; selector: string }
  | { type: "get_html" }
  | { type: "press"; key: string }
  | { type: "select"; selector: string; value: string }
  | { type: "hover"; selector: string }
  | { type: "scroll"; y?: number };

/**
 * Execute browser actions
 */
export async function executeBrowserActions(
  manager: SandboxManager,
  actions: BrowserAction[]
): Promise<Result<BrowserResult, SandboxError>> {
  if (!manager.isInitialized()) {
    return Result.err(new SandboxNotInitializedError());
  }

  try {
    // Generate and write the script
    const script = generatePlaywrightScript(actions);
    const writeResult = await writeFile(manager, PLAYWRIGHT_SCRIPT_PATH, script);
    if (!writeResult.ok) {
      return Result.err(writeResult.error);
    }

    // Execute the script
    const execResult = await runCommand(
      manager,
      `node ${PLAYWRIGHT_SCRIPT_PATH}`,
      { timeoutMs: 60000, cwd: "/tmp" }
    );

    if (!execResult.ok) {
      return Result.err(execResult.error);
    }

    // Parse the result
    try {
      const output = execResult.value.stdout.trim();
      const lastLine = output.split("\n").pop() ?? "{}";
      const result = JSON.parse(lastLine) as { success: boolean; error?: string; results?: unknown[]; logs?: string[] };

      // Check if screenshot was taken and read it
      let screenshot: string | undefined;
      if (actions.some((a) => a.type === "screenshot")) {
        const screenshotResult = await runCommand(
          manager,
          `base64 -w 0 ${SCREENSHOT_PATH} 2>/dev/null || true`,
          { timeoutMs: 10000 }
        );
        if (screenshotResult.ok && screenshotResult.value.stdout.trim()) {
          screenshot = screenshotResult.value.stdout.trim();
        }
      }

      // Extract text/html from results
      const textResult = result.results?.find((r: unknown) => (r as { type: string }).type === "text") as { value: string } | undefined;
      const htmlResult = result.results?.find((r: unknown) => (r as { type: string }).type === "html") as { value: string } | undefined;

      return Result.ok({
        success: result.success,
        screenshot,
        text: textResult?.value,
        html: htmlResult?.value,
        error: result.error,
        logs: result.logs,
      });
    } catch (parseError) {
      return Result.ok({
        success: false,
        error: `Failed to parse result: ${execResult.value.stdout}`,
      });
    }
  } catch (error) {
    return Result.err(
      new SandboxError(
        "browser execution",
        error instanceof Error ? error.message : String(error)
      )
    );
  }
}

/**
 * Navigate to a URL and get a screenshot
 */
export async function navigateAndScreenshot(
  manager: SandboxManager,
  url: string,
  options: { waitForSelector?: string; fullPage?: boolean } = {}
): Promise<Result<BrowserResult, SandboxError>> {
  const actions: BrowserAction[] = [
    { type: "navigate", url },
  ];

  if (options.waitForSelector) {
    actions.push({ type: "wait", selector: options.waitForSelector, timeout: 10000 });
  } else {
    actions.push({ type: "wait_time", ms: 2000 });
  }

  actions.push({ type: "screenshot", fullPage: options.fullPage });
  actions.push({ type: "get_html" });

  return executeBrowserActions(manager, actions);
}

/**
 * Fill a form and submit
 */
export async function fillFormAndSubmit(
  manager: SandboxManager,
  url: string,
  fields: Record<string, string>,
  submitSelector?: string
): Promise<Result<BrowserResult, SandboxError>> {
  const actions: BrowserAction[] = [
    { type: "navigate", url },
    { type: "wait_time", ms: 1000 },
  ];

  // Fill each field
  for (const [selector, value] of Object.entries(fields)) {
    actions.push({ type: "fill", selector, value });
  }

  // Submit if selector provided
  if (submitSelector) {
    actions.push({ type: "click", selector: submitSelector });
    actions.push({ type: "wait_time", ms: 2000 });
  }

  actions.push({ type: "screenshot" });
  actions.push({ type: "get_html" });

  return executeBrowserActions(manager, actions);
}

/**
 * Get visible text from a page
 */
export async function getPageText(
  manager: SandboxManager,
  url: string
): Promise<Result<string, SandboxError>> {
  const actions: BrowserAction[] = [
    { type: "navigate", url },
    { type: "wait_time", ms: 2000 },
    { type: "evaluate", script: "return document.body.innerText;" },
  ];

  const result = await executeBrowserActions(manager, actions);
  if (!result.ok) {
    return Result.err(result.error);
  }

  return Result.ok(result.value.text ?? "");
}

/**
 * Execute custom JavaScript in the browser
 */
export async function evaluateScript(
  manager: SandboxManager,
  url: string,
  script: string
): Promise<Result<unknown, SandboxError>> {
  const actions: BrowserAction[] = [
    { type: "navigate", url },
    { type: "wait_time", ms: 1000 },
    { type: "evaluate", script },
  ];

  const result = await executeBrowserActions(manager, actions);
  if (!result.ok) {
    return Result.err(result.error);
  }

  return Result.ok(result.value);
}
