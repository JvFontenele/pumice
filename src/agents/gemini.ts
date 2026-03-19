import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";
import { runOllama } from "./ollama.js";

interface GeminiRunOptions {
  command?: string;
  model?: string;
  provider?: "native" | "ollama";
  cwd?: string;
}

export async function runGemini(prompt: string, options: GeminiRunOptions = {}) {
  const command = options.command ?? config.gemini.command;
  const model = options.model ?? config.gemini.model;
  const provider = options.provider ?? config.gemini.provider;
  const cwd = options.cwd;

  if (provider === "ollama") {
    return runOllama(prompt, model, command, cwd);
  }

  // Prompt is passed via stdin to avoid shell newline splitting on Windows.
  return runCommand(command, config.gemini.extraArgs, cwd, undefined, prompt);
}
