# Current State — Pumice

> Snapshot do estado atual do projeto em 2026-03-19.

---

## O que existe hoje

### 1. Core de orquestração (`src/`)

- planeja 4 subtarefas sequenciais: `architect → backend → qa → docs`
- despacha cada subtarefa para o agente correto por papel
- executa adapters de agentes (Claude, Codex, Gemini, Ollama)
- persiste definições de tarefas em `workspace/tasks/`
- persiste saídas em `workspace/outputs/`
- grava nota de resumo no vault do Obsidian
- modo mock via `PUMICE_MOCK_RESPONSES=true`
- ferramenta de diagnóstico `npm run doctor`

### 2. Providers de agentes

Suporte a dois modes de provider por agente:

- `native` — executa o CLI diretamente
- `ollama` — roteia para modelo local

Casos cobertos:

- Claude Code via API compatível com Anthropic do Ollama
- Codex com `--oss` para modelos `gpt-oss`
- agente genérico via `ollama run <model>`

### 3. Interface de gerenciamento (`app/`)

UI React/Vite com três telas:

**Setup** — seleção e inspeção do repositório alvo:
- abre pasta local via diálogo nativo
- detecta Git, `package.json`, `docs/` e vault Obsidian

**Squad** — configuração do time:
- adiciona, edita e remove agentes
- configura papel, provider, modelo, comando e goal por agente
- salva e carrega configuração em `.pumice/project.json`

**Execute** — acompanhamento de execução:
- pipeline visual: `intake → architect → backend → qa → docs`
- recebe logs em tempo real via eventos Tauri (`task:log`)

### 4. Shell desktop (`src-tauri/`)

Comandos nativos expostos ao frontend via Tauri IPC:

| Comando | Descrição |
|---|---|
| `inspect_project` | escaneia estrutura do repositório |
| `load_project_config` | lê `.pumice/project.json` |
| `save_project_config` | grava `.pumice/project.json` |
| `run_task` | spawna `npx tsx src/index.ts` e faz stream de output |

O bridge IPC (`app/src/lib/tauri.ts`) já expõe `runTask` e `onTaskLog` para o frontend.

### 5. Configuração por projeto

Cada repositório alvo armazena sua configuração em:

```
.pumice/project.json
```

Inclui: missão do time, vault path, lista de agentes com provider/modelo/comando/goal.

---

## Stack

- Node.js + TypeScript — core de orquestração
- React 19 + Vite + Tailwind CSS — interface
- Radix UI — componentes acessíveis
- Tauri 2 — shell desktop e comandos nativos
- execa — execução de subprocessos
- Obsidian (filesystem) — memória persistente

---

## O que falta

- **Botão "Run Squad"** — o backend `run_task` existe, mas o botão na tela Execute ainda não dispara a execução
- **Logs e histórico de runs** — sem persistência de histórico de execuções passadas
- **Paralelismo real** — execução ainda é sequencial
- **Worktrees Git por agente** — sem isolamento de branch por agente
- **Memória estruturada no Obsidian** — sem pastas `decisions/`, `runs/`, `agents/` com convenção definida
- **MCP para Obsidian** — integração atual é filesystem direto

---

## Blocker atual

O Rust local é `rustc 1.85.0`, mas o grafo de dependências do Tauri exige `1.88+`. O React app compila e roda normalmente via `npm run app:dev`. O shell desktop (`npm run desktop:dev`) exige atualizar o Rust antes de compilar.

---

## Próximos passos

1. conectar o botão "Run Squad" ao `runTask` do bridge Tauri
2. exibir logs por agente na tela Execute em tempo real
3. persistir histórico de runs com artefatos por execução
4. atualizar Rust para `1.88+` e validar o desktop build
