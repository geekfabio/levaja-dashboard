# Roadmap — AngoLeva

Ordem de trabalho do painel de administração. Um commit pequeno por fase, em pt-PT. O detalhe funcional está em `LEVA_JA_ADMIN.md` e `FEATURES.md`; as regras em `CLAUDE.md`.

No fim de cada fase, `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build` têm de passar.

---

## Fase 1 — Inventário e plano ✅

Tipos (`types/leva-ja.ts`), regras de negócio (`lib/leva-ja/`), formatação (`formatKz`, `formatDateTimeNumeric`) e contratos dos repositórios.

## Fase 2 — Dados mock ✅

`MockDatabase` com semente fixa, latência, falhas simuladas, cópias defensivas, persistência local e tempo real; implementação mock de todos os repositórios; `repositories()`; testes de contrato.

## Fase 3 — Shell, login e permissões ✅

- Rebrand do CRM para AngoLeva e remoção da cadeia Cash & Carry (`LEVA_JA_ADMIN.md`, secção 2).
- Gráficos reutilizáveis em `components/_common/charts/`.
- Tema do painel em `:root[data-area="admin"]`.
- `/admin/login`, guarda de sessão e de papel, sidebar e topbar reutilizadas do CRM, `QueryClientProvider`.
- Peças genéricas: `skeleton`, `async-state`, `pagination`, `confirm-dialog`.

## Fase 4 — Visão geral e pedidos ✅

KPIs, gráficos e «precisa de atenção»; tabela de pedidos com filtros; detalhe e acções (reatribuir, cancelar, disputa, forçar conclusão); mapa operacional.

## Fase 5 — Prestadores e documentos ✅

Lista e detalhe de prestadores com acções; fila de validação de documentos.

## Fase 6 — Clientes e finanças ✅

Clientes com bloqueio; receita, levantamentos e transacções com CSV.

## Fase 7 — Preços, zonas, suporte, auditoria e utilizadores ✅

Editor de preços com estimativa; zonas; ocorrências, SOS e avaliações baixas; utilizadores do painel; auditoria filtrável.

## Fase 8 — HTTP, README e revisão ✅

Esqueleto REST em `data/leva-ja/http/` com erros convertidos em `RepositoryError`; README com como correr, como ligar à API e credenciais de demonstração; revisão final de acessibilidade, textos e estados.

## Fase 9 — Definições da plataforma e papéis ✅

Definições por secção (geral, serviços, atribuição, cancelamentos, pagamentos, impostos, documentos, notificações, suporte, segurança e app), cada uma com validação, motivo e auditoria; matriz editável de papéis e permissões; regras do mock passam a ler as definições.

## Fase 10 — Mapa OpenStreetMap ✅

Mapa de Angola com tiles do OpenStreetMap, zoom e arrastar (rato, teclado e botões); viaturas disponíveis por classe, livres ou em serviço; rota pelas estradas (OSRM, com estimativa se o serviço falhar) com km e duração por troço e no total; usado no mapa operacional, no detalhe do pedido, na cobertura do prestador e nas zonas.

## Fase 11 — Disputas e reembolsos ✅

`/admin/disputas` com categoria, prazo de 72 h, notas internas e resolução com ou sem reembolso; `/admin/reembolsos` com aprovação das Finanças, dupla aprovação acima do limite, rejeição e pagamento com referência; acções no detalhe do pedido e na visão geral.

## Fase 12 — Facturação, reconciliação, numerário e lotes ✅

`/admin/facturacao` com facturas-recibo e notas de crédito (IVA incluído, numeração por série), reconciliação diária de cartão e Multicaixa e numerário em dívida dos prestadores; lotes de pagamento em Finanças com ficheiro de transferências.

## Fase 13 — Candidaturas, frotas, qualidade e penalizações ✅

`/admin/candidaturas` com funil e etapas (documentos, entrevista, vistoria, aprovação que cria o prestador); `/admin/frotas` com motoristas e estatísticas; qualidade dos prestadores com pontuação e alertas; advertências, multas e suspensões temporárias com anulação.

## Fase 14 — Agendados, prazos, mapa de calor, fotografias e sinistros ✅

`/admin/agendados` com antecedência configurável e risco; separador Prazos em Pedidos; mapa de calor da procura e da oferta no mapa operacional; fotografias no detalhe do pedido; `/admin/sinistros` com análise, aprovação e pagamento.

## Fase 15 — Contas empresariais, promoções, comunicações e relatórios ✅

`/admin/empresas` com contrato, utilizadores e extractos; `/admin/promocoes` com regras e orçamento; `/admin/comunicacoes` só com envio simulado; `/admin/relatorios` com exportação CSV.

## Fase 16 — Suporte avançado, segurança, protecção de dados e integrações ✅

Suporte com prazos de primeira resposta, respostas prontas e satisfação; segundo factor no login, sessões activas e registo de acessos em `/admin/utilizadores`; `/admin/proteccao-dados` com prazos de 30 dias, exportação JSON e eliminação por anonimização; `/admin/integracoes` com chaves de API e webhooks (testes só simulados).

---

## Por fazer

### Pendente de decisão

- Remover `components/admin/shared/luanda-map.tsx` (o mapa SVG anterior, já sem uso) e os restantes ficheiros listados em `LEVA_JA_ADMIN.md`, secção 4, «Por decidir».
- Em produção, servidores próprios ou contratados de tiles e de rotas (`NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_ROUTING_URL`).

---

## Critérios de conclusão

- Os quatro comandos passam sem erros.
- Nenhuma página importa mocks directamente.
- Todas as páginas têm estados de carregamento, vazio, erro e sucesso.
- Todos os textos do painel estão em pt-PT.
- As acções críticas têm confirmação, motivo e registo na auditoria.
- O CRM continua a funcionar, com a marca AngoLeva.
