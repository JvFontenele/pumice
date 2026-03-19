import path from "node:path";
import { config } from "./config.js";
import { writeObsidianNote } from "./agents/obsidian.js";
import { createPlan } from "./orchestrator/planner.js";
import { dispatchTask } from "./orchestrator/dispatcher.js";
import { buildReview } from "./orchestrator/reviewer.js";
import { ensureDir, saveTextFile } from "./utils/fs.js";
import { MasterTask } from "./types.js";

async function main() {
  const title = process.argv[2] ?? "New feature";
  const description =
    process.argv[3] ??
    "Describe the feature in the command line when running the script.";
  const context = process.argv[4] ?? "";

  const task: MasterTask = { title, description, context };

  await ensureDir(config.workspaceDir);
  await ensureDir(path.join(config.workspaceDir, "tasks"));
  await ensureDir(path.join(config.workspaceDir, "outputs"));

  const plan = createPlan(task);
  const results = [];

  console.log(`[pumice] Pipeline: ${plan.map(t => t.role).join(" → ")}`);

  for (const subTask of plan) {
    console.log(`[pumice:stage] ${subTask.role} — ${subTask.title}`);

    await saveTextFile(
      path.join(config.workspaceDir, "tasks", `${subTask.id}.md`),
      [
        `# ${subTask.title}`,
        "",
        `Role: ${subTask.role}`,
        subTask.dependsOn?.length
          ? `Depends on: ${subTask.dependsOn.join(", ")}`
          : "Depends on: none",
        "",
        "## Instructions",
        subTask.instructions
      ].join("\n")
    );

    const result = await dispatchTask(subTask);
    results.push(result);

    await saveTextFile(
      path.join(config.workspaceDir, "outputs", `${subTask.id}.md`),
      `# ${subTask.title}\n\n${result.output}`
    );

    console.log(
      `[pumice:result] ${subTask.role} — ${result.success ? "ok" : "error"}`
    );

    if (!result.success) {
      console.log(`[pumice:error] ${result.output.split("\n")[0]}`);
    }

    if (config.failFast && !result.success) {
      console.log("[pumice:abort] Stopping due to PUMICE_FAIL_FAST=true");
      break;
    }
  }

  const review = buildReview(results);

  await saveTextFile(
    path.join(config.workspaceDir, "final-review.md"),
    review.summary
  );

  await writeObsidianNote(
    `${new Date().toISOString().slice(0, 10)}-${slugify(title)}`,
    `# ${title}

## Description
${description}

## Context
${context || "No context provided"}

## Result
${review.summary}
`
  );

  console.log(`[pumice:done] ${review.success ? "all stages complete" : "completed with errors"}`);
  console.log(review.summary);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main().catch((error) => {
  console.error("Failed to execute orchestrator:", error);
  process.exit(1);
});
