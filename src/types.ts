export type AgentName = "claude" | "codex" | "gemini" | "ollama" | "obsidian";

export type AgentProvider = "native" | "ollama";

export type TaskRole =
  | "architect"
  | "backend"
  | "frontend"
  | "qa"
  | "reviewer"
  | "docs";

export interface MasterTask {
  title: string;
  description: string;
  context?: string;
}

export interface SubTask {
  id: string;
  title: string;
  role: TaskRole;
  instructions: string;
  dependsOn?: string[];
}

export interface AgentResult {
  agent: AgentName;
  role: TaskRole;
  taskId: string;
  success: boolean;
  output: string;
  files?: string[];
  risks?: string[];
}

export interface HubEntry {
  taskId: string;
  role: TaskRole;
  agent: AgentName;
  success: boolean;
  output: string;
  publishedAt: string;
}
