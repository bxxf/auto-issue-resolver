#!/usr/bin/env node

/**
 * AIR CLI - Auto Issue Resolver
 * Interactive terminal UI built with ink (React for CLIs)
 */

import "dotenv/config";
import { render } from "ink";
import { App } from "./components/App.js";

// Parse CLI arguments
const args = process.argv.slice(2);
let issueUrl: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--help" || arg === "-h") {
    console.log(`
AIR - Auto Issue Resolver

Usage:
  air [issue-url]

Options:
  --help, -h       Show this help

Examples:
  air https://github.com/owner/repo/issues/123
`);
    process.exit(0);
  } else if (!arg?.startsWith("-")) {
    issueUrl = arg;
  }
}

// Render the app
render(<App initialUrl={issueUrl} />);
