import { AgentName, TaskRole } from "../types.js";

export function buildMockOutput(
  agent: AgentName,
  role: TaskRole,
  prompt: string
): string {
  return [
    `Mock response generated for agent "${agent}" in role "${role}".`,
    "",
    "Prompt excerpt:",
    prompt.slice(0, 600).trim()
  ].join("\n");
}
