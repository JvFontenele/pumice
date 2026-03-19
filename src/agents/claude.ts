import { config } from "../config.js";
import { runCommand } from "../utils/exec.js";

interface ClaudeRunOptions {
  command?: string;
  model?: string;
  provider?: "native" | "ollama";
  cwd?: string;
}

export async function runClaude(
  prompt: string,
  mcpConfigPath?: string,
  options: ClaudeRunOptions = {}
) {
  const command = options.command ?? config.claude.command;
  const model = options.model ?? config.claude.model;
  const provider = options.provider ?? config.claude.provider;
  const cwd = options.cwd;
  const args: string[] = [];

  // --mcp-config must come before other flags so Claude CLI parses them correctly.
  if (mcpConfigPath) {
    args.push("--mcp-config", mcpConfigPath);
  }

  if (model) {
    args.push("--model", model);
  }

  // Add flags from extraArgs (e.g. "-p") but NOT the prompt — prompt goes via stdin.
  // Piping via stdin avoids cmd.exe splitting multi-line prompts on Windows.
  args.push(...config.claude.extraArgs);

  if (provider === "ollama") {
    return runCommand(command, args, cwd, {
      ANTHROPIC_AUTH_TOKEN: "ollama",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_BASE_URL: config.ollamaBaseUrl
    }, prompt);
  }

  return runCommand(command, args, cwd, undefined, prompt);
}
