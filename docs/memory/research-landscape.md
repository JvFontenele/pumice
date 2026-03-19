# Research Landscape

Data: 2026-03-18
Autor: Agent-Research
Status: draft

## Objetivo

Mapear ferramentas e metodos que ja existem e que podem servir de base para um sistema de orquestracao de multiplos agentes com memoria persistente no Obsidian.

## Criterios de avaliacao

- Suporte a multiplos agentes ou workflows compostos
- Persistencia de estado ou memoria entre execucoes
- Facilidade de integrar com arquivos Markdown
- Baixo acoplamento com interfaces proprietarias
- Boa base para auditoria das acoes dos agentes

## Ferramentas e abordagens

### 1. LangGraph

O que oferece:

- Orquestracao baseada em grafos de estados
- Persistencia e memoria de execucao
- Boa adequacao para fluxos com etapas, handoffs e checkpoints

Por que importa para este projeto:

- Combina bem com a ideia de agentes com papeis diferentes
- Facilita registrar cada transicao de estado em arquivos Markdown
- Permite separar regras de coordenacao da camada de memoria

Risco:

- Pode ser mais estrutural do que o necessario para um primeiro prototipo

### 2. AutoGen

O que oferece:

- Conversas entre agentes
- Colaboracao entre papeis distintos
- Suporte natural para troca de mensagens entre agentes

Por que importa para este projeto:

- Se aproxima da ideia de alinhamento inicial em `brainstorming.md`
- Pode servir como modelo de protocolo entre agentes mesmo sem adotar o framework inteiro

Risco:

- Conversa multiagente por si so nao resolve a camada de memoria no Obsidian

### 3. CrewAI

O que oferece:

- Estrutura de crews e flows
- Definicao explicita de papeis, objetivos e tarefas
- Boa ergonomia para coordenacao de responsabilidades

Por que importa para este projeto:

- O conceito de crew combina com a modelagem do repositorio como equipe de agentes
- Pode acelerar um prototipo inicial de distribuicao de responsabilidades

Risco:

- Pode induzir um desenho mais orientado ao framework do que ao repositorio

### 4. Obsidian como memoria de arquivo

Recursos uteis:

- Markdown como formato canonicamente legivel por humanos e maquinas
- Links internos para conectar notas, tarefas e decisoes
- Properties para metadados estruturados
- Templates para padronizar registros

Por que importa para este projeto:

- Atende a exigencia de memoria auditavel e persistente
- Mantem o estado visivel no repositorio
- Permite operar sem banco adicional em um primeiro momento

Risco:

- Consultas complexas exigem convencoes rigorosas ou plugins auxiliares

### 5. Dataview no Obsidian

O que oferece:

- Consultas sobre notas com base em metadados e campos
- Visao derivada de tarefas, status, agentes e datas

Por que importa para este projeto:

- Permite transformar as notas de memoria em paineis de acompanhamento
- Ajuda a localizar decisoes, responsaveis e pendencias sem criar outra interface

Risco:

- Introduz dependencia de plugin para consultas mais avancadas

## Metodos recomendados

### A. Event sourcing em Markdown

Em vez de sobrescrever estado, cada agente registra eventos:

- alinhamento
- decisao
- execucao
- bloqueio
- validacao

Vantagem:

- Historico auditavel
- Facil reconstituir contexto

### B. Estado canonico + log de memoria

Separar:

- arquivos canonicos de estado, como `task.md`
- registros detalhados em `docs/memory/`

Vantagem:

- Evita que o backlog fique poluido
- Preserva detalhe sem perder leitura rapida

### C. Convencoes de frontmatter/properties

Exemplos uteis:

- `agent`
- `status`
- `task`
- `decision`
- `related`
- `updated_at`

Vantagem:

- Facilita indexacao futura por Obsidian ou scripts

## Direcao recomendada

Para o primeiro prototipo, a combinacao mais pragmatica parece ser:

1. Obsidian + Markdown como memoria e fonte de verdade
2. Convencoes de templates e metadados para padronizar os registros
3. Um orquestrador simples em codigo que leia e escreva nesses arquivos
4. Opcionalmente, Dataview para visualizacao
5. Se a complexidade crescer, adotar LangGraph para a camada de coordenacao

## Proximo passo sugerido

Definir uma arquitetura minima viavel com:

- protocolo de escrita em `brainstorming.md`
- formato de tarefas em `task.md`
- esquema de arquivos em `docs/memory/`
- contrato entre agentes e orquestrador

## Fontes

- LangGraph docs: https://langchain-ai.github.io/langgraph/
- AutoGen docs: https://microsoft.github.io/autogen/
- CrewAI docs: https://docs.crewai.com/
- Obsidian Help: https://help.obsidian.md/
- Obsidian Dataview: https://github.com/blacksmithgu/obsidian-dataview
