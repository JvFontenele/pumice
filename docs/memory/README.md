# 📁 Memory — Registros por Agente e Contexto

> Esta pasta armazena registros detalhados de cada agente e contexto de execução.
> Cada agente deve criar/atualizar seu próprio arquivo aqui.

## Estrutura Sugerida

```
memory/
  README.md              → Este arquivo
  agent-research.md      → Registro do Agent-Research
  agent-dev.md           → Registro do Agent-Dev (a criar)
  decisions/             → Decisões importantes tomadas coletivamente
    001-framework.md     → Escolha do framework de orquestração
    002-obsidian-integration.md → Estratégia de integração com Obsidian
```

## Convenções

- Nome dos arquivos: `agent-{nome}.md` para registros de agentes
- Decisões: numeradas sequencialmente em `decisions/`
- Formato: Markdown com frontmatter YAML para metadados
- Timestamps: sempre incluir data (formato: YYYY-MM-DD)
