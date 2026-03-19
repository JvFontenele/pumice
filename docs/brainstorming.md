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
