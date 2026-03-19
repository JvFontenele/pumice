import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, store } from "./server.js";
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

  /** GET /health — liveness probe */
  app.get("/health", (_req, res) => {
    res.json({ ok: true, tool: "pumice-hub", entries: store.size });
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
