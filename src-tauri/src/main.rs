#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
struct ProjectSnapshot {
    path: String,
    name: String,
    is_git_repo: bool,
    has_package_json: bool,
    has_obsidian_vault: bool,
    has_docs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentConfig {
    id: String,
    name: String,
    role: String,
    provider: String,
    model: String,
    command: String,
    goal: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    mission: String,
    obsidian_vault_path: String,
    agents: Vec<AgentConfig>,
}

#[tauri::command]
fn inspect_project(path: String) -> ProjectSnapshot {
    let root = Path::new(&path);
    let name = root
        .file_name()
        .and_then(|segment| segment.to_str())
        .unwrap_or("workspace")
        .to_string();

    ProjectSnapshot {
        path,
        name,
        is_git_repo: root.join(".git").exists(),
        has_package_json: root.join("package.json").exists(),
        has_obsidian_vault: root.join("obsidian-vault").exists()
            || root.join(".obsidian").exists(),
        has_docs: root.join("docs").exists(),
    }
}

#[tauri::command]
fn load_project_config(project_path: String) -> Result<ProjectConfig, String> {
    let path = config_path(&project_path);
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {}", path.display(), error))?;

    serde_json::from_str::<ProjectConfig>(&content)
        .map_err(|error| format!("failed to parse {}: {}", path.display(), error))
}

#[tauri::command]
fn save_project_config(project_path: String, config: ProjectConfig) -> Result<bool, String> {
    let directory = config_dir(&project_path);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("failed to create {}: {}", directory.display(), error))?;

    let path = config_path(&project_path);
    let payload = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("failed to serialize project config: {}", error))?;

    fs::write(&path, payload)
        .map_err(|error| format!("failed to write {}: {}", path.display(), error))?;

    Ok(true)
}

fn config_dir(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".pumice")
}

fn config_path(project_path: &str) -> PathBuf {
    config_dir(project_path).join("project.json")
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_project,
            load_project_config,
            save_project_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
