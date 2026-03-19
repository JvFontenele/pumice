export type AgentProvider = "native" | "ollama";

export type AgentRole =
  | "architect"
  | "backend"
  | "frontend"
  | "qa"
  | "reviewer"
  | "docs";

/** Persisted agent configuration (saved to .pumice/project.json). */
export interface AgentCardModel {
  id: string;
  name: string;
  role: AgentRole;
  provider: AgentProvider;
  /** The CLI command to invoke, e.g. "claude", "codex", "ollama" */
  command: string;
  /** Model identifier passed to the agent, e.g. "claude-opus-4-6", "qwen3.5" */
  model: string;
  goal: string;
}

/** Runtime-only connection status — never persisted. */
export type RuntimeStatus = "unknown" | "checking" | "ok" | "fail";

export interface ProjectSnapshot {
  path: string;
  name: string;
  isGitRepo: boolean;
  hasPackageJson: boolean;
  hasObsidianVault: boolean;
  hasDocs: boolean;
}

export interface ProjectConfig {
  mission: string;
  obsidianVaultPath: string;
  agents: AgentCardModel[];
}
