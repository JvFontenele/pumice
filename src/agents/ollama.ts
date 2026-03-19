import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runOllama(
  prompt: string,
  model?: string,
  command?: string,
  cwd?: string
) {
  const selectedModel = model ?? config.gemini.model;
  return runCommand(command ?? config.ollamaCommand, ["run", selectedModel, prompt], cwd);
}
