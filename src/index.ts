import path from "node:path";
import { config } from "./config.js";
import { writeObsidianNote } from "./agents/obsidian.js";
import { createPlan } from "./orchestrator/planner.js";
import { dispatchTask } from "./orchestrator/dispatcher.js";
import { buildReview } from "./orchestrator/reviewer.js";
import { ensureDir, saveTextFile } from "./utils/fs.js";
import { MasterTask, PipelineAgentConfig } from "./types.js";
import { startHub, stopHub } from "./hub/transport.js";
import { createHubClient, HubClient } from "./hub/client.js";
import { promises as fs } from "node:fs";

async function main() {
  const title = process.argv[2] ?? "New feature";
  const description =
    process.argv[3] ??
    "Describe the feature in the command line when running the script.";
  const context = process.argv[4] ?? "";

  const runtimeAgents = readRuntimeAgents();
  const vaultContext = await readVaultContext();
  const mergedContext = [context, vaultContext].filter(Boolean).join("\n\n");

  const task: MasterTask = { title, description, context: mergedContext };

  await ensureDir(config.workspaceDir);
  await ensureDir(path.join(config.workspaceDir, "tasks"));
  await ensureDir(path.join(config.workspaceDir, "outputs"));

  // ── Start MCP Hub (opt-in via PUMICE_HUB=true) ─────────────────────────────
  let hubClient: HubClient | null = null;
  if (config.hub.enabled) {
    try {
      const hubUrl = await startHub();
      hubClient = createHubClient(hubUrl);
      console.log(`[pumice:hub] started at ${hubUrl}`);
    } catch (err) {
      const sharedHubUrl = `http://127.0.0.1:${config.hub.port}`;
      hubClient = createHubClient(sharedHubUrl);
      config.hub.url = sharedHubUrl;
      console.log(
        `[pumice:hub] start skipped (${String(
          err
        )}), using existing hub at ${sharedHubUrl}`
      );
    }
  }

  const plan = createPlan(task, runtimeAgents);
  const results = [];

  console.log(
    `[pumice] Pipeline: ${plan
      .map((t) => t.agent?.name ?? t.role)
      .join(" → ")}`
  );

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

    const result = await dispatchTask(subTask, hubClient, vaultContext);
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

    // Publish result to hub so subsequent agents can read it
    if (hubClient) {
      try {
        await hubClient.publish({
          taskId: result.taskId,
          role: result.role,
          agent: result.agent,
          success: result.success,
          output: result.output
        });
        console.log(`[pumice:hub] published ${result.role} (${result.taskId})`);
      } catch (err) {
        console.log(`[pumice:hub] publish failed (non-fatal): ${err}`);
      }
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

  // ── Stop hub ────────────────────────────────────────────────────────────────
  if (config.hub.enabled && hubClient) {
    try {
      await stopHub();
      console.log("[pumice:hub] stopped");
    } catch {
      // ignore
    }
  }
}

function readRuntimeAgents(): PipelineAgentConfig[] {
  const raw = process.env.PUMICE_AGENTS_JSON?.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a === "object")
      .map((a, index) => ({
        id: String(a.id ?? `agent-${index + 1}`),
        name: String(a.name ?? `Agent ${index + 1}`),
        role: String(a.role ?? "contributor"),
        provider: a.provider === "ollama" ? "ollama" : "native",
        model: String(a.model ?? ""),
        command: String(a.command ?? "gemini"),
        goal: String(a.goal ?? "")
      }));
  } catch {
    console.log("[pumice:agents] invalid PUMICE_AGENTS_JSON, falling back to default plan");
    return [];
  }
}

async function readVaultContext(): Promise<string> {
  const root = config.obsidianVaultDir;
  try {
    const markdownFiles = await collectMarkdownFiles(root);
    if (markdownFiles.length === 0) return "";

    const sorted = markdownFiles.sort((a, b) => b.mtime - a.mtime).slice(0, 4);
    const snippets: string[] = [];

    for (const file of sorted) {
      const content = await fs.readFile(file.path, "utf-8").catch(() => "");
      if (!content.trim()) continue;
      snippets.push(
        `### ${path.basename(file.path)}\n\n${content.slice(0, 1200).trim()}`
      );
    }

    if (snippets.length === 0) return "";
    return ["## Recent notes from Obsidian vault", "", ...snippets].join("\n\n");
  } catch {
    return "";
  }
}

async function collectMarkdownFiles(dir: string): Promise<Array<{ path: string; mtime: number }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: Array<{ path: string; mtime: number }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath).catch(() => [])));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    const stats = await fs.stat(fullPath).catch(() => null);
    if (!stats) continue;

    files.push({ path: fullPath, mtime: stats.mtimeMs });
  }

  return files;
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
