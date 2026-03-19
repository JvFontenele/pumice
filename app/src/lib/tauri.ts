import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ProjectConfig, ProjectSnapshot } from "../types";

export async function pickProjectDirectory() {
  try {
    const selected = await open({
      directory: true,
      multiple: false
    });

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
