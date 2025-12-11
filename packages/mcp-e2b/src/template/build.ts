#!/usr/bin/env npx tsx
/**
 * Build script for AIR E2B template
 *
 * Usage: npx tsx packages/mcp-e2b/src/template/build.ts
 * Requires E2B_API_KEY environment variable.
 */

import { Template, defaultBuildLogger } from "e2b";
import { airSandboxTemplate, AIR_TEMPLATE_ALIAS } from "./definition.js";

async function buildTemplate() {
  console.log(`Building E2B template: ${AIR_TEMPLATE_ALIAS}`);
  console.log("Includes: Node.js 20, Python 3, Playwright, Homebrew, pnpm, ripgrep");

  const templateId = await Template.build(airSandboxTemplate, {
    alias: AIR_TEMPLATE_ALIAS,
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log(`\nTemplate built successfully!`);
  console.log(`  Alias: ${AIR_TEMPLATE_ALIAS}`);
  console.log(`  ID: ${templateId}`);
}

buildTemplate().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
