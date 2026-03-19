import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runClaude(prompt: string) {
  const args = [...config.claude.extraArgs];

  if (config.claude.model) {
    args.push("--model", config.claude.model);
  }

  args.push(prompt);

  if (config.claude.provider === "ollama") {
    return runCommand(config.claude.command, args, undefined, {
      ANTHROPIC_AUTH_TOKEN: "ollama",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_BASE_URL: config.ollamaBaseUrl
    });
  }

  return runCommand(config.claude.command, args);
}
