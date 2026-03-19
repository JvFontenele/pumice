#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::sync::Mutex;

// ── Shared types ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
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
    #[serde(default)]
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ContextBlock {
    id: String,
    title: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FlowStep {
    id: String,
    agent_id: String,
    action: String,
    #[serde(default)]
    context_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DevFlow {
    id: String,
    name: String,
    goal: String,
    #[serde(default)]
    steps: Vec<FlowStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    mission: String,
    obsidian_vault_path: String,
    #[serde(default)]
    agents: Vec<AgentConfig>,
    #[serde(default)]
    contexts: Vec<ContextBlock>,
    #[serde(default)]
    flows: Vec<DevFlow>,
}

#[derive(Clone, Serialize)]
struct TaskLog {
    line: String,
    level: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultNote {
    /// Absolute path to the file.
    path: String,
    /// Path relative to vault root (for display).
    relative_path: String,
    /// File name without extension.
    title: String,
}

// ── Hub state ─────────────────────────────────────────────────────────────────

struct HubState {
    child: Mutex<Option<tokio::process::Child>>,
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn inspect_project(path: String) -> ProjectSnapshot {
    let root = Path::new(&path);
    let name = root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("workspace")
        .to_string();

    ProjectSnapshot {
        path: path.clone(),
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
        .map_err(|e| format!("failed to read {}: {}", path.display(), e))?;
    serde_json::from_str::<ProjectConfig>(&content)
        .map_err(|e| format!("failed to parse {}: {}", path.display(), e))
}

#[tauri::command]
fn save_project_config(project_path: String, config: ProjectConfig) -> Result<bool, String> {
    let dir = config_dir(&project_path);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create {}: {}", dir.display(), e))?;

    let path = config_path(&project_path);
    let payload = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("failed to serialize config: {}", e))?;

    fs::write(&path, payload)
        .map_err(|e| format!("failed to write {}: {}", path.display(), e))?;

    Ok(true)
}

/// Start the MCP hub server as a background process.
/// Returns the hub URL (e.g. "http://127.0.0.1:47821").
/// Safe to call multiple times — returns early if already running.
#[tauri::command]
async fn start_hub_server(
    state: tauri::State<'_, Arc<HubState>>,
) -> Result<String, String> {
    let mut guard = state.child.lock().await;

    // Already running — check if process is still alive.
    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok("http://127.0.0.1:47821".to_string()), // still alive
            _ => { *guard = None; } // died, respawn below
        }
    }

    let child = spawn_hub_child()?;

    *guard = Some(child);

    // Give Node.js a moment to bind the port.
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

    Ok("http://127.0.0.1:47821".to_string())
}

/// Stop the hub server process.
#[tauri::command]
async fn stop_hub_server(
    state: tauri::State<'_, Arc<HubState>>,
) -> Result<(), String> {
    let mut guard = state.child.lock().await;
    if let Some(mut child) = guard.take() {
        child.kill().await.ok();
    }
    Ok(())
}

/// List all Markdown notes in the Obsidian vault directory.
#[tauri::command]
fn list_vault_notes(vault_path: String) -> Result<Vec<VaultNote>, String> {
    let root = Path::new(&vault_path);
    if !root.exists() {
        return Err(format!("Vault directory not found: {}", vault_path));
    }

    let mut notes = Vec::new();
    collect_md_files(root, root, &mut notes);
    notes.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(notes)
}

fn collect_md_files(root: &Path, dir: &Path, notes: &mut Vec<VaultNote>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        // Skip hidden dirs (.obsidian, .git, etc.)
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') { continue; }
        }
        if path.is_dir() {
            collect_md_files(root, &path, notes);
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let title = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            notes.push(VaultNote {
                path: path.to_string_lossy().to_string(),
                relative_path: relative,
                title,
            });
        }
    }
}

/// Read the content of a single vault note.
#[tauri::command]
fn read_vault_note(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("failed to read {}: {}", file_path, e))
}

