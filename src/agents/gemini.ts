import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";
import { runOllama } from "./ollama.js";

export async function runGemini(prompt: string) {
  if (config.gemini.provider === "ollama") {
    return runOllama(prompt, config.gemini.model);
  }

  const args = [...config.gemini.extraArgs, prompt];
  return runCommand(config.gemini.command, args);
}
