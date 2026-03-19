import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HubEntry, AgentName, TaskRole } from "../types.js";

// ── Result store ───────────────────────────────────────────────────────────────
export const store = new Map<string, HubEntry>();

// ── Agent registry ─────────────────────────────────────────────────────────────
export interface ConnectedAgent {
  id: string;
  name: string;
  role?: string;
  capabilities?: string[];
  connectedAt: string;
  lastSeen: string;
}

export const agentRegistry = new Map<string, ConnectedAgent>();

export interface HubCommand {
  id: string;
  target: string;
  message: string;
  issuedAt: string;
  status: "queued" | "delivered" | "processing" | "completed";
  deliveredTo: string[];
  pulledBy: string[];
  respondedBy: string[];
}

export const commandStore: HubCommand[] = [];
export const commandInbox = new Map<string, HubCommand[]>();
export interface HubCommandResponse {
  id: string;
  commandId: string;
  agentId: string;
  output: string;
  respondedAt: string;
}
export const responseStore: HubCommandResponse[] = [];

/** Active if heartbeat received within the last 60 seconds. */
export const AGENT_TTL_MS = 60_000;

export function activeAgents(): ConnectedAgent[] {
  const cutoff = Date.now() - AGENT_TTL_MS;
  return [...agentRegistry.values()].filter(
    (a) => new Date(a.lastSeen).getTime() > cutoff
  );
}

export function dispatchCommand(target: string, message: string): HubCommand {
  const active = activeAgents();
  const recipients =
    target === "*"
      ? active.map((a) => a.id)
      : active.some((a) => a.id === target)
      ? [target]
      : [];

  const command: HubCommand = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    target,
    message,
    issuedAt: new Date().toISOString(),
    status: recipients.length > 0 ? "queued" : "delivered",
    deliveredTo: recipients,
    pulledBy: [],
    respondedBy: []
  };

  for (const agentId of recipients) {
    const inbox = commandInbox.get(agentId) ?? [];
    inbox.push(command);
    commandInbox.set(agentId, inbox);
  }

  commandStore.push(command);
  return command;
}

export function pullCommands(agentId: string): HubCommand[] {
  const pending = commandInbox.get(agentId) ?? [];
  for (const command of pending) {
    if (!command.pulledBy.includes(agentId)) {
      command.pulledBy.push(agentId);
    }
    if (
      command.deliveredTo.length > 0 &&
      command.deliveredTo.every((id) => command.pulledBy.includes(id))
    ) {
      command.status = "delivered";
    }
  }
  commandInbox.delete(agentId);
  return pending;
}

export function addCommandResponse(
  commandId: string,
  agentId: string,
  output: string
): HubCommandResponse | null {
  const command = commandStore.find((c) => c.id === commandId);
  if (!command) return null;

  const response: HubCommandResponse = {
    id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    commandId,
    agentId,
    output,
    respondedAt: new Date().toISOString()
  };
  responseStore.push(response);

  if (!command.respondedBy.includes(agentId)) {
    command.respondedBy.push(agentId);
  }
  if (
    command.deliveredTo.length > 0 &&
    command.deliveredTo.every((id) => command.respondedBy.includes(id))
  ) {
    command.status = "completed";
  } else {
    command.status = "processing";
  }

  return response;
}

export function createMcpServer() {
  const server = new McpServer({
    name: "pumice-hub",
    version: "1.0.0"
  });

  // ── Tool: register_agent ────────────────────────────────────────────────────
  server.tool(
    "register_agent",
    "Register this agent with the Pumice hub so it appears in the UI. Call once on connect.",
    {
      id: z.string().describe("Unique stable agent instance ID"),
      name: z.string().describe("Human-readable agent name"),
      role: z.string().optional().describe("Agent role, e.g. architect, backend, qa"),
      capabilities: z.array(z.string()).optional().describe("List of capability strings"),
    },
    async ({ id, name, role, capabilities }) => {
      const now = new Date().toISOString();
      const existing = agentRegistry.get(id);
      agentRegistry.set(id, {
        id, name, role, capabilities,
        connectedAt: existing?.connectedAt ?? now,
        lastSeen: now,
      });
      return { content: [{ type: "text" as const, text: `registered:${id}` }] };
    }
  );

  // ── Tool: heartbeat ─────────────────────────────────────────────────────────
  server.tool(
    "heartbeat",
    "Update this agent's last-seen timestamp so it stays active in the hub.",
    { agentId: z.string() },
    async ({ agentId }) => {
      const agent = agentRegistry.get(agentId);
      if (agent) {
        agent.lastSeen = new Date().toISOString();
        agentRegistry.set(agentId, agent);
      }
      return { content: [{ type: "text" as const, text: "ok" }] };
    }
  );

  // ── Tool: unregister_agent ──────────────────────────────────────────────────
  server.tool(
    "unregister_agent",
    "Remove this agent from the hub registry on disconnect.",
    { agentId: z.string() },
    async ({ agentId }) => {
      agentRegistry.delete(agentId);
      return { content: [{ type: "text" as const, text: `unregistered:${agentId}` }] };
    }
  );

  // ── Tool: publish_result ────────────────────────────────────────────────────
  server.tool(
    "publish_result",
    "Publish this agent's completed result to the hub so subsequent agents can read it.",
    {
      taskId:  z.string().describe("Unique task identifier (e.g. task-1)"),
      role:    z.string().describe("Role that produced the result"),
      agent:   z.string().describe("Agent that ran the task"),
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

  // ── Tool: send_command ──────────────────────────────────────────────────────
  server.tool(
    "send_command",
    "Send a command to one agent (agent ID) or all active agents (target='*').",
    {
      target: z.string().describe("Agent ID or '*' for all active agents"),
      message: z.string().describe("Command text")
    },
    async ({ target, message }) => {
      const command = dispatchCommand(target, message);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(command) }]
      };
    }
  );

  // ── Tool: pull_commands ─────────────────────────────────────────────────────
  server.tool(
    "pull_commands",
    "Pull pending commands for a specific agent ID.",
    {
      agentId: z.string().describe("Agent ID")
    },
    async ({ agentId }) => {
      const commands = pullCommands(agentId);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(commands) }]
      };
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
  commandStore.length = 0;
  commandInbox.clear();
  responseStore.length = 0;
}
