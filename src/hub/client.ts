import { HubEntry } from "../types.js";

export interface HubClient {
  publish(entry: Omit<HubEntry, "publishedAt">): Promise<void>;
  getContextSummary(): Promise<string>;
  listResults(): Promise<HubEntry[]>;
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
    }
  };
}
