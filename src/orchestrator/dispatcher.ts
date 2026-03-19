import { config } from "../config.js";
import { runClaude } from "../agents/claude.js";
import { runCodex } from "../agents/codex.js";
import { runGemini } from "../agents/gemini.js";
import { AgentResult, SubTask } from "../types.js";
import { buildMockOutput } from "../utils/mock.js";

export async function dispatchTask(task: SubTask): Promise<AgentResult> {
  if (task.role === "architect" || task.role === "reviewer") {
    if (config.mockResponses) {
      return buildMockResult("claude", task);
    }

    const result = await runClaude(task.instructions);
    return {
      agent: "claude",
      role: task.role,
      taskId: task.id,
      success: result.success,
      output: result.success
        ? result.stdout
        : formatAgentError("claude", config.claudeCommand, result.stderr)
    };
  }

  if (task.role === "backend" || task.role === "frontend") {
    if (config.mockResponses) {
      return buildMockResult("codex", task);
    }

    const result = await runCodex(task.instructions);
    return {
      agent: "codex",
      role: task.role,
      taskId: task.id,
      success: result.success,
      output: result.success
        ? result.stdout
        : formatAgentError("codex", config.codexCommand, result.stderr)
    };
  }

  if (config.mockResponses) {
    return buildMockResult("gemini", task);
  }

  const result = await runGemini(task.instructions);
  return {
    agent: "gemini",
    role: task.role,
    taskId: task.id,
    success: result.success,
    output: result.success
      ? result.stdout
      : formatAgentError("gemini", config.geminiCommand, result.stderr)
  };
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

function formatAgentError(agent: string, command: string, stderr: string) {
  return [
    `Agent "${agent}" failed while running command "${command}".`,
    "",
    stderr.trim() || "No stderr output was returned.",
    "",
    "Tip: configure the command in .env or set PUMICE_MOCK_RESPONSES=true to validate the orchestration flow without external CLIs."
  ].join("\n");
}
