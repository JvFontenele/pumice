import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HubEntry, AgentName, TaskRole } from "../types.js";

const ROLE_VALUES = ["architect", "backend", "frontend", "qa", "reviewer", "docs"] as const;
const AGENT_VALUES = ["claude", "codex", "gemini", "ollama", "obsidian"] as const;

// In-memory store: keyed by taskId, lives for the duration of one pipeline run.
// Exported so transport.ts can expose REST endpoints that read/write it directly.
export const store = new Map<string, HubEntry>();

export function createMcpServer() {
  const server = new McpServer({
    name: "pumice-hub",
    version: "1.0.0"
  });

  // ── Tool: publish_result ────────────────────────────────────────────────────
  server.tool(
    "publish_result",
    "Publish this agent's completed result to the hub so subsequent agents can read it.",
    {
      taskId:  z.string().describe("Unique task identifier (e.g. task-1)"),
      role:    z.enum(ROLE_VALUES).describe("Role that produced the result"),
      agent:   z.enum(AGENT_VALUES).describe("Agent that ran the task"),
      success: z.boolean().describe("Whether the task succeeded"),
      output:  z.string().describe("Full text output of the agent")
    },
    async ({ taskId, role, agent, success, output }) => {
      const entry: HubEntry = {
        taskId,
        role: role as TaskRole,
        agent: agent as AgentName,
        success,
        output,
        publishedAt: new Date().toISOString()
      };
      store.set(taskId, entry);
      return { content: [{ type: "text" as const, text: `published:${taskId}` }] };
    }
  );

  // ── Tool: get_result ────────────────────────────────────────────────────────
  server.tool(
    "get_result",
    "Retrieve a previously published agent result by task ID.",
    { taskId: z.string().describe("Task ID to retrieve") },
    async ({ taskId }) => {
      const entry = store.get(taskId);
      if (!entry) {
        return { content: [{ type: "text" as const, text: "not_found" }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(entry, null, 2) }] };
    }
  );

  // ── Tool: list_results ──────────────────────────────────────────────────────
  server.tool(
    "list_results",
    "List all results published in this pipeline run, ordered by publishedAt.",
    {},
    async () => {
      const all = [...store.values()].sort((a, b) =>
        a.publishedAt.localeCompare(b.publishedAt)
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(all, null, 2) }] };
    }
  );

  // ── Tool: get_context_summary ───────────────────────────────────────────────
  server.tool(
    "get_context_summary",
    "Get a formatted markdown summary of all results published so far in this pipeline run. Use this to understand what previous agents have already produced.",
    {},
    async () => {
      const all = [...store.values()].sort((a, b) =>
        a.publishedAt.localeCompare(b.publishedAt)
      );

      if (all.length === 0) {
        return { content: [{ type: "text" as const, text: "No results published yet." }] };
      }

      const md = all
        .map(e => `## ${e.role.toUpperCase()} (${e.agent}) — task ${e.taskId}\n\n${e.output}`)
        .join("\n\n---\n\n");

      return { content: [{ type: "text" as const, text: md }] };
    }
  );

  return { server, store };
}

/** Clear the store — called between pipeline runs if needed. */
export function clearStore() {
  store.clear();
}