/// Spawns `npx tsx src/index.ts` and streams output as `task:log` events.
#[tauri::command]
async fn run_task(
    app_handle: tauri::AppHandle,
    title: String,
    description: String,
    context: String,
    project_path: String,
    mock_mode: bool,
    _hub_mode: bool,
) -> Result<bool, String> {
    use tauri::Emitter;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::task;

    let pumice_root = get_pumice_root();
    let env_overrides = load_project_env_overrides(&project_path);

    app_handle
        .emit(
            "task:log",
            TaskLog {
                line: format!("[pumice] Starting task in {}", pumice_root.display()),
                level: "info".to_string(),
            },
        )
        .ok();

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = tokio::process::Command::new("cmd");
        c.args(["/C", "npx", "tsx", "src/index.ts", &title, &description, &context]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = tokio::process::Command::new("npx");
        c.args(["tsx", "src/index.ts", &title, &description, &context]);
        c
    };

    cmd.current_dir(&pumice_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if mock_mode {
        cmd.env("PUMICE_MOCK_RESPONSES", "true");
    }
    cmd.env("PUMICE_HUB", "true");
    cmd.env("PUMICE_PROJECT_DIR", project_path.clone());
    for (k, v) in &env_overrides {
        cmd.env(k, v);
    }

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start orchestrator: {}. Make sure Node.js and npx are in your PATH.",
            e
        )
    })?;

    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");

    let app1 = app_handle.clone();
    let t_out = task::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app1.emit("task:log", TaskLog { line, level: "stdout".to_string() }).ok();
        }
    });

    let app2 = app_handle.clone();
    let t_err = task::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.trim().is_empty() {
                app2.emit("task:log", TaskLog { line, level: "stderr".to_string() }).ok();
            }
        }
    });

    let _ = tokio::join!(t_out, t_err);

    let status = child.wait().await.map_err(|e| e.to_string())?;
    Ok(status.success())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn get_pumice_root() -> PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
}

fn config_dir(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".pumice")
}

fn config_path(project_path: &str) -> PathBuf {
    config_dir(project_path).join("project.json")
}

fn load_project_env_overrides(project_path: &str) -> Vec<(String, String)> {
    let path = config_path(project_path);
    let mut overrides: Vec<(String, String)> = Vec::new();

    let Ok(content) = fs::read_to_string(&path) else {
        return overrides;
    };
    let Ok(cfg) = serde_json::from_str::<ProjectConfig>(&content) else {
        return overrides;
    };

    if !cfg.obsidian_vault_path.is_empty() {
        overrides.push(("OBSIDIAN_VAULT_DIR".to_string(), cfg.obsidian_vault_path.clone()));
    }
    if let Ok(serialized_agents) = serde_json::to_string(&cfg.agents) {
        overrides.push(("PUMICE_AGENTS_JSON".to_string(), serialized_agents));
    }

    for agent in &cfg.agents {
        let (p, c, m) = match agent.role.as_str() {
            "architect" | "reviewer" => ("CLAUDE_PROVIDER", "CLAUDE_COMMAND", "CLAUDE_MODEL"),
            "backend" | "frontend" => ("CODEX_PROVIDER", "CODEX_COMMAND", "CODEX_MODEL"),
            _ => ("GEMINI_PROVIDER", "GEMINI_COMMAND", "GEMINI_MODEL"),
        };
        if !overrides.iter().any(|(k, _)| k == p) {
            overrides.push((p.to_string(), agent.provider.clone()));
            overrides.push((c.to_string(), agent.command.clone()));
            overrides.push((m.to_string(), agent.model.clone()));
        }
    }

    overrides
}

#[tauri::command]
fn check_tool(command: String) -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "where", command.as_str()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("sh")
            .args(["-c", &format!("command -v {}", command)])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

#[tauri::command]
fn check_ollama(base_url: String) -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    let stripped = base_url
        .trim_end_matches('/')
        .trim_start_matches("https://")
        .trim_start_matches("http://");

    if let Ok(addr) = stripped.parse::<std::net::SocketAddr>() {
        if TcpStream::connect_timeout(&addr, Duration::from_secs(2)).is_ok() {
            return true;
        }
    }

    check_tool("ollama".to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let hub_state = Arc::new(HubState {
        child: Mutex::new(None),
    });

    tauri::Builder::default()
        .manage(hub_state)
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = app.state::<Arc<HubState>>().inner().clone();
            tauri::async_runtime::spawn(async move {
                let mut guard = state.child.lock().await;
                if guard.is_none() {
                    if let Ok(child) = spawn_hub_child() {
                        *guard = Some(child);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            inspect_project,
            load_project_config,
            save_project_config,
            start_hub_server,
            stop_hub_server,
            list_vault_notes,
            read_vault_note,
            run_task,
            check_tool,
            check_ollama,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn spawn_hub_child() -> Result<tokio::process::Child, String> {
    let pumice_root = get_pumice_root();

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = tokio::process::Command::new("cmd");
        c.args(["/C", "npx", "tsx", "src/hub/standalone.ts"]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = tokio::process::Command::new("npx");
        c.args(["tsx", "src/hub/standalone.ts"]);
        c
    };

    cmd.current_dir(&pumice_root)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    cmd.spawn().map_err(|e| {
        format!(
            "Failed to start hub: {}. Make sure Node.js and npx are in PATH.",
            e
        )
    })
}
