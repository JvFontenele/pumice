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
  command: string;
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

/** An agent that self-registered with the MCP hub. */
export interface ConnectedAgent {
  id: string;
  name: string;
  role?: string;
  capabilities?: string[];
  connectedAt: string;
  lastSeen: string;
}

/** A note discovered inside the Obsidian vault. */
export interface VaultNote {
  path: string;
  relativePath: string;
  title: string;
}
