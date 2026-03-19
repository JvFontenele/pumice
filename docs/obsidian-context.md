# Contexto com Obsidian

## Papel do Obsidian no produto

Obsidian e a memoria persistente do projeto.
Ele complementa o contexto runtime do hub.

## Estrutura recomendada do vault

```text
obsidian-vault/
  00-project/
    vision.md
    scope.md
  01-rules/
    coding-rules.md
    security-rules.md
  02-decisions/
    0001-*.md
  03-devlog/
    YYYY-MM-DD.md
  04-handoffs/
    from-agent-to-agent.md
```

## Fluxo de integracao

1. Operador aponta `vaultPath` no projeto.
2. Context engine indexa notas relevantes.
3. Antes de cada comando, composer monta contexto final.
4. Apos resposta do agente, sistema grava handoff/devlog.

## Regras de qualidade de contexto

1. Notas devem ser curtas e acionaveis.
2. Decisoes sempre com motivo e impacto.
3. Handoff sempre com proximo passo objetivo.
4. Evitar duplicacao de regra em varios arquivos.

## Opcional para escala

1. Sync do vault com Obsidian Sync.
2. Versionamento com Git para auditoria.
