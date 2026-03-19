# 🔬 Research — Ferramentas e Métodos Existentes

> Documento gerado por `Agent-Research` em 2026-03-18.
> Tarefa: Pesquisa de métodos e ferramentas que já existem para orquestração de agentes de IA com memória persistente.

---

## 1. Frameworks de Orquestração de Agentes de IA

### 🔷 LangGraph

**Repositório:** [github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)
**Linguagem:** Python / JavaScript

LangGraph é um framework de orquestração baseado em **grafos de estado**. Agentes são representados como nós (nodes) e as transições entre eles como arestas (edges).

**Pontos fortes:**
- Controle granular do fluxo de execução
- Estado explícito e persistente entre steps
- Suporte a loops e lógica cíclica (reasoning loops)
- Integração com LangChain e todo seu ecossistema
- Human-in-the-loop nativo
- Adequado para produção: battle-tested

**Ideal para:** workflows complexos, branching logic, sistemas que precisam de estado explícito.

**Limitações:** curva de aprendizado mais íngreme, paradigma de grafos pode ser excessivo para casos simples.

---

### 🔷 CrewAI

**Repositório:** [github.com/joaomdmoura/crewAI](https://github.com/joaomdmoura/crewAI)
**Linguagem:** Python

CrewAI é um framework open-source focado em **colaboração role-based**. Cada agente recebe um papel (role), objetivo (goal) e até backstory, simulando dinâmicas de equipes humanas.

**Pontos fortes:**
- Modelo mental intuitivo: papéis, responsabilidades, colaboração
- Gerenciamento de memória integrado: short-term, long-term, entity memory
- Delegação de tarefas entre agentes
- Fácil prototipagem, boa curva de aprendizado
- Adequado para produção com features enterprise

**Ideal para:** automação de processos com papéis bem definidos, equipes de agentes colaborativos.

**Alinhamento com Pumice:** ⭐⭐⭐⭐⭐ — o modelo de "agentes com papéis" reflete diretamente a proposta do projeto.

---

### 🔷 AutoGen (Microsoft)

**Repositório:** [github.com/microsoft/autogen](https://github.com/microsoft/autogen)
**Linguagem:** Python

AutoGen é um framework da Microsoft Research focado em **colaboração conversacional** entre agentes. A comunicação acontece via troca de mensagens estruturadas.

**Pontos fortes:**
- Multi-agente conversacional
- Code generation + execution nativo
- Human-in-the-loop
- Arquitetura event-driven e modular
- Suporte a múltiplas linguagens (via processos)

**Ideal para:** geração de código, debugging colaborativo, cenários onde agentes precisam negociar e debater.

**Limitações:** deployment mais manual, curva de debugging mais alta.

---

### 📊 Comparativo

| Critério | LangGraph | CrewAI | AutoGen |
|----------|-----------|--------|---------|
| Modelo de colaboração | Grafo de estados | Role-based teams | Conversacional |
| Memória integrada | Sim (state) | Sim (short/long/entity) | Parcial |
| Facilidade de uso | Média | Alta | Média-Baixa |
| Produção | Excelente | Ótimo | Bom |
| Fit com Pumice | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 2. Integração de Agentes com Obsidian

### 🔷 Model Context Protocol (MCP)

**Origem:** Anthropic (lançado novembro/2024)
**Adoção:** OpenAI, Google DeepMind, Anthropic e comunidade open-source

O MCP é um padrão aberto que define como modelos de IA se integram com ferramentas externas e fontes de dados. É o protocolo mais promissor para conectar agentes ao Obsidian.

**Como funciona com Obsidian:**
1. Um **MCP Server** é configurado para o vault do Obsidian
2. Agentes de IA se conectam ao servidor MCP
3. Agentes podem: `readNote`, `createNote`, `patchNote`, `listNotes`, `searchNotes`
4. O Obsidian CLI ou um plugin atua como bridge

**Operações disponíveis via MCP:**
- Leitura e escrita de notas
- Busca full-text
- Gerenciamento de frontmatter (YAML properties)
- Uso de templates
- Gerenciamento de tarefas

---

### 🔷 Projetos de Referência

#### knowledge-base-server
- Ingere vault completo em SQLite com FTS5
- Expõe via MCP para múltiplos agentes simultaneamente (Claude, Codex, Gemini)
- Memória compartilhada entre diferentes IAs

#### Slatekore
- Kit open-source para agentes Gemini CLI persistentes
- Usa vault do Obsidian como memória e base de conhecimento
- Abordagem minimalista

#### OpenClaw
- Agente self-hosted que escreve notas no vault em tempo real
- Vault = memória operacional do agente

#### Smart Connections (Plugin Obsidian)
- Busca semântica via embeddings
- Descoberta de notas relacionadas por contexto
- Permite que agentes encontrem notas por similaridade conceitual

---

## 3. Padrões Arquiteturais Identificados

### Padrão 1: Markdown como Protocolo de Comunicação
Múltiplos projetos usam arquivos `.md` como canal de comunicação entre agentes. Cada agente lê o estado atual, contribui com sua análise, e escreve de volta. Simples e auditável.

### Padrão 2: Separação short-term / long-term memory
- **Short-term:** contexto da sessão atual (variáveis, últimas mensagens)
- **Long-term:** vault do Obsidian (decisões, aprendizados, histórico)
- **Entity memory:** fatos sobre entidades específicas (componentes, módulos, pessoas)

### Padrão 3: Vault como fonte de verdade
O vault não é apenas armazenamento — é o **estado do mundo** para os agentes. Todo agente começa lendo o vault, age, e escreve suas descobertas de volta.

### Padrão 4: Agentes especializados com papéis fixos
Ao invés de agentes genéricos, sistemas robustos definem papéis claros:
- `Agent-Research`: pesquisa e descoberta
- `Agent-Dev`: implementação de código
- `Agent-Review`: revisão e garantia de qualidade
- `Agent-Orchestrator`: coordenação e tomada de decisão

---

## 4. Referências

| Recurso | URL |
|---------|-----|
| LangGraph | https://github.com/langchain-ai/langgraph |
| CrewAI | https://github.com/joaomdmoura/crewAI |
| AutoGen | https://github.com/microsoft/autogen |
| MCP (Anthropic) | https://anthropic.com/model-context-protocol |
| Obsidian MCP | https://mcpmarket.com (buscar "Obsidian") |
| Smart Connections | https://obsidian.md/plugins/smart-connections |
| knowledge-base-server | https://github.com/willynikes2/knowledge-base-server |

---

*Última atualização: 2026-03-18 — Agent-Research*
