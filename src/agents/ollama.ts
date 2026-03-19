import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runOllama(prompt: string, model?: string) {
  const selectedModel = model ?? config.gemini.model;
  return runCommand(config.ollamaCommand, ["run", selectedModel, prompt]);
}
