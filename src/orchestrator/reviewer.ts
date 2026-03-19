import { AgentResult } from "../types.js";

export function buildReview(results: AgentResult[]) {
  const success = results.every((result) => result.success);

  const summary = results
    .map((result) =>
      [
        `## ${result.role.toUpperCase()} (${result.agent})`,
        `Task ID: ${result.taskId}`,
        `Status: ${result.success ? "ok" : "error"}`,
        "",
        result.output
      ].join("\n")
    )
    .join("\n\n---\n\n");

  return {
    success,
    summary
  };
}
