# Agentes — Alimenta Angola CRM

Regras de execução para qualquer agente (Claude Code, Codex, Cursor) que trabalhe neste repositório. O contexto do produto está em `CLAUDE.md`, a especificação em `FEATURES.md` e a ordem de trabalho em `ROADMAP.md`.

## Antes de escrever código

1. Lê `CLAUDE.md` e a secção de `FEATURES.md` do módulo em que vais mexer.
2. Confirma em `ROADMAP.md` que a tarefa pertence à fase actual. Não saltes fases: a Fase 0 (tradução pt-AO) precede tudo o resto porque qualquer ecrã novo em inglês duplica trabalho.
3. Procura o padrão equivalente em `components/companies/` antes de inventar estrutura nova. Este repositório tem um módulo de referência completo — copia-o.
4. Para schema, migrações, RLS ou Edge Functions, carrega as skills `supabase` e `supabase-postgres-best-practices` de `.claude/skills/`.

## Durante

- **Nunca deixes inglês visível.** Ao tocar num ficheiro, traduz as strings de UI que lá estiverem, mesmo que não sejam o alvo da tarefa. Identificadores ficam em inglês (regra 2 de `CLAUDE.md`).
- **Sem comentários no código.** Regra 7 de `.builderrules`.
- **Sem bibliotecas novas sem pedir.** Em particular: nada de bibliotecas de ícones, de datas pesadas (`Intl` chega) ou de componentes que dupliquem `components/_ui/`.
- **Formatação de valores** passa sempre por `lib/format.ts` (Kz, datas, percentagens, números). Se o helper ainda não existir na fase em que estás, cria-o aí em vez de formatar inline.
- Mantém a estrutura de `public/assets/images/` a espelhar a de `components/`.

## Email e SMS — travões

Estes módulos enviam para pessoas reais e custam dinheiro por mensagem.

- O envio real exige `MESSAGING_LIVE=true`. Sem essa variável, o adaptador escreve no log e devolve sucesso simulado.
- **Um agente nunca dispara uma campanha, um envio em massa ou um teste para um número/endereço real** sem pedido explícito do utilizador nessa conversa. Gerar a campanha e deixá-la em rascunho é o comportamento correcto.
- Em desenvolvimento, todos os destinatários são reescritos para o endereço/número de sandbox configurado.
- Credenciais de fornecedores vivem em `.env.local` e em Supabase secrets — nunca no repositório, nunca num ficheiro de exemplo com valores reais.

## Base de dados

- Toda a tabela nova nasce com RLS activo e com políticas explícitas. Uma migração que crie tabela sem política é incompleta.
- Migrações são ficheiros versionados, nunca alterações manuais no painel.
- Dados de clientes não saem do Supabase para ficheiros do repositório. `data/` só tem dados fictícios.

## Verificação antes de dar por feito

```bash
npm run lint
npm test
npm run build
```

Os três têm de passar. Se não passarem, diz-se que não passaram e mostra-se o output — não se entrega como concluído.

Para mudanças de UI, confirma em ecrã estreito (360px) e largo: a sidebar é redimensionável e colapsa em mobile (`hooks/use-mobile-breakpoints.ts`, `lib/sidebar.ts`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
