/**
 * E2B Template Definition for AIR (Auto Issue Resolver)
 *
 * Single comprehensive template with all tools:
 * - Node.js 20, npm, pnpm
 * - Python 3 with pip and venv
 * - Git, ripgrep, curl, wget, build tools
 * - Playwright with Chromium for browser automation
 * - Homebrew for additional package installation
 */

import { Template } from "e2b";

/**
 * AIR Sandbox Template - comprehensive development environment
 */
export const airSandboxTemplate = Template()
  .fromImage("node:20-slim")
  .setUser("root")
  .setWorkdir("/")
  // Install system dependencies including Playwright requirements
  .aptInstall([
    // Core tools
    "git",
    "ripgrep",
    "curl",
    "wget",
    "build-essential",
    "procps",
    // Python
    "python3",
    "python3-pip",
    "python3-venv",
    // Playwright browser dependencies
    "libnss3",
    "libnspr4",
    "libatk1.0-0",
    "libatk-bridge2.0-0",
    "libcups2",
    "libdrm2",
    "libxkbcommon0",
    "libxcomposite1",
    "libxdamage1",
    "libxfixes3",
    "libxrandr2",
    "libgbm1",
    "libasound2",
  ])
  // Set up Playwright in /app
  .setWorkdir("/app")
  .runCmd("npm init -y")
  .npmInstall(["playwright"])
  .runCmd("PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium")
  .runCmd("chmod a+rwX /app")
  // Install global tools
  .npmInstall("pnpm", { g: true })
  // Install Homebrew for additional packages
  .runCmd(
    'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  )
  .runCmd(
    'echo \'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"\' >> /etc/bash.bashrc'
  )
  // Switch to user and set working directory
  .setUser("user")
  .setWorkdir("/home/user");

export const AIR_TEMPLATE_ALIAS = "air-sandbox";
