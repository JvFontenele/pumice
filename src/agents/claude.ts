import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

export async function runClaude(prompt: string, mcpConfigPath?: string) {
  const args: string[] = [];

  // --mcp-config must come before other flags so Claude CLI parses them correctly.
  if (mcpConfigPath) {
    args.push("--mcp-config", mcpConfigPath);
  }

  if (config.claude.model) {
    args.push("--model", config.claude.model);
  }

  // Add flags from extraArgs (e.g. "-p") but NOT the prompt — prompt goes via stdin.
  // Piping via stdin avoids cmd.exe splitting multi-line prompts on Windows.
  args.push(...config.claude.extraArgs);

  if (config.claude.provider === "ollama") {
    return runCommand(config.claude.command, args, undefined, {
      ANTHROPIC_AUTH_TOKEN: "ollama",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_BASE_URL: config.ollamaBaseUrl
    }, prompt);
  }

  return runCommand(config.claude.command, args, undefined, undefined, prompt);
}
