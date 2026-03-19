Minha ideia para esse aplicativo/extensão/skill é a seguinte:
Existem múltiplos agentes de IA trabalhando neste repositório, quero um jeito de orquestrar tudo e gerenciar meu projeto.
Quero usar o Obsidian, aplicativo que tenho instalado no meu PC, para criar uma memória do que cada agente fez. 

## Direção Atual do Projeto

O Pumice deixou de ser apenas uma ideia conceitual e agora está sendo implementado como um aplicativo desktop para gerenciar um time de agentes.

Arquitetura atual:

- `src/` → core do orquestrador em Node.js/TypeScript
- `app/` → interface React/Vite para abrir projeto, montar squad e salvar configuração
- `src-tauri/` → shell desktop Tauri
- `obsidian-vault/` → memória inicial do projeto
- `.pumice/project.json` → configuração persistida do squad por repositório

Modelo operacional atual:

- abrir uma pasta/repositório local
- inspecionar o projeto (`.git`, `package.json`, `docs`, vault)
- definir agentes com papel, provider, modelo, comando e objetivo
- salvar essa configuração no próprio projeto
- usar Obsidian como memória compartilhada do time

Providers de agentes suportados no MVP:

- `native`
- `ollama`

Integrações já previstas na implementação:

- Claude Code via Ollama
- Codex com modo OSS via Ollama
- agente local genérico via `ollama run` para fluxos de QA/docs

Regras principais para os agente:
- O alinhamento inicial de pesquisa, organização e desenvolvimento deve acontecer com uma conversa, no arquivo brainstorming.md. Você não é o único agente, então se identifique.
- Aliem entre vocês quem vai executar cada ação para não ter repetições de tarefas.
- As tarefas estão disponíveis em task.md, só marquem a tarefa concluída com o consenso de todos os agentes.

---

## Documentos do Projeto

- [brainstorming.md](brainstorming.md) → Alinhamento e comunicação entre agentes
- [task.md](task.md) → Lista de tarefas do projeto
- [research.md](research.md) → Pesquisa de ferramentas e métodos existentes
- [memory/](memory/) → Registros detalhados por agente ou contexto
