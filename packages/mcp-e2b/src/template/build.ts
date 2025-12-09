#!/usr/bin/env npx tsx
/**
 * Build script for AIR E2B template
 *
 * Usage: npx tsx packages/mcp-e2b/src/template/build.ts
 * Requires E2B_API_KEY environment variable.
 */

import { Template, defaultBuildLogger } from "e2b";
import { nodeTemplate, AIR_TEMPLATE_ALIAS } from "./definition.js";

async function buildTemplate() {
  console.log(`Building E2B template: ${AIR_TEMPLATE_ALIAS}`);

  const templateId = await Template.build(nodeTemplate, {
    alias: AIR_TEMPLATE_ALIAS,
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log(`\nTemplate built: ${AIR_TEMPLATE_ALIAS} (${templateId})`);
}

buildTemplate().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
