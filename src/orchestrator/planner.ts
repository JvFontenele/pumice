import { MasterTask, SubTask, PipelineAgentConfig } from "../types.js";

export function createPlan(
  task: MasterTask,
  agents: PipelineAgentConfig[] = []
): SubTask[] {
  if (agents.length > 0) {
    return agents.map((agent, index) => {
      const id = `task-${index + 1}`;
      const dependsOn =
        index === 0 ? undefined : agents.slice(0, index).map((_, i) => `task-${i + 1}`);

      return {
        id,
        title: `${agent.name}: ${task.title}`,
        role: agent.role,
        dependsOn,
        agent,
        instructions: buildDynamicInstructions(task, agent)
      };
    });
  }

  return [
    {
      id: "task-1",
      title: `Architecture: ${task.title}`,
      role: "architect",
      instructions: `
Analyze the task below and propose architecture, folder structure, risks, and implementation strategy.

TITLE:
${task.title}

DESCRIPTION:
${task.description}

CONTEXT:
${task.context ?? "No additional context"}

Expected output:
- overview
- technical decisions
- contracts/interfaces
- risks
- next steps
      `.trim()
    },
    {
      id: "task-2",
      title: `Implementation: ${task.title}`,
      role: "backend",
      instructions: `
Implement the task below following the defined architecture.

TITLE:
${task.title}

DESCRIPTION:
${task.description}

Expected output:
- changed files
- proposed code
- required commands
- observations
      `.trim(),
      dependsOn: ["task-1"]
    },
    {
      id: "task-3",
      title: `Validation and tests: ${task.title}`,
      role: "qa",
      instructions: `
Create a test and validation strategy for the task below.

TITLE:
${task.title}

DESCRIPTION:
${task.description}

Expected output:
- suggested tests
- edge cases
- regression risks
- validation checklist
      `.trim(),
      dependsOn: ["task-2"]
    },
    {
      id: "task-4",
      title: `Documentation: ${task.title}`,
      role: "docs",
      instructions: `
Document the task below for project memory.

TITLE:
${task.title}

DESCRIPTION:
${task.description}

Expected output:
- feature summary
- technical decision
- deployment checklist
- pending items
      `.trim(),
      dependsOn: ["task-1", "task-2", "task-3"]
    }
  ];
}

function buildDynamicInstructions(task: MasterTask, agent: PipelineAgentConfig) {
  return [
    `You are ${agent.name}.`,
    `Primary role: ${agent.role}.`,
    agent.goal ? `Goal: ${agent.goal}` : "",
    "",
    "Execute your stage for the task below. Reuse prior shared context when available.",
    "",
    "TITLE:",
    task.title,
    "",
    "DESCRIPTION:",
    task.description,
    "",
    "CONTEXT:",
    task.context ?? "No additional context",
    "",
    "Expected output:",
    "- concise execution summary",
    "- important decisions",
    "- files/commands when relevant",
    "- risks or open questions"
  ]
    .filter(Boolean)
    .join("\n");
}
