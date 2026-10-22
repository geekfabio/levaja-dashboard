# Roadmap — Leva Já

Ordem de trabalho do painel de administração. Um commit pequeno por fase, em pt-PT. O detalhe funcional está em `LEVA_JA_ADMIN.md` e `FEATURES.md`; as regras em `CLAUDE.md`.

No fim de cada fase, `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build` têm de passar.

---

## Fase 1 — Inventário e plano ✅

Tipos (`types/leva-ja.ts`), regras de negócio (`lib/leva-ja/`), formatação (`formatKz`, `formatDateTimeNumeric`) e contratos dos repositórios.

## Fase 2 — Dados mock ✅

`MockDatabase` com semente fixa, latência, falhas simuladas, cópias defensivas, persistência local e tempo real; implementação mock de todos os repositórios; `repositories()`; testes de contrato.

## Fase 3 — Shell, login e permissões

- Rebrand do CRM para Leva Já e remoção da cadeia Cash & Carry (`LEVA_JA_ADMIN.md`, secção 2).
- Gráficos reutilizáveis em `components/_common/charts/`.
- Tema do painel em `:root[data-area="admin"]`.
- `/admin/login`, guarda de sessão e de papel, sidebar e topbar reutilizadas do CRM, `QueryClientProvider`.
- Peças genéricas: `skeleton`, `async-state`, `pagination`, `confirm-dialog`.

## Fase 4 — Visão geral e pedidos

KPIs, gráficos e «precisa de atenção»; tabela de pedidos com filtros; detalhe e acções (reatribuir, cancelar, disputa, forçar conclusão); mapa operacional.

## Fase 5 — Prestadores e documentos

Lista e detalhe de prestadores com acções; fila de validação de documentos.

## Fase 6 — Clientes e finanças

Clientes com bloqueio; receita, levantamentos e transacções com CSV.

## Fase 7 — Preços, zonas, suporte, auditoria e utilizadores

Editor de preços com estimativa; zonas; ocorrências, SOS e avaliações baixas; utilizadores do painel; auditoria filtrável.

## Fase 8 — HTTP, README e revisão

Esqueleto REST em `data/leva-ja/http/` com erros convertidos em `RepositoryError`; README com como correr, como ligar à API e credenciais de demonstração; revisão final de acessibilidade, textos e estados.

---

## Critérios de conclusão

- Os quatro comandos passam sem erros.
- Nenhuma página importa mocks directamente.
- Todas as páginas têm estados de carregamento, vazio, erro e sucesso.
- Todos os textos do painel estão em pt-PT.
- As acções críticas têm confirmação, motivo e registo na auditoria.
- O CRM continua a funcionar, com a marca Leva Já.
