import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ProjectConfig, ProjectSnapshot } from "../types";

// ── Project ───────────────────────────────────────────────────────────────────

export async function pickProjectDirectory(): Promise<string | null> {
  try {
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
}

export async function inspectProject(path: string): Promise<ProjectSnapshot | null> {
  try {
    return await invoke<ProjectSnapshot>("inspect_project", { path });
  } catch {
    return null;
  }
}

export async function loadProjectConfig(
  projectPath: string
): Promise<ProjectConfig | null> {
  try {
    return await invoke<ProjectConfig>("load_project_config", { projectPath });
  } catch {
    return null;
  }
}

export async function saveProjectConfig(
  projectPath: string,
  config: ProjectConfig
): Promise<boolean> {
  try {
    return await invoke<boolean>("save_project_config", { projectPath, config });
  } catch {
    return false;
  }
}

// ── Agent availability ────────────────────────────────────────────────────────

/**
 * Returns true if `command` is available in the system PATH.
 * Works on Windows (uses `where`) and Unix (uses `command -v`).
 */
export async function checkTool(command: string): Promise<boolean> {
  try {
    return await invoke<boolean>("check_tool", { command });
  } catch {
    return false;
  }
}

/**
 * Returns true if the Ollama server at `baseUrl` is reachable,
 * or if the `ollama` CLI is present in PATH as a fallback.
 */
export async function checkOllama(baseUrl = "http://localhost:11434"): Promise<boolean> {
  try {
    return await invoke<boolean>("check_ollama", { baseUrl });
  } catch {
    return false;
  }
}

// ── Task execution ────────────────────────────────────────────────────────────

export interface TaskLogPayload {
  line: string;
  /** "stdout" | "stderr" | "info" */
  level: string;
}

/**
 * Invokes the Rust `run_task` command.
 * Streams output via `task:log` Tauri events while running.
 */
export async function runTask(
  title: string,
  description: string,
  context: string,
  projectPath: string,
  mockMode: boolean,
  hubMode: boolean = false
): Promise<boolean> {
  return invoke<boolean>("run_task", {
    title,
    description,
    context,
    projectPath,
    mockMode,
    hubMode,
  });
}

/**
 * Subscribes to `task:log` events from the Rust backend.
 * Returns an unlisten function — call it to unsubscribe.
 */
export async function onTaskLog(
  callback: (payload: TaskLogPayload) => void
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<TaskLogPayload>("task:log", (e) => callback(e.payload));
}
