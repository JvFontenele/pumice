import "dotenv/config";
import { AgentProvider } from "./types.js";

export const config = {
  projectName: process.env.PROJECT_NAME ?? "Pumice",
  workspaceDir: process.env.WORKSPACE_DIR ?? "./workspace",
  obsidianVaultDir: process.env.OBSIDIAN_VAULT_DIR ?? "./obsidian-vault",
  targetProjectDir: process.env.PUMICE_PROJECT_DIR || undefined,
  mockResponses: process.env.PUMICE_MOCK_RESPONSES === "true",
  failFast: process.env.PUMICE_FAIL_FAST === "true",
  ollamaCommand: process.env.OLLAMA_COMMAND ?? "ollama",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  hub: {
    enabled: process.env.PUMICE_HUB === "true",
    port: parseInt(process.env.PUMICE_HUB_PORT ?? "47821", 10),
    url: "" // populated at runtime by transport.ts after bind
  },
  claude: {
    provider: parseProvider(process.env.CLAUDE_PROVIDER, "native"),
    command: process.env.CLAUDE_COMMAND ?? "claude",
    // Empty string = no --model flag; Claude CLI uses its configured default model
    model: process.env.CLAUDE_MODEL ?? "",
    extraArgs: parseArgs(process.env.CLAUDE_EXTRA_ARGS ?? "-p")
  },
  codex: {
    provider: parseProvider(process.env.CODEX_PROVIDER, "native"),
    command: process.env.CODEX_COMMAND ?? "codex",
    model: process.env.CODEX_MODEL ?? "",
    extraArgs: parseArgs(process.env.CODEX_EXTRA_ARGS ?? "")
  },
  gemini: {
    provider: parseProvider(process.env.GEMINI_PROVIDER, "native"),
    command: process.env.GEMINI_COMMAND ?? "gemini",
    model: process.env.GEMINI_MODEL ?? "",
    extraArgs: parseArgs(process.env.GEMINI_EXTRA_ARGS ?? "")
  }
};

function parseProvider(
  value: string | undefined,
  fallback: AgentProvider
): AgentProvider {
  return value === "ollama" || value === "native" ? value : fallback;
}

function parseArgs(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(stripQuotes) ?? [];
}

function stripQuotes(value: string) {
  return value.replace(/^"(.*)"$/, "$1");
}
