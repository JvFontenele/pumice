import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";
import { runOllama } from "./ollama.js";

export async function runGemini(prompt: string) {
  if (config.gemini.provider === "ollama") {
    return runOllama(prompt, config.gemini.model);
  }

  // Prompt is passed via stdin to avoid shell newline splitting on Windows.
  return runCommand(config.gemini.command, config.gemini.extraArgs, undefined, undefined, prompt);
}
