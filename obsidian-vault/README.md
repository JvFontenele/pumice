# Pumice Obsidian Vault

This vault is the persistent context layer for agent teams.

## Why it exists

The MCP hub provides live context during execution.
Obsidian provides durable context across sessions and across different agents.

## Use this vault for

- Project mission and scope
- Rules and constraints
- Architecture decisions (ADR-style)
- Development timeline and rationale
- Agent handoff notes

## Minimal structure

```text
obsidian-vault/
  00-project/
  01-rules/
  02-decisions/
  03-devlog/
  04-handoffs/
```

## Rule of thumb

If a new agent could not continue the work without asking for old context, that context must be written here.
