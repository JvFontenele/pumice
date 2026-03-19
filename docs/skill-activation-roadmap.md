# Roteiro de Ativacao de Skills - Pumice

Este documento define quando ativar cada skill e o que deve ser feito em cada sprint para acelerar a entrega do Pumice com qualidade tecnica.

## Como usar este roteiro

1. Antes de iniciar uma tarefa, identifique em qual sprint/epic ela se encaixa.
2. Ative primeiro os skills obrigatorios da sprint.
3. Use os skills de apoio apenas se houver necessidade real (UI refinada, testes extras, comunicacao).
4. Considere cada checklist de "Definition of Done" como criterio minimo para encerrar a sprint.

## Sprint 0 - Foundation

### Objetivo

Criar base tecnica: contratos, estrutura do repositorio e API inicial.

### Skills principais

1. `project-planner`
2. `coding-standards`

### O que deve ser feito

1. Definir schemas iniciais:
   - `Agent`, `Flow`, `Run`, `Command`, `Response`, `ContextBlock`, `ProjectProfile`.
2. Definir contrato de adapter:
   - `register_agent`, `heartbeat`, `pull_commands`, `post_response`, `update_status`.
3. Estruturar repositorio:
   - `apps/` (backend, frontend) e `packages/` (schemas, sdk, utils).
4. Subir API minima:
   - endpoint de health e stream de eventos.
5. Escrever testes de contrato para schemas e validacoes.

### Definition of Done

1. Contratos versionados e testados.
2. Estrutura de repositorio pronta para escalar.
3. API basica respondendo com estabilidade.

## Sprint 1 - Operacao Multiagente Minima

### Objetivo

Enviar comandos para agentes e receber respostas em tempo real.

### Skills principais

1. `coding-standards`
2. `frontend-patterns`
3. `webapp-testing`

### Skills de apoio

1. `playwright` (validacao E2E de fluxo critico)

### O que deve ser feito

1. Implementar registro de agentes e heartbeat.
2. Implementar fila de comandos:
   - target unico
   - broadcast
3. Implementar transicao de status:
   - `queued -> delivered -> processing -> completed`.
4. Implementar respostas parciais e finais por comando.
5. Criar telas iniciais:
   - `Agents`
   - `Chat Ops`
6. Garantir atualizacao em tempo real via WebSocket.
7. Criar testes de integracao para ciclo completo comando/resposta.

### Definition of Done

1. Broadcast retorna respostas visiveis por agente.
2. Estados de comando aparecem corretamente na UI.
3. Sem quebra de fluxo com mais de um agente conectado.

## Sprint 2 - Context Engine + Obsidian

### Objetivo

Compor contexto compartilhado com memoria runtime e vault Obsidian.

### Skills principais

1. `obsidian-cli`
2. `obsidian-markdown`
3. `coding-standards`

### O que deve ser feito

1. Implementar leitura/indexacao do vault.
2. Padronizar estrutura de notas:
   - `00-project/`, `01-rules/`, `02-decisions/`, `03-devlog/`, `04-handoffs/`.
3. Implementar `context composer` com prioridade por fonte:
   - runtime
   - vault
   - input manual do operador
4. Implementar resumo automatico quando contexto ultrapassar limite.
5. Persistir handoff e devlog apos cada resposta de agente.
6. Criar preview do contexto final na UI.

### Definition of Done

1. Contexto final reproduzivel no mesmo run.
2. Agente consegue citar regras e decisoes do vault.
3. Handoffs/devlogs salvos automaticamente.

## Sprint 3 - Fluxos Dinamicos

### Objetivo

Substituir pipeline fixa por fluxos definidos pelo usuario.

### Skills principais

1. `project-planner`
2. `task-coordination-strategies`
3. `frontend-patterns`

### Skills de apoio

1. `team-composition-patterns`
2. `team-communication-protocols`

### O que deve ser feito

1. Modelar fluxo com steps, papeis e dependencias.
2. Implementar executor DAG simples.
3. Implementar politicas de execucao:
   - serial
   - paralelo
   - misto
4. Implementar retry e fallback por step.
5. Criar editor de fluxo na UI.
6. Criar timeline por execucao de step/agente.

### Definition of Done

1. Fluxo customizado executa ponta a ponta sem hardcode.
2. Falhas ficam rastreaveis por step e agente responsavel.
3. Operador consegue ajustar fluxo sem alterar codigo backend.

## Sprint 4 - Multi-provider Robusto

### Objetivo

Adicionar novos conectores sem alterar o nucleo do produto.

### Skills principais

1. `mcp-server-patterns`
2. `mcp-builder`
3. `coding-standards`

### O que deve ser feito

1. Consolidar SDK de adapters com contrato unico.
2. Implementar conectores oficiais:
   - Claude CLI
   - Codex CLI
   - Gemini CLI
   - Ollama
3. Criar suite de conformance para adapters.
4. Garantir timeout e cancelamento por comando.
5. Garantir isolamento de falhas:
   - erro em adapter nao derruba control plane.

### Definition of Done

1. Novo conector entra sem mexer na UI central.
2. Todos os adapters passam no teste de contrato.
3. Falhas sao contidas no adapter com retry/backoff.

## Sprint 5 - Hardening e Produto

### Objetivo

Estabilidade para uso diario e diagnostico confiavel.

### Skills principais

1. `webapp-testing`
2. `playwright`
3. `team-communication-protocols`

### Skills de apoio

1. `internal-comms` (status updates e reportes internos)
2. `doc-coauthoring` (docs de operacao e runbooks)

### O que deve ser feito

1. Implementar permissao por workspace.
2. Implementar observabilidade:
   - metricas por run/agente/comando
   - logs estruturados
3. Implementar export de run report.
4. Rodar regressao E2E dos fluxos criticos.
5. Criar runbook operacional:
   - incidentes comuns
   - procedimentos de recuperacao
   - checklist de release

### Definition of Done

1. Operacao estavel em uso continuo.
2. Diagnostico de falha rapido por run/agente/comando.
3. Relatorio exportavel pronto para auditoria.

## Matriz rapida de ativacao por tipo de tarefa

1. Planejamento de sprint/epic: `project-planner`
2. Implementacao backend/frontend geral: `coding-standards`
3. UI funcional React/estado/queries: `frontend-patterns`
4. UI com foco visual: `frontend-design` + `shadcn`
5. Fluxo e dependencias entre agentes: `task-coordination-strategies`
6. Integracao Obsidian: `obsidian-cli` + `obsidian-markdown`
7. Testes de interface e fluxo real: `webapp-testing` + `playwright`
8. Conectores e padrao MCP: `mcp-server-patterns` + `mcp-builder`

## Skills menos prioritarios para o momento

1. `docx`
2. `pptx`
3. `pdf`
4. `xlsx`
5. `algorithmic-art`
6. `canvas-design`
7. `theme-factory`
8. `brand-guidelines`
9. `slack-gif-creator`
10. `web-artifacts-builder`
11. `json-canvas`
12. `obsidian-bases`

Estes podem ser ativados pontualmente, mas nao estao no caminho critico do produto neste momento.
