# Pumice

Pumice is a starter kit for coordinating multiple AI coding agents as a development team, with Obsidian as shared memory.

## Stack

- Node.js + TypeScript orchestration CLI
- Claude, Codex, and Gemini command adapters
- Obsidian vault for durable notes
- Workspace folders for task outputs

## Quick start

1. Copy `.env.example` to `.env` and adjust the CLI commands if needed.
2. Run `npm install`.
3. Run `npm run dev -- "Task title" "Task description" "Optional context"`.

If you want to validate the orchestration flow before wiring all external CLIs, set `PUMICE_MOCK_RESPONSES=true` in `.env`.

## Current scope

This first version creates a sequential plan, dispatches each subtask to the configured agent CLI, writes task definitions to `workspace/tasks`, writes outputs to `workspace/outputs`, and stores a summary note in `obsidian-vault`.
