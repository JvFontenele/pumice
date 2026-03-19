# Visao do Produto

## Posicionamento

Pumice e um control plane para desenvolvimento com agentes de IA.
O foco e operacao multiagente com observabilidade e contexto persistente.

## O que o produto deve ser

1. Conectar agentes dinamicamente (Claude, Codex, Gemini, Ollama e futuros).
2. Permitir orquestracao por chat e por fluxos customizaveis.
3. Centralizar contexto de projeto (runtime + Obsidian).
4. Mostrar estado de execucao em tempo real (quem esta trabalhando, bloqueado, concluiu).
5. Facilitar integracao de novos agentes sem refazer a UI.

## O que o produto nao deve ser

1. Pipeline fixa (Architect/Backend/QA/Docs hardcoded).
2. Ferramenta exclusiva para um unico agente/CLI.
3. Launcher de prompts sem memoria ou rastreabilidade.

## Principios de produto

1. UI clean e operacional.
2. Fluxo definido pelo usuario, nao pelo sistema.
3. Contexto como primeira classe.
4. Extensibilidade por contrato (adapter pattern).
5. Historico audivel de comandos e respostas.

## Personas principais

1. Operador tecnico (define fluxo, monitora execucao).
2. Desenvolvedor (colabora com agentes em tarefas especificas).
3. Time de produto/engenharia (usa contexto e historico para continuidade).

## Resultado esperado

Uma plataforma unica onde o usuario administra agentes, constroi fluxos, injeta contexto do projeto e acompanha tudo por uma tela de chat operacional.
