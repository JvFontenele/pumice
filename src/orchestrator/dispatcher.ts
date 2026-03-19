import { config } from "../config.js";
import { runClaude } from "../agents/claude.js";
import { runCodex } from "../agents/codex.js";
import { runGemini } from "../agents/gemini.js";
import { AgentResult, SubTask } from "../types.js";
import { buildMockOutput } from "../utils/mock.js";
import { HubClient } from "../hub/client.js";
import { writeMcpConfig } from "../hub/mcp-config.js";

export async function dispatchTask(
  task: SubTask,
  hubClient?: HubClient | null,
  vaultContext?: string
): Promise<AgentResult> {
  const instructions = await buildInstructions(task.instructions, hubClient, vaultContext);
  const engine = inferEngine(task);
  const agentLabel = task.agent?.name ?? engine;
  const provider = inferProvider(task, engine);
  const command = inferCommand(task, engine);
  const model = task.agent?.model ?? inferModel(engine);
  const cwd = config.targetProjectDir;

  if (hubClient && task.agent) {
    await hubClient
      .registerAgent({
        id: task.agent.id,
        name: task.agent.name,
        role: task.agent.role,
        capabilities: [`engine:${engine}`, `provider:${provider}`]
      })
      .catch(() => undefined);
  }

  if (config.mockResponses) {
    return buildMockResult(agentLabel, task);
  }

  if (engine === "claude") {
    const mcpConfigPath = hubClient
      ? await writeMcpConfig(config.hub.url).catch(() => undefined)
      : undefined;
    const result = await runClaude(instructions, mcpConfigPath, {
      command,
      provider,
      model,
      cwd
    });

    return {
      agent: agentLabel,
      role: task.role,
      taskId: task.id,
      success: result.success,
      output: result.success
        ? result.stdout
        : formatAgentError("claude", command, provider, result.stderr)
    };
  }

  if (engine === "codex") {
    const result = await runCodex(instructions, { command, provider, model, cwd });
    return {
      agent: agentLabel,
      role: task.role,
      taskId: task.id,
      success: result.success,
      output: result.success
        ? result.stdout
        : formatAgentError("codex", command, provider, result.stderr)
    };
  }

  const result = await runGemini(instructions, { command, provider, model, cwd });
  return {
    agent: agentLabel,
    role: task.role,
    taskId: task.id,
    success: result.success,
    output: result.success
      ? result.stdout
      : formatAgentError("gemini", command, provider, result.stderr)
  };
}

/**
 * Fetches the context summary from the hub and prepends it to the base instructions.
 * Falls back to the original instructions if the hub is unavailable.
 */
async function buildInstructions(
  base: string,
  hub?: HubClient | null,
  vaultContext?: string
): Promise<string> {
  const blocks: string[] = [];

  if (vaultContext?.trim()) {
    blocks.push("## Context from Obsidian Vault", "", vaultContext.trim());
  }

  if (!hub) {
    if (blocks.length === 0) return base;
    return [...blocks, "", "---", "", base].join("\n");
  }

  try {
    const summary = await hub.getContextSummary();
    if (summary && summary !== "No results published yet.") {
      blocks.push("## Context from previous stages", "", summary);
    }

    if (blocks.length === 0) return base;
    return [...blocks, "", "---", "", base].join("\n");
  } catch {
    if (blocks.length === 0) return base;
    return [...blocks, "", "---", "", base].join("\n");
  }
}

function buildMockResult(agent: AgentResult["agent"], task: SubTask): AgentResult {
  return {
    agent,
    role: task.role,
    taskId: task.id,
    success: true,
    output: buildMockOutput(agent, task.role, task.instructions)
  };
}

function formatAgentError(
  agent: string,
  command: string,
  provider: string,
  stderr: string
) {
  return [
    `Agent "${agent}" failed while running command "${command}" with provider "${provider}".`,
    "",
    stderr.trim() || "No stderr output was returned.",
    "",
    "Tip: configure the command in .env or set PUMICE_MOCK_RESPONSES=true to validate the orchestration flow without external CLIs."
  ].join("\n");
}

function inferEngine(task: SubTask): "claude" | "codex" | "gemini" {
  const command = (task.agent?.command ?? "").toLowerCase();
  if (command.includes("claude")) return "claude";
  if (command.includes("codex")) return "codex";
  if (command.includes("gemini")) return "gemini";

  if (task.role === "architect" || task.role === "reviewer") return "claude";
  if (task.role === "backend" || task.role === "frontend") return "codex";
  return "gemini";
}

function inferProvider(task: SubTask, engine: "claude" | "codex" | "gemini") {
  if (task.agent?.provider) return task.agent.provider;
  if (engine === "claude") return config.claude.provider;
  if (engine === "codex") return config.codex.provider;
  return config.gemini.provider;
}

function inferCommand(task: SubTask, engine: "claude" | "codex" | "gemini") {
  if (task.agent?.command) return task.agent.command;
  if (engine === "claude") return config.claude.command;
  if (engine === "codex") return config.codex.command;
  return config.gemini.command;
}

function inferModel(engine: "claude" | "codex" | "gemini") {
  if (engine === "claude") return config.claude.model;
  if (engine === "codex") return config.codex.model;
  return config.gemini.model;
}
