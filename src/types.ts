export type AgentName = string;

export type AgentProvider = "native" | "ollama";

export type TaskRole = string;

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
  agent?: PipelineAgentConfig;
}

export interface PipelineAgentConfig {
  id: string;
  name: string;
  role: TaskRole;
  provider: AgentProvider;
  model: string;
  command: string;
  goal: string;
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
