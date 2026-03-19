# Pumice - Execution Checklist Semanal

Checklist operacional para executar o roadmap em ciclos semanais, com foco em entrega incremental e criterios claros de conclusao.

## Status atual

1. `S0 - Foundation`: concluida com gate `PASS`
2. `S2 - Context Engine + Obsidian`: entregue
3. `S3 - Fluxos Dinamicos`: entregue no backend
4. `S4 - Multi-provider Robusto`: entregue no backend/adapters
5. `S1 - Operacao Multiagente Minima`: parcial, com UI operacional ainda pendente
6. Proxima sprint recomendada: `S5 - Hardening e Produto`

## Como usar

1. Cada semana tem um objetivo principal e uma lista de entregas verificaveis.
2. Marque os itens conforme concluir.
3. Nao avance de semana sem cumprir os gates obrigatorios.
4. Use os skills recomendados para cada bloco de trabalho.

## Semana 1 - Foundation (Sprint 0)

### Skills recomendados

`project-planner`, `coding-standards`

### Planejamento e contrato

- [ ] Definir escopo tecnico da semana (fora/in).
- [ ] Definir modelos de dados: `Agent`, `Flow`, `Run`, `Command`, `Response`, `ContextBlock`, `ProjectProfile`.
- [ ] Versionar contratos iniciais (ex.: `v0`).
- [ ] Documentar o contrato minimo de adapter:
  - `register_agent`
  - `heartbeat`
  - `pull_commands`
  - `post_response`
  - `update_status`

### Estrutura de repositorio

- [ ] Criar estrutura `apps/` e `packages/`.
- [ ] Separar claramente backend, frontend e pacotes compartilhados.
- [ ] Configurar scripts padrao de build/test/lint.

### API base

- [ ] Implementar endpoint de health.
- [ ] Implementar stream/event bus inicial.
- [ ] Garantir boot local com comando unico.

### Qualidade

- [ ] Criar testes de contrato dos schemas.
- [ ] Validar erros esperados para payload invalido.
- [ ] Definir padrao minimo de logs.

### Gate de encerramento

- [ ] Contratos validados por testes automatizados.
- [ ] Estrutura pronta para Sprint 1 sem refactor estrutural.

## Semana 2 - Operacao Multiagente Minima (Sprint 1)

### Skills recomendados

`coding-standards`, `frontend-patterns`, `webapp-testing`, `playwright`

### Runtime e comandos

- [ ] Implementar registro de agente com persistencia de status.
- [ ] Implementar heartbeat com atualizacao de `lastSeen`.
- [ ] Implementar fila de comandos para target unico.
- [ ] Implementar broadcast para multiplos agentes.
- [ ] Implementar transicoes:
  - `queued`
  - `delivered`
  - `processing`
  - `completed`
- [ ] Implementar timeout/cancelamento basico por comando.

### Respostas e eventos

- [ ] Suportar resposta parcial (streaming/log incremental).
- [ ] Suportar resposta final por comando/agente.
- [ ] Publicar eventos de status em tempo real para UI.

### UI operacional inicial

- [ ] Criar tela `Agents` (status, heartbeat, capabilities).
- [ ] Criar tela `Chat Ops` (envio individual/global).
- [ ] Exibir status de comando em tempo real.

### Testes

- [ ] Teste de integracao do ciclo comando -> resposta.
- [ ] Teste E2E de broadcast com 2+ agentes simulados.
- [ ] Teste de regressao da atualizacao de estado na UI.

### Gate de encerramento

- [ ] Broadcast funcional com respostas visiveis por agente.
- [ ] Estados consistentes do backend ate a UI.

## Semana 3 - Context Engine + Obsidian (Sprint 2)

### Skills recomendados

`obsidian-cli`, `obsidian-markdown`, `coding-standards`

### Integracao com vault

- [x] Configurar `vaultPath` por projeto.
- [x] Implementar indexacao de notas relevantes.
- [x] Criar estrutura padrao no vault:
  - `00-project/`
  - `01-rules/`
  - `02-decisions/`
  - `03-devlog/`
  - `04-handoffs/`

### Context composer

- [x] Implementar merge de contexto por prioridade:
  - runtime
  - vault
  - input manual
- [x] Implementar controle de tamanho de contexto.
- [x] Implementar sumarizacao automatica ao exceder limite.
- [x] Garantir reproducibilidade do contexto para o mesmo run.

### Persistencia de memoria

- [x] Salvar handoff apos cada resposta final.
- [x] Salvar devlog com resumo acionavel por comando.
- [ ] Incluir referencias cruzadas para decisoes relevantes.

### UI de contexto

- [x] Exibir fontes de contexto utilizadas.
- [x] Exibir preview do contexto final antes do envio ao agente.

### Testes

- [x] Teste de reproducibilidade do contexto.
- [x] Teste de qualidade de handoff (conteudo minimo obrigatorio).
- [x] Teste de leitura de regras/decisoes pelo agente.

### Gate de encerramento

- [x] Agente recebe contexto composto e cita regras/decisoes corretas.
- [x] Handoff/devlog persistidos automaticamente no vault.

Resultado registrado:

