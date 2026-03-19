import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runClaude(prompt: string) {
  return runCommand(config.claudeCommand, ["-p", prompt]);
}
