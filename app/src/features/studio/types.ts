export interface HubCommand {
  id: string;
  target: string;
  message: string;
  status: "queued" | "delivered" | "processing" | "completed";
  deliveredTo: string[];
  respondedBy: string[];
}

export interface HubResponse {
  id: string;
  commandId: string;
  agentId: string;
  output: string;
  respondedAt: string;
}

export type ChatMessage = {
  id: string;
  kind: "user" | "system" | "agent";
  text: string;
  who?: string;
};
