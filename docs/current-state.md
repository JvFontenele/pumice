# Current State — Pumice

> Snapshot do estado atual do projeto em 2026-03-19.

---

## O que existe hoje

### 1. Core de orquestração

O repositório já possui um core em Node.js/TypeScript responsável por:

- planejar subtarefas
- despachar tarefas por papel
- executar adapters de agentes
- persistir saídas em `workspace/`
- gravar notas no vault do Obsidian

### 2. Providers de agentes

O MVP já suporta configuração por provider:

- `native`
- `ollama`

Casos já cobertos:

- Claude Code via API compatível com Anthropic do Ollama
- Codex com `--oss`
- agente local genérico via `ollama run`

### 3. Interface de gerenciamento

O app React/Vite já permite:

- abrir uma pasta de projeto
- inspecionar se existe Git, `package.json`, `docs` e vault
- editar missão do time
- editar agentes
- salvar configuração do squad no próprio repositório

### 4. Persistência por projeto

Cada projeto selecionado pode armazenar sua configuração em:

```text
.pumice/project.json
```

Esse arquivo é a base atual para ligar a interface ao orquestrador.

---

## Stack atual

- Node.js + TypeScript
- React + Vite
- Tauri
- Ollama
- Obsidian

---

## O que falta

- executar o squad configurado pela UI
- logs e histórico de runs
- paralelismo real
- worktrees Git por agente
- memória mais estruturada no Obsidian
- MCP opcional para Obsidian

---

## Direção recomendada

O próximo incremento deve focar em produto, não em reescrever arquitetura:

1. botão "Run Squad"
2. integração da UI com o core do orquestrador
3. acompanhamento de estágio por agente
4. persistência de runs e artefatos
