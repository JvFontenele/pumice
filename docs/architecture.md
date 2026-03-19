# Arquitetura Alvo

## Visao geral

A arquitetura e dividida em 4 planos:

1. Control Plane
2. Agent Runtime Plane
3. Context Plane
4. UI Plane

## 1. Control Plane

Responsabilidades:

- Registro de agentes e heartbeat
- Fila de comandos (individual, broadcast, grupos)
- Execucao de fluxos com dependencias (DAG simples)
- Exposicao de API HTTP + WebSocket para a UI
- Persistencia operacional (runs, eventos, estado)

Componentes:

- `orchestrator-service`
- `command-service`
- `flow-engine`
- `event-stream`

## 2. Agent Runtime Plane

Responsabilidades:

- Conectar provedores/CLIs diferentes com contrato unico
- Receber comando, executar, enviar resposta parcial/final
- Reportar status (idle, working, error)

Contrato minimo do adapter:

1. `register_agent`
2. `heartbeat`
3. `pull_commands`
4. `post_response`
5. `update_status`

## 3. Context Plane

Responsabilidades:

- Compor contexto para cada comando
- Unir memoria de runtime com memoria persistente do projeto
- Controlar tamanho/prioridade do contexto enviado aos agentes

Fontes de contexto:

1. Runtime store (respostas anteriores, estado do run)
2. Obsidian vault (regras, decisoes, devlog, handoff)
3. Input manual do operador (chat/context blocks)

## 4. UI Plane

Modulos:

1. Agents
2. Flows
3. Context
4. Chat Ops
5. Timeline/Observability

Estados exibidos:

- agente conectado/desconectado
- agente executando/parado/com erro
- comandos pendentes/em execucao/concluidos
- respostas parciais e finais

## Modelo de dados base

1. `Agent`: id, name, provider, capabilities, status, lastSeen
2. `Flow`: id, name, goal, steps, dependencies, policy
3. `Run`: id, flowId, status, startedAt, finishedAt
4. `Command`: id, runId, target, payload, status
5. `Response`: id, commandId, agentId, output, artifacts
6. `ContextBlock`: id, source, title, content, tags
7. `ProjectProfile`: repoPath, vaultPath, rules, settings

## Stack recomendada

1. Backend: Node.js + TypeScript + Fastify + WebSocket
2. Persistencia MVP: SQLite
3. Cache/fila opcional: Redis
4. UI: React + TanStack Query + Zustand
5. Desktop shell: Tauri (opcional na fase inicial)

## Seguranca e confiabilidade

1. Escopo de acesso por projeto (repo/vault)
2. Timeout e cancelamento por comando
3. Retry com backoff para agentes desconectados
4. Logs estruturados por run/agent/command
