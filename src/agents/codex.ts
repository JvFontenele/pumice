import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

interface CodexRunOptions {
  command?: string;
  model?: string;
  provider?: "native" | "ollama";
  cwd?: string;
}

export async function runCodex(prompt: string, options: CodexRunOptions = {}) {
  const command = options.command ?? config.codex.command;
  const model = options.model ?? config.codex.model;
  const provider = options.provider ?? config.codex.provider;
  const cwd = options.cwd;
  const args = [...config.codex.extraArgs];

  if (provider === "ollama") {
    args.push("--oss");

    if (model) {
      args.push("-m", model);
    }
  }

  // Prompt is passed via stdin to avoid shell newline splitting on Windows.
  return runCommand(command, args, cwd, undefined, prompt);
}
