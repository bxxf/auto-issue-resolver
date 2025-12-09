/**
 * E2B Template Definition for AIR (Auto Issue Resolver)
 */

import { Template } from "e2b";

export const nodeTemplate = Template()
  .fromNodeImage("20")
  .aptInstall([
    "git",
    "ripgrep",
    "curl",
    "wget",
    "build-essential",
    "python3",
    "python3-pip",
    "python3-venv",
    "procps",
  ])
  .npmInstall("pnpm", { g: true })
  .runCmd(
    'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  )
  .runCmd(
    'echo \'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"\' >> ~/.bashrc'
  );

export const AIR_TEMPLATE_ALIAS = "air-sandbox";
