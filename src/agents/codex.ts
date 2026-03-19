import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runCodex(prompt: string) {
  const args = [...config.codex.extraArgs];

  if (config.codex.provider === "ollama") {
    args.push("--oss");

    if (config.codex.model) {
      args.push("-m", config.codex.model);
    }
  }

  args.push(prompt);

  return runCommand(config.codex.command, args);
}
