# Backlog Executavel

## Epic 1 - Control Plane

### Tarefas

1. Definir schemas (`Agent`, `Command`, `Response`, `Flow`, `Run`, `ContextBlock`).
2. Implementar endpoints de registro, pull de comandos e post de respostas.
3. Implementar WebSocket de eventos.
4. Persistir estado em SQLite.

### Criterios de aceite

1. Agente registra e aparece online.
2. Comando muda estados: queued -> delivered -> processing -> completed.
3. UI recebe eventos em tempo real.

## Epic 2 - Agent Runtime + Adapters

### Tarefas

1. Criar `agent-sdk` com contrato unico.
2. Implementar adapters iniciais:
   - Claude CLI
   - Codex CLI
   - Gemini CLI
   - Ollama generic
3. Adicionar timeout/cancelamento por comando.

### Criterios de aceite

1. Mesmo contrato funciona para todos adapters.
2. Falha em adapter nao derruba o control plane.

## Epic 3 - Context Engine

### Tarefas

1. Implementar leitura indexada do Obsidian vault.
2. Implementar `context composer` com prioridade por fonte.
3. Adicionar resumo automatico quando contexto exceder limite.
4. Salvar handoff/resumo de cada comando no vault.

### Criterios de aceite

1. Contexto final e reprodutivel para o mesmo run.
2. Handoff e devlog sao persistidos no vault.

## Epic 4 - UI Operacional

### Tarefas

1. Tela `Agents` com status, heartbeat e capacidade.
2. Tela `Flows` com editor de etapas e dependencias.
3. Tela `Context` com fontes e preview final.
4. Tela `Chat Ops` com comando individual/global.
5. Timeline de atividade por agente.

### Criterios de aceite

1. Operador controla execucao sem terminal.
2. Estado de cada agente e visivel em tempo real.

## Epic 5 - Flow Engine

### Tarefas

1. Implementar executor DAG simples.
2. Regras de dependencias, retry e fallback.
3. Politicas por fluxo (serial, paralelo, misto).

### Criterios de aceite

1. Fluxo customizado executa com dependencias corretas.
2. Falhas sao rastreadas com motivo e agente responsavel.

## Epic 6 - Qualidade e Operacao

### Tarefas

1. Testes de contrato (adapter conformance).
2. Testes de integracao ponta a ponta.
3. Logs estruturados + metricas basicas.
4. Relatorio de run exportavel.

### Criterios de aceite

1. Build e testes em CI.
2. Diagnostico de falhas por run/agent/command.

## Ordem recomendada de execucao

1. Epic 1
2. Epic 2
3. Epic 3
4. Epic 4
5. Epic 5
6. Epic 6
