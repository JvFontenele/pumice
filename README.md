# Pumice

Pumice is a starter kit for coordinating multiple AI coding agents as a development team, with Obsidian as shared memory.

## Stack

- Node.js + TypeScript orchestration CLI
- Provider-aware Claude, Codex, and Gemini adapters
- Self-hosted execution via Ollama
- React + Vite management UI
- Tauri 2 desktop shell
- Obsidian vault for durable notes
- Workspace folders for task outputs

## Quick start

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run doctor` to verify the configured CLIs and Ollama connectivity.
4. Run `npm run dev -- "Task title" "Task description" "Optional context"` for the CLI flow.
5. Run `npm run app:dev` for the management UI in the browser.
6. Run `npm run desktop:dev` for the Tauri shell once the Rust toolchain is compatible.

If you want to validate the orchestration flow before wiring all external CLIs, set `PUMICE_MOCK_RESPONSES=true` in `.env`.

## Self-hosted with Ollama

Pumice can run agents against Ollama-backed models.

- `CLAUDE_PROVIDER=ollama` uses Claude Code against Ollama's Anthropic-compatible API.
- `CODEX_PROVIDER=ollama` runs Codex in OSS mode with a local Ollama model.
- `GEMINI_PROVIDER=ollama` uses `ollama run <model>` as a local generic agent for QA/docs style tasks.

Recommended setup:

1. Install and start Ollama locally.
2. Pull the models you want to use, for example `qwen3.5` and `gpt-oss:20b`.
3. Keep `OLLAMA_BASE_URL=http://localhost:11434` unless your Ollama server is remote.
4. For Claude Code, keep `CLAUDE_COMMAND=claude` and `CLAUDE_PROVIDER=ollama`.
5. For Codex, keep `CODEX_COMMAND=codex` and `CODEX_PROVIDER=ollama`.
6. Run `npm run doctor` before the first real task.

Claude Code path used by Pumice:

- Pumice configures `ANTHROPIC_AUTH_TOKEN=ollama`, `ANTHROPIC_API_KEY=""`, and `ANTHROPIC_BASE_URL=http://localhost:11434` when `CLAUDE_PROVIDER=ollama`.
- This follows Ollama's manual Claude Code setup and lets you keep using the `claude` CLI with a local model such as `qwen3.5`.

Codex path used by Pumice:

- Pumice adds `--oss -m <CODEX_MODEL>` when `CODEX_PROVIDER=ollama`.
- This follows Ollama's Codex integration for local `gpt-oss` models.

Reference docs:

- [Ollama Claude Code integration](https://docs.ollama.com/integrations/claude-code)
- [Ollama Codex integration](https://docs.ollama.com/integrations/codex)

## Desktop architecture

The repository is now split into three layers:

- `src/`: orchestration core and CLI flows
- `app/`: React management interface for selecting a repo and configuring the squad
- `src-tauri/`: desktop shell and native commands such as local project inspection

The first management screen already supports:

- opening a local project folder
- inspecting whether Git, docs, `package.json`, and an Obsidian vault are present
- editing mission, vault path, and agent roles/providers/models/commands/goals
- saving and loading squad configuration from `.pumice/project.json` in the selected repository
- showing the execution rail from intake to docs

## Current scope

This version creates a sequential plan, dispatches each subtask to the configured provider, writes task definitions to `workspace/tasks`, writes outputs to `workspace/outputs`, and stores a summary note in `obsidian-vault`.

## Current blocker

The React app builds successfully. The Tauri shell files are in place, but the local Rust toolchain in this machine is `rustc 1.85.0`, while the currently resolved Tauri dependency graph pulls crates that require Rust 1.88+. If you want the desktop shell compiling locally right now, the next practical step is updating Rust before running `npm run desktop:dev`.