1. `indexVault` entregue com leitura recursiva de `.md`, tags de frontmatter YAML e reindexacao idempotente.
2. `composeContext` entregue com prioridade `manual > vault > runtime` e truncamento por orcamento de tokens.
3. `writeHandoff` entregue em `vault/04-handoffs/<timestamp>.md`.
4. `appendDevlog` entregue em `vault/03-devlog/<YYYY-MM-DD>.md`.
5. API `/context/*` entregue.
6. `ContextPage` entregue com `vaultPath`, indexacao, blocos manuais, agrupamento e preview.

## Semana 4 - Fluxos Dinamicos (Sprint 3)

### Skills recomendados

`project-planner`, `task-coordination-strategies`, `frontend-patterns`, `team-composition-patterns`

### Modelagem de fluxo

- [x] Definir schema de step/dependencia/politica por fluxo.
- [x] Definir politicas de execucao: serial, paralelo, misto.
- [x] Definir regras de retry e fallback por step.

### Executor DAG

- [x] Implementar executor DAG simples.
- [x] Implementar bloqueio de steps por dependencia nao concluida.
- [x] Implementar rastreio de erro por step/agente.

### UI de fluxo

- [ ] Criar editor de fluxo (steps, dependencias, papeis).
- [ ] Permitir salvar/editar/duplicar fluxo.
- [x] Exibir timeline por step em execucao.

### Testes

- [x] Teste de execucao ponta a ponta com dependencias.
- [x] Teste de retry/fallback em falha de step.
- [x] Teste de consistencia de timeline.

### Gate de encerramento

- [x] Fluxo customizado executa sem etapas hardcoded.
- [x] Falhas rastreadas com causa e responsavel.

Resultado registrado:

1. `run_steps` table entregue.
2. `advanceDag()` entregue.
3. `POST /flows/:id/runs` entregue.
4. `GET /runs/:id` entregue.
5. Suite reportada no fechamento: `52` testes.

## Semana 5 - Multi-provider Robusto (Sprint 4)

### Skills recomendados

`mcp-server-patterns`, `mcp-builder`, `coding-standards`

### SDK e adapters

- [x] Consolidar `agent-sdk` com contrato unico.
- [x] Implementar adapter Claude CLI.
- [x] Implementar adapter Codex CLI.
- [x] Implementar adapter Gemini CLI.
- [x] Implementar adapter Ollama generico.

### Confiabilidade

- [x] Implementar timeout por comando.
- [x] Implementar cancelamento por comando.
- [x] Implementar retry com backoff para desconexao.
- [x] Garantir isolamento: erro em adapter nao derruba control plane.

### Conformance

- [x] Criar suite de testes de conformidade de adapter.
- [x] Rodar mesma suite para todos os conectores.
- [ ] Publicar relatorio de conformidade por provider.

### Gate de encerramento

- [x] Novo adapter entra sem alterar UI central.
- [x] Todos os adapters passam nos testes de contrato.

Resultado registrado:

1. `HttpAdapter` entregue.
2. `BaseAgentRunner` entregue.
3. `withTimeout` e `withRetry` entregues.
4. Runners `Claude`, `Codex`, `Gemini` e `Ollama` entregues.
5. `conformance.test.ts` com `15` testes reportados.

## Semana 6 - Hardening e Produto (Sprint 5)

### Skills recomendados

`webapp-testing`, `playwright`, `team-communication-protocols`, `internal-comms`

### Seguranca e operacao

- [ ] Implementar permissao por workspace (repo/vault).
- [ ] Definir matriz de acesso minima por perfil.
- [ ] Implementar auditoria de comandos por run.

### Observabilidade

- [ ] Adicionar logs estruturados por `runId`, `agentId`, `commandId`.
- [ ] Adicionar metricas basicas (latencia, erros, throughput).
- [ ] Criar painel operacional minimo.

### Relatorio e UX

- [ ] Implementar export de run report.
- [ ] Melhorar UX de diagnostico de falhas.
- [ ] Melhorar UX de timeline/estado de agente.

### Qualidade final

- [ ] Rodar regressao E2E completa.
- [ ] Executar teste de carga leve com multiplos agentes.
- [ ] Criar runbook de incidentes e recuperacao.
- [ ] Criar checklist de release.

### Gate de encerramento

- [ ] Operacao estavel para uso diario.
- [ ] Diagnostico de falhas em minutos (nao horas).

## Checklist transversal (toda semana)

### Engenharia

- [ ] PRs pequenas e rastreaveis.
- [ ] Testes atualizados junto com mudancas.
- [ ] Sem regressao conhecida aberta sem plano.

### Produto

- [ ] Criterios de aceite revisados antes de iniciar.
- [ ] Demo interna no fim da semana.
- [ ] Backlog atualizado com proximos riscos.

### Contexto/Obsidian

- [ ] Decisoes tecnicas registradas em `02-decisions/`.
- [ ] Handoffs objetivos em `04-handoffs/`.
- [ ] Devlog semanal em `03-devlog/`.

## Prioridade de skills (resumo rapido)

### Core (uso frequente)

1. `coding-standards`
2. `project-planner`
3. `frontend-patterns`
4. `obsidian-cli`
5. `obsidian-markdown`
6. `webapp-testing`
7. `playwright`

### Expansao (quando entrar na fase)

1. `task-coordination-strategies`
2. `team-composition-patterns`
3. `team-communication-protocols`
4. `mcp-server-patterns`
5. `mcp-builder`
6. `frontend-design`
7. `shadcn`
