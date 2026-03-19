tasks:
[x] - Pesquisa: pesquise métodos e ferramentas que já existem, e que possam fazer esse tipo de serviço
    → Resultado documentado em: docs/research.md
    → Alinhamento registrado em: docs/brainstorming.md
    → Frameworks analisados: LangGraph, CrewAI, AutoGen
    → Integrações Obsidian analisadas: MCP, knowledge-base-server, Slatekore
    → Consolidada com implementação inicial do projeto

[x] - Definir arquitetura: escolher framework base e estratégia de integração com Obsidian
    → Arquitetura atual: core próprio em Node.js/TypeScript + UI React/Vite + shell Tauri
    → Integração de agentes: adapters por provider (`native` e `ollama`)
    → Integração com Obsidian no MVP: filesystem local, com caminho do vault configurável por projeto

[x] - Criar estrutura de memória: pastas memory/ e decisions/ no vault
    → Estrutura inicial criada em `obsidian-vault/`
    → Persistência por projeto criada em `.pumice/project.json`
    → Próximo refinamento: separar `decisions/` e memória operacional quando o fluxo de execução estiver conectado à UI

[x] - Protótipo mínimo: agente que lê e escreve no vault via MCP ou filesystem
    → Protótipo via filesystem implementado no core atual
    → Orquestrador grava notas no vault local
    → UI já permite configurar o caminho do vault por projeto

[] - Conectar a tela de gerenciamento ao orquestrador real para executar o squad configurado
[] - Implementar execução paralela e worktrees Git por agente
[] - Evoluir integração com Obsidian para estrutura `decisions/`, memória por agente e MCP opcional
