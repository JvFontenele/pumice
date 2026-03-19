#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;

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
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    mission: String,
    obsidian_vault_path: String,
    agents: Vec<AgentConfig>,
}

/// Event payload streamed to the frontend while a task is running.
#[derive(Clone, Serialize)]
struct TaskLog {
    /// Raw text line from the process.
    line: String,
    /// "stdout" | "stderr" | "info"
    level: String,
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

/// Spawns `npx tsx src/index.ts <title> <description> <context>` from the
/// Pumice project root and streams every output line as a `task:log` event.
#[tauri::command]
async fn run_task(
    app_handle: tauri::AppHandle,
    title: String,
    description: String,
    context: String,
    project_path: String,
    mock_mode: bool,
) -> Result<bool, String> {
    use tauri::Emitter;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::task;

    // Pumice root = CWD when launched via `tauri dev` or the installed app dir.
    let pumice_root = std::env::current_dir()
        .map_err(|e| format!("Cannot determine working directory: {}", e))?;

    // Override env vars from the saved project config when available.
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

    // Build the subprocess command.
    // On Windows, `npx` is a `.cmd` file and must be invoked through cmd.exe.
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = tokio::process::Command::new("cmd");
        c.args([
            "/C",
            "npx",
            "tsx",
            "src/index.ts",
            &title,
            &description,
            &context,
        ]);
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

    // Stream stdout lines.
    let app1 = app_handle.clone();
    let t_out = task::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            app1.emit("task:log", TaskLog { line, level: "stdout".to_string() })
                .ok();
        }
    });

    // Stream stderr lines (skip blank lines to reduce noise).
    let app2 = app_handle.clone();
    let t_err = task::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.trim().is_empty() {
                app2.emit("task:log", TaskLog { line, level: "stderr".to_string() })
                    .ok();
            }
        }
    });

    let _ = tokio::join!(t_out, t_err);

    let status = child.wait().await.map_err(|e| e.to_string())?;
    Ok(status.success())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn config_dir(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".pumice")
}

fn config_path(project_path: &str) -> PathBuf {
    config_dir(project_path).join("project.json")
}

/// Reads `.pumice/project.json` from the *target* project and returns env-var
/// overrides to feed into the TypeScript orchestrator process.
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
        overrides.push((
            "OBSIDIAN_VAULT_DIR".to_string(),
            cfg.obsidian_vault_path.clone(),
        ));
    }

    // First agent of each role-group wins; later duplicates are skipped.
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

/// Returns `true` if `command` is available in the system PATH.
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

/// Returns `true` if the Ollama server is reachable at `base_url`.
/// Falls back to checking the `ollama` CLI if no TCP connection succeeds.
#[tauri::command]
fn check_ollama(base_url: String) -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    // Parse host:port from the base URL (e.g. "http://localhost:11434")
    let stripped = base_url
        .trim_end_matches('/')
        .trim_start_matches("https://")
        .trim_start_matches("http://");

    if let Ok(addr) = stripped.parse::<std::net::SocketAddr>() {
        if TcpStream::connect_timeout(&addr, Duration::from_secs(2)).is_ok() {
            return true;
        }
    }

    // Fallback: just check if the `ollama` binary is in PATH
    check_tool("ollama".to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_project,
            load_project_config,
            save_project_config,
            run_task,
            check_tool,
            check_ollama,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
