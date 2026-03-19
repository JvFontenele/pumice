import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createMcpServer,
  store,
  agentRegistry,
  activeAgents,
  commandStore,
  dispatchCommand,
  pullCommands,
  addCommandResponse,
  responseStore
} from "./server.js";
import { config } from "../config.js";
import { HubEntry, AgentName, TaskRole } from "../types.js";
import * as http from "node:http";

let httpServer: http.Server | null = null;

/**
 * Start the MCP hub server on the configured port.
 * Returns the base URL (e.g. "http://127.0.0.1:47821").
 * Mutates config.hub.url in place so all modules can reference it.
 *
 * Exposes two interfaces:
 *   /mcp        — MCP Streamable HTTP for Claude CLI (--mcp-config)
 *   /api/*      — Simple REST for the internal hub client (faster, no session overhead)
 */
export async function startHub(): Promise<string> {
  const app = express();
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());

  // ── MCP endpoint (for Claude CLI --mcp-config) ──────────────────────────────
  // A new transport + server instance per request is used here because
  // StreamableHTTPServerTransport stateless mode closes its state after each response.
  app.post("/mcp", async (req, res) => {
    try {
      const { server } = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  app.get("/mcp", async (req, res) => {
    try {
      const { server } = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  app.delete("/mcp", async (req, res) => {
    try {
      const { server } = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  // ── REST API (for internal hub client) ─────────────────────────────────────

  /** GET /api/results — list all published results ordered by publishedAt */
  app.get("/api/results", (_req, res) => {
    const all = sortedResults();
    res.json(all);
  });

  /** GET /api/results/:taskId — get a single result */
  app.get("/api/results/:taskId", (req, res) => {
    const entry = store.get(req.params.taskId);
    if (!entry) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(entry);
  });

  /** POST /api/results — publish a result */
  app.post("/api/results", (req, res) => {
    const body = req.body as Partial<HubEntry>;
    if (!body.taskId || !body.role || !body.agent || body.success === undefined || !body.output) {
      res.status(400).json({ error: "missing fields" });
      return;
    }
    const entry: HubEntry = {
      taskId: body.taskId,
      role: body.role as TaskRole,
      agent: body.agent as AgentName,
      success: body.success,
      output: body.output,
      publishedAt: new Date().toISOString()
    };
    store.set(entry.taskId, entry);
    res.json({ ok: true, taskId: entry.taskId });
  });

  /** GET /api/context — formatted markdown summary of all results */
  app.get("/api/context", (_req, res) => {
    const all = sortedResults();
    if (all.length === 0) {
      res.type("text").send("No results published yet.");
      return;
    }
    const md = all
      .map(e => `## ${e.role.toUpperCase()} (${e.agent}) — task ${e.taskId}\n\n${e.output}`)
      .join("\n\n---\n\n");
    res.type("text").send(md);
  });

  /** GET /api/agents — list active connected agents */
  app.get("/api/agents", (_req, res) => {
    res.json(activeAgents());
  });

  /** POST /api/agents/register — register or refresh an agent */
  app.post("/api/agents/register", (req, res) => {
    const id = String(req.body?.id ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const role = req.body?.role ? String(req.body.role) : undefined;
    const capabilities = Array.isArray(req.body?.capabilities)
      ? req.body.capabilities.map((v: unknown) => String(v))
      : undefined;

    if (!id || !name) {
      res.status(400).json({ error: "missing id or name" });
      return;
    }

    const now = new Date().toISOString();
    const existing = agentRegistry.get(id);
    agentRegistry.set(id, {
      id,
      name,
      role,
      capabilities,
      connectedAt: existing?.connectedAt ?? now,
      lastSeen: now
    });

    res.json({ ok: true, id });
  });

  /** DELETE /api/agents/:id — force-disconnect an agent */
  app.delete("/api/agents/:id", (req, res) => {
    agentRegistry.delete(req.params.id);
    res.json({ ok: true });
  });

  /** POST /api/commands — send command to one agent or all ("*") */
  app.post("/api/commands", (req, res) => {
    const target = String(req.body?.target ?? "").trim();
    const message = String(req.body?.message ?? "").trim();

    if (!target || !message) {
      res.status(400).json({ error: "missing target or message" });
      return;
    }

    const command = dispatchCommand(target, message);
    res.json(command);
  });

  /** GET /api/commands — command history */
  app.get("/api/commands", (_req, res) => {
    res.json([...commandStore].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
  });

  /** GET /api/commands/:agentId/pull — pull pending commands for an agent */
  app.get("/api/commands/:agentId/pull", (req, res) => {
    res.json(pullCommands(req.params.agentId));
  });

  /** POST /api/commands/:commandId/respond — submit agent response for command */
  app.post("/api/commands/:commandId/respond", (req, res) => {
    const commandId = req.params.commandId;
    const agentId = String(req.body?.agentId ?? "").trim();
    const output = String(req.body?.output ?? "").trim();

    if (!agentId || !output) {
      res.status(400).json({ error: "missing agentId or output" });
      return;
    }

    const response = addCommandResponse(commandId, agentId, output);
    if (!response) {
      res.status(404).json({ error: "command_not_found" });
      return;
    }

    res.json(response);
  });

  /** GET /api/responses — list recent command responses */
  app.get("/api/responses", (_req, res) => {
    res.json([...responseStore].sort((a, b) => b.respondedAt.localeCompare(a.respondedAt)));
  });

  /** GET /health — liveness probe */
  app.get("/health", (_req, res) => {
    res.json({ ok: true, tool: "pumice-hub", entries: store.size, agents: activeAgents().length });
  });

  return new Promise((resolve, reject) => {
    httpServer = app.listen(config.hub.port, "127.0.0.1", () => {
      const addr = httpServer!.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;
      config.hub.url = url;
      resolve(url);
    });
    httpServer!.on("error", reject);
  });
}

/** Gracefully close the MCP hub server. */
export async function stopHub(): Promise<void> {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    httpServer.close(() => resolve());
    httpServer = null;
  });
}

function sortedResults(): HubEntry[] {
  return [...store.values()].sort((a, b) =>
    a.publishedAt.localeCompare(b.publishedAt)
  );
}
