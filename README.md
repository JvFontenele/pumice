# Pumice

Pumice is a **TMUX + Agent Teams** desktop orchestrator.
It keeps multiple AI agents connected, coordinated, and observable in one clean UI.

## Product Direction

Pumice is no longer a fixed Architect/Backend/QA/Docs pipeline.

The target product is:

- Dynamic agent teams (Claude-first, but not Claude-only)
- Live orchestration via chat (send command to one agent or all)
- Shared context via MCP hub
- Project memory in Obsidian (rules, decisions, development notes)
- UI focused on administration, visibility, and control

## Core Experience

1. User selects a repository and an Obsidian vault.
2. Agents connect/register to the hub.
3. User creates contexts and development flows.
4. User orchestrates work in chat:
   - send command to a specific agent
   - broadcast command to all agents
5. UI shows:
   - connected agents
   - who is working now
   - command/response timeline

## Architecture (Current Direction)

- `src/`: orchestration core, providers, MCP hub, CLI/runtime
- `app/`: React UI (Studio) for agents, flows, context, and chat ops
- `src-tauri/`: desktop shell and native integrations
- `obsidian-vault/`: durable knowledge base for project context

## Agent Model Strategy

Pumice supports multiple providers/CLIs. Claude is a primary path, but not exclusive.

Supported direction:

- Claude CLI
- Codex CLI
- Gemini CLI
- Local/self-hosted engines (e.g. Ollama)
- Future providers via adapter pattern

## Obsidian as Source of Context

Obsidian vault is the long-term memory for:

- project rules and constraints
- architectural decisions
- implementation rationale
- handoff notes between agents

Recommended vault structure is documented in:

- [obsidian-vault/README.md](obsidian-vault/README.md)
- [docs/memory/README.md](docs/memory/README.md)

## Easy Integration (Quick Start)

1. Install dependencies:
   - `npm install`
2. Configure environment:
   - copy `.env.example` to `.env`
3. Start UI:
   - `npm run app:dev`
4. Start desktop shell:
   - `npm run desktop:dev`

Optional mock mode (without external CLIs):

- `PUMICE_MOCK_RESPONSES=true`

## Environment Flags

- `PUMICE_HUB=true|false`: enables shared MCP hub
- `PUMICE_HUB_PORT=47821`: hub port
- `PUMICE_PROJECT_DIR=<path>`: selected project path for agent execution

## Design Principles

- Keep UI clean and operator-focused.
- Prefer dynamic flows over hard-coded pipelines.
- Treat context as first-class (Obsidian + MCP).
- Make new agent integration low-friction.
- Expose operational state clearly (connected, busy, responding).

## Documentation Index

- [Product direction](docs/product-direction.md)
- [Integration quickstart](docs/integration-quickstart.md)
- [Memory guide](docs/memory/README.md)
