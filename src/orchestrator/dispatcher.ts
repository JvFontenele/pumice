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
  hubClient?: HubClient | null
): Promise<AgentResult> {
  const instructions = await buildInstructions(task.instructions, hubClient);

  if (task.role === "architect" || task.role === "reviewer") {
    if (config.mockResponses) {
      return buildMockResult("claude", task);
    }

    const mcpConfigPath = hubClient ? await writeMcpConfig(config.hub.url).catch(() => undefined) : undefined;
    const result = await runClaude(instructions, mcpConfigPath);
    return {
      agent: config.claude.provider === "ollama" ? "ollama" : "claude",
      role: task.role,
      taskId: task.id,
      success: result.success,
      output: result.success
        ? result.stdout
        : formatAgentError(
            "claude",
            config.claude.command,
            config.claude.provider,
            result.stderr
          )
    };
  }

  if (task.role === "backend" || task.role === "frontend") {
    if (config.mockResponses) {
      return buildMockResult("codex", task);
    }

    const result = await runCodex(instructions);
    return {
      agent: config.codex.provider === "ollama" ? "ollama" : "codex",
      role: task.role,
      taskId: task.id,
      success: result.success,
      output: result.success
        ? result.stdout
        : formatAgentError(
            "codex",
            config.codex.command,
            config.codex.provider,
            result.stderr
          )
    };
  }

  if (config.mockResponses) {
    return buildMockResult("gemini", task);
  }

  const result = await runGemini(instructions);
  return {
    agent: config.gemini.provider === "ollama" ? "ollama" : "gemini",
    role: task.role,
    taskId: task.id,
    success: result.success,
    output: result.success
      ? result.stdout
      : formatAgentError(
          "gemini",
          config.gemini.provider === "ollama"
            ? config.ollamaCommand
            : config.gemini.command,
          config.gemini.provider,
          result.stderr
        )
  };
}

/**
 * Fetches the context summary from the hub and prepends it to the base instructions.
 * Falls back to the original instructions if the hub is unavailable.
 */
async function buildInstructions(base: string, hub?: HubClient | null): Promise<string> {
  if (!hub) return base;

  try {
    const summary = await hub.getContextSummary();
    if (!summary || summary === "No results published yet.") return base;

    return [
      "## Context from previous pipeline stages",
      "",
      summary,
      "",
      "---",
      "",
      base
    ].join("\n");
  } catch {
    return base;
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
