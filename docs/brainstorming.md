# 🧠 Brainstorming — Pumice

> Arquivo de alinhamento entre agentes. Antes de qualquer execução, leia todo o histórico e se identifique.

---

## 📅 2026-03-18 — Alinhamento Inicial

### 🤖 Agent-Research

**Papel:** Pesquisa e documentação do estado da arte
**Tarefa assumida:** `task.md → Pesquisa: métodos e ferramentas existentes`

---

#### 📌 Contexto

Lendo o `IDEA.md`, entendo que o objetivo do Pumice é criar um sistema de orquestração de múltiplos agentes de IA com memória persistente via Obsidian. A proposta é elegante: usar arquivos Markdown como protocolo de comunicação e base de conhecimento compartilhada.

Antes de qualquer execução técnica, conduzi pesquisa ampla sobre o estado da arte. Principais achados a seguir.

---

#### 🔎 Achados da Pesquisa

##### 1. Frameworks de Orquestração de Agentes

O ecossistema está maduro. Existem três protagonistas principais:

| Framework | Abordagem | Ponto Forte | Fit com Pumice |
|-----------|-----------|-------------|----------------|
| **LangGraph** | Grafo de estados (nodes/edges) | Controle preciso do fluxo, stateful | ⭐⭐⭐⭐ — ideal para workflows complexos |
| **CrewAI** | Agentes com papéis (roles) | Colaboração role-based, memória integrada | ⭐⭐⭐⭐⭐ — alinha diretamente com a visão do Pumice |
| **AutoGen** (Microsoft) | Conversação entre agentes | Flexível, code execution, human-in-loop | ⭐⭐⭐ — ótimo para prototipagem |

**CrewAI** é o mais alinhado com a proposta: tem papéis definidos, gerenciamento de memória (short-term, long-term, entity), e é orientado a equipes colaborativas.

**LangGraph** é o mais robusto para produção quando precisamos de controle granular de estado.

##### 2. Obsidian como Memória de Agentes

Há momentum real nesta direção. Integrações existentes:

- **Model Context Protocol (MCP)** — Padrão aberto da Anthropic (nov/2024), adotado por OpenAI e Google DeepMind. Permite que agentes de IA leiam/escrevam notas no Obsidian diretamente. Existem servidores MCP específicos para Obsidian.
- **Slatekore** — Kit open-source que usa vault do Obsidian como memória de agentes Gemini CLI
- **knowledge-base-server** — Ingere o vault inteiro num SQLite com FTS5 e expõe via MCP para múltiplos agentes (Claude, Codex, Gemini)
- **OpenClaw** — Agente self-hosted que escreve notas no vault em tempo real
- **Smart Connections** (plugin Obsidian) — Busca semântica de notas via embeddings

##### 3. Padrões Relevantes Observados

- A integração via **MCP + Obsidian CLI** é o caminho mais adotado pela comunidade em 2025
- Arquivos Markdown como protocolo de comunicação é uma abordagem provada
- A separação entre **memória de curto prazo** (contexto da sessão) e **longo prazo** (vault) é crucial
- Sistemas como **knowledge-base-server** mostram que é viável ter múltiplos agentes diferentes compartilhando a mesma base de conhecimento

---

#### 💡 Proposta Inicial (Visão Arquitetural)

Com base na pesquisa, proponho a seguinte arquitetura para o Pumice:

```
Pumice Architecture
│
├── Camada de Agentes (Orquestração)
│   ├── CrewAI ou LangGraph como motor de orquestração
│   ├── Agentes com papéis bem definidos (Research, Dev, Review, etc.)
│   └── Comunicação via mensagens (arquivos Markdown)
│
├── Camada de Memória (Obsidian)
│   ├── Vault = fonte de verdade
│   ├── Acesso via MCP Server (leitura/escrita de notas)
│   └── Estrutura: brainstorming.md, task.md, memory/, decisions/
│
└── Camada de Integração
    ├── MCP Server para Obsidian (protocolo padrão)
    ├── Obsidian CLI para automação
    └── API/hooks para acionar agentes a partir do vault
```

---

#### ❓ Dúvidas e Pontos a Discutir

1. **Framework base:** Preferência entre CrewAI (mais simples, role-based) vs LangGraph (mais controle, stateful)?
2. **Linguagem:** Python é padrão para CrewAI/LangGraph. Temos restrições de linguagem?
3. **MCP ou acesso direto ao filesystem?** MCP é mais robusto e padronizado, mas filesystem é mais simples para começar.
4. **Escopo MVP:** Começamos com 2–3 agentes com papéis fixos, ou já projetamos para ser extensível?

---

#### ✅ Minhas Recomendações para Próximas Tarefas

- [ ] Definir arquitetura base (framework + integração Obsidian)
- [ ] Criar estrutura de pastas para `memory/` e `decisions/`
- [ ] Prototipar um agente mínimo que lê e escreve no vault

---

*Agent-Research — 2026-03-18*

---

## 📅 2026-03-19 — Implementação Inicial

### 🤖 Agent-Builder

**Papel:** Implementação do MVP
**Tarefa assumida:** arquitetura base, protótipo inicial e interface de gerenciamento

---

#### 📌 O que foi implementado

O projeto saiu do estágio exclusivamente documental e agora possui uma base funcional:

- core em Node.js/TypeScript para orquestração
- adapters de agentes com providers `native` e `ollama`
- suporte a Claude Code com Ollama
- suporte a Codex com Ollama (`--oss`)
- escrita de notas no vault local do Obsidian via filesystem
- UI React/Vite para abrir repositório e montar o squad
- shell Tauri para encapsular a aplicação desktop
- persistência da configuração em `.pumice/project.json`

---

#### 🧱 Decisão arquitetural tomada

Ao invés de adotar CrewAI ou LangGraph no MVP, a implementação atual usa um core próprio e enxuto em TypeScript.

Razões:

1. o produto precisa antes resolver bem o problema de operação local, desktop, integração com filesystem, CLIs e Obsidian
2. a modelagem de squad, providers e persistência local é mais importante no início do que um framework de orquestração mais pesado
3. essa base mantém aberta a possibilidade de incorporar LangGraph/CrewAI depois, se ainda fizer sentido

---

#### 🖥️ Leitura atual do produto

Neste momento, o Pumice já tem o esqueleto correto do produto:

- uma tela para gerenciar agentes como um time
- um formato persistido por projeto
- um core de execução separado da interface
- uma estratégia explícita para agentes auto-hospedados via Ollama

O próximo passo natural não é mais "definir a ideia", e sim conectar a tela ao orquestrador real e executar o squad configurado.

---

#### ⚠️ Pendências práticas observadas

- a UI já configura o squad, mas ainda não dispara a execução real do time
- a integração com Obsidian ainda está em modo filesystem, não MCP
- o shell Tauri ainda apresenta ruído de ambiente no `cargo check` por lock de arquivos no Windows
- worktrees Git e paralelismo real ainda não foram implementados

---

#### ✅ Proposta de sequência

- [ ] conectar `.pumice/project.json` ao orquestrador
- [ ] adicionar botão de execução do squad na UI
- [ ] persistir run logs e saídas por agente
- [ ] criar worktrees/branches por agente
- [ ] estruturar memória em `decisions/`, `runs/` e `agents/`

---

*Agent-Builder — 2026-03-19*
