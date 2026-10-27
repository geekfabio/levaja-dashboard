# Agentes — AngoLeva

Regras de execução para qualquer agente (Claude Code, Codex, Cursor) que trabalhe neste repositório. O contexto do produto está em `CLAUDE.md`, a especificação do painel em `LEVA_JA_ADMIN.md`, os módulos em `FEATURES.md` e a ordem de trabalho em `ROADMAP.md`.

## Antes de escrever código

1. Lê `CLAUDE.md` e, para o painel, `LEVA_JA_ADMIN.md` inteiro. Quando houver contradição, vale o `LEVA_JA_ADMIN.md`.
2. Confirma em `ROADMAP.md` em que fase está a tarefa. Um commit pequeno por fase.
3. Procura o padrão equivalente em `components/companies/` e nas peças de `components/_ui/` e `components/_common/` antes de criar estrutura nova. Não dupliques componentes: quando faltar um, cria-o no mesmo estilo e na mesma pasta dos existentes.
4. Antes de usar APIs do Next, lê `node_modules/next/dist/docs/`.

## Durante

- **Nunca deixes inglês visível.** No painel, o texto é pt-PT. Identificadores ficam em inglês.
- **Sem comentários no código.** Regra 7 de `.builderrules`.
- **Sem bibliotecas novas sem pedir.** `@tanstack/react-query` já está autorizada. Nada de bibliotecas de ícones, de datas ou de componentes que dupliquem `components/_ui/`.
- **Formatação** passa sempre por `lib/format.ts` (`formatKz`, `formatDateTimeNumeric`, …).
- **Páginas e componentes nunca importam mocks.** Usam `hooks/admin/` sobre `repositories()`.
- **Regras de negócio** (máquina de estados, motivo obrigatório, preços, saldo, permissões) são aplicadas na implementação dos repositórios, como o servidor fará, e reutilizam `lib/leva-ja/`.
- Mantém a estrutura de `public/assets/images/` a espelhar a de `components/`.
- **Não apagues ficheiros** fora do que foi aprovado em `LEVA_JA_ADMIN.md` (secção 2). Se surgir outra remoção, pergunta antes.

## Ambiente de testes

- Os testes correm em Node por type stripping: usa sempre `import type` para tipos e não uses `enum`, `namespace` nem parameter properties nas classes.
- Os testes do painel ficam em `tests/leva-ja-*.test.ts`, com `node:test`, e resolvem o alias `@/` por `tests/resolve-alias.mjs`.

## Email e SMS do CRM — travões

- O envio real exige `MESSAGING_LIVE=true`. Sem essa variável, o adaptador escreve no log e devolve sucesso simulado.
- **Um agente nunca dispara uma campanha, um envio em massa ou um teste para um número/endereço real** sem pedido explícito do utilizador nessa conversa.
- Credenciais de fornecedores vivem em `.env.local` — nunca no repositório.

## Verificação antes de dar por feito

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Os quatro têm de passar. Se não passarem, diz-se que não passaram e mostra-se o output — não se entrega como concluído.

Para mudanças de UI, confirma em ecrã de tablet e de desktop: a sidebar é redimensionável e colapsa abaixo de `lg` (`hooks/use-mobile-breakpoints.ts`, `lib/sidebar.ts`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
