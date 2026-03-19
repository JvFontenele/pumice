import { HubEntry } from "../types.js";
import type { ConnectedAgent } from "./server.js";

export interface HubClient {
  publish(entry: Omit<HubEntry, "publishedAt">): Promise<void>;
  getContextSummary(): Promise<string>;
  listResults(): Promise<HubEntry[]>;
  registerAgent(input: {
    id: string;
    name: string;
    role?: string;
    capabilities?: string[];
  }): Promise<void>;
  unregisterAgent(agentId: string): Promise<void>;
  listAgents(): Promise<ConnectedAgent[]>;
}

/**
 * Creates a REST-based hub client that talks to the /api/* endpoints.
 * Simple and reliable: no MCP protocol overhead, no session state.
 * The /mcp endpoint is reserved for Claude CLI's --mcp-config.
 */
export function createHubClient(baseUrl: string): HubClient {
  return {
    async publish(entry) {
      const res = await fetch(`${baseUrl}/api/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Hub publish failed ${res.status}: ${text}`);
      }
    },

    async getContextSummary() {
      const res = await fetch(`${baseUrl}/api/context`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Hub context fetch failed ${res.status}: ${text}`);
      }
      return res.text();
    },

    async listResults() {
      const res = await fetch(`${baseUrl}/api/results`);
      if (!res.ok) {
        throw new Error(`Hub list failed ${res.status}`);
      }
      return res.json() as Promise<HubEntry[]>;
    },

    async registerAgent(input) {
      const res = await fetch(`${baseUrl}/api/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!res.ok) {
        throw new Error(`Hub register failed ${res.status}`);
      }
    },

    async unregisterAgent(agentId) {
      const res = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(agentId)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error(`Hub unregister failed ${res.status}`);
      }
    },

    async listAgents() {
      const res = await fetch(`${baseUrl}/api/agents`);
      if (!res.ok) {
        throw new Error(`Hub agent list failed ${res.status}`);
      }
      return res.json() as Promise<ConnectedAgent[]>;
    }
  };
}
