import "dotenv/config";

export const config = {
  projectName: process.env.PROJECT_NAME ?? "Pumice",
  workspaceDir: process.env.WORKSPACE_DIR ?? "./workspace",
  obsidianVaultDir: process.env.OBSIDIAN_VAULT_DIR ?? "./obsidian-vault",
  claudeCommand: process.env.CLAUDE_COMMAND ?? "claude",
  codexCommand: process.env.CODEX_COMMAND ?? "codex",
  geminiCommand: process.env.GEMINI_COMMAND ?? "gemini",
  mockResponses: process.env.PUMICE_MOCK_RESPONSES === "true",
  failFast: process.env.PUMICE_FAIL_FAST === "true"
};
