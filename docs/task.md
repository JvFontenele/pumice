tasks:
[x] - Pesquisa: pesquise métodos e ferramentas que já existem, e que possam fazer esse tipo de serviço
    → Resultado documentado em: docs/research.md
    → Alinhamento registrado em: docs/brainstorming.md
    → Frameworks analisados: LangGraph, CrewAI, AutoGen
    → Integrações Obsidian analisadas: MCP, knowledge-base-server, Slatekore

[x] - Definir arquitetura: escolher framework base e estratégia de integração com Obsidian
    → Decisão: core próprio em Node.js/TypeScript — evita dependência de Python e mantém operação local
    → UI em React/Vite + shell Tauri para desktop nativo
    → Adapters por provider (`native` e `ollama`) em vez de framework monolítico
    → Obsidian via filesystem no MVP; MCP fica como evolução futura

[x] - Criar estrutura de memória: pastas memory/ e decisions/ no vault
    → Vault inicial criado em `obsidian-vault/` com estrutura de notas base
    → Configuração por projeto em `.pumice/project.json`

[x] - Protótipo mínimo: agente que lê e escreve no vault via MCP ou filesystem
    → Core de orquestração implementado em `src/`
    → Adapters para Claude, Codex, Gemini e Ollama funcionando
    → Notas gravadas no vault local via filesystem após cada run

[x] - Interface de gerenciamento: tela para selecionar projeto e configurar squad
    → UI React com 3 telas: Setup, Squad, Execute
    → Inspeção de repositório, edição de agentes, save/load de configuração
    → Bridge Tauri com `run_task` pronto para disparar o orquestrador

[] - Conectar botão "Run Squad" ao orquestrador real
    → Backend `run_task` em `src-tauri/src/main.rs` já implementado
    → Bridge `runTask` + `onTaskLog` em `app/src/lib/tauri.ts` já exposto
    → Falta: chamar `runTask` no clique do botão e exibir logs na tela Execute

[] - Implementar histórico e logs de runs
    → Persistir saídas por execução com timestamp
    → Exibir histórico de runs na UI

[] - Paralelismo e worktrees Git por agente
    → Execução paralela de subtarefas independentes
    → Branch/worktree isolado por agente durante a execução

[] - Evoluir integração com Obsidian
    → Estrutura `decisions/`, `runs/`, `agents/` com convenção definida
    → MCP como opção de integração
