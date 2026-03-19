export type AgentProvider = "native" | "ollama";

export type AgentRole =
  | "architect"
  | "backend"
  | "frontend"
  | "qa"
  | "reviewer"
  | "docs";

export interface AgentCardModel {
  id: string;
  name: string;
  role: AgentRole;
  provider: AgentProvider;
  model: string;
  command: string;
  goal: string;
  status: "ready" | "blocked" | "offline";
}

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
