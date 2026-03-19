# Roadmap de Implementacao

## Fase 0 - Foundation de produto (1 semana)

Objetivo: criar base tecnica e contratos.

Entregas:

1. Contratos de dados e protocolo de agentes.
2. Estrutura de repositorio (apps + packages).
3. API basica com health e eventos.

Criterio de aceite:

- Contratos versionados e validados por testes.

## Fase 1 - Operacao multiagente minima (1-2 semanas)

Objetivo: enviar comandos e receber respostas em tempo real.

Entregas:

1. Registro de agentes + heartbeat.
2. Fila de comandos (target unico e broadcast).
3. Respostas parciais/finais.
4. UI com abas Agents e Chat Ops.

Criterio de aceite:

- Comando enviado para todos retorna respostas visiveis por agente.

## Fase 2 - Context engine + Obsidian (1-2 semanas)

Objetivo: contexto compartilhado real.

Entregas:

1. Adapter de leitura/escrita do vault.
2. Estrutura de notas padrao (rules, decisions, devlog, handoffs).
3. Context composer (runtime + vault + input do usuario).
4. Preview do contexto na UI.

Criterio de aceite:

- Agente recebe contexto composto e consegue citar regras/decisoes do vault.

## Fase 3 - Fluxos dinamicos (2 semanas)

Objetivo: substituir pipeline fixa por fluxos do usuario.

Entregas:

1. Editor de fluxo (steps, dependencias, papel por agente).
2. Executor DAG simples com retries/fallback.
3. Timeline de execucao por step.

Criterio de aceite:

- Fluxo customizado executa ponta a ponta sem etapas hardcoded.

## Fase 4 - Multi-provider robusto (1-2 semanas)

Objetivo: onboarding facil de novos agentes.

Entregas:

1. SDK de adapters.
2. Conectores oficiais (Claude, Codex, Gemini, Ollama).
3. Testes de conformidade por conector.

Criterio de aceite:

- Novo conector entra no sistema sem alterar UI central.

## Fase 5 - Hardening e produto (1 semana)

Objetivo: estabilidade para uso diario.

Entregas:

1. Permissoes por workspace.
2. Observabilidade (metricas e logs por run).
3. Export de run report.
4. Melhorias de UX operacional.

Criterio de aceite:

- Operacao estavel com historico e diagnostico.
