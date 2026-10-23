# Roadmap — Leva Já

Ordem de trabalho do painel de administração. Um commit pequeno por fase, em pt-PT. O detalhe funcional está em `LEVA_JA_ADMIN.md` e `FEATURES.md`; as regras em `CLAUDE.md`.

No fim de cada fase, `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build` têm de passar.

---

## Fase 1 — Inventário e plano ✅

Tipos (`types/leva-ja.ts`), regras de negócio (`lib/leva-ja/`), formatação (`formatKz`, `formatDateTimeNumeric`) e contratos dos repositórios.

## Fase 2 — Dados mock ✅

`MockDatabase` com semente fixa, latência, falhas simuladas, cópias defensivas, persistência local e tempo real; implementação mock de todos os repositórios; `repositories()`; testes de contrato.

## Fase 3 — Shell, login e permissões ✅

- Rebrand do CRM para Leva Já e remoção da cadeia Cash & Carry (`LEVA_JA_ADMIN.md`, secção 2).
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

---

## Por fazer

As rotas, os nomes e as permissões destas secções já existem em `lib/leva-ja/navigation.ts` e `lib/leva-ja/permissions.ts`; falta implementá-las e acrescentá-las a `NAV_GROUPS`. Cada fase mantém as regras de sempre: dados mock em `data/leva-ja/mock/`, contrato e implementação HTTP, hooks em `hooks/admin/`, regras em `lib/leva-ja/`, auditoria das acções críticas e testes de contrato.

### Fase 14 — Agendados, prazos, mapa de calor, fotografias e sinistros

- `/admin/agendados`: pedidos marcados para mais tarde, com antecedência para atribuir e alerta quando ninguém aceita.
- Prazos (SLA) de atribuição e chegada (`dispatch.assignTargetMinutes`, `arrivalTargetMinutes`) com indicadores e pedidos fora do prazo.
- Mapa de calor da procura e da oferta no mapa OpenStreetMap, por zona e por hora.
- Fotografias da carga na recolha e na entrega, no detalhe do pedido.
- `/admin/sinistros`: danos e acidentes, com seguradora, valor, estado e anexos (`claims.view`, `claims.manage`).

### Fase 15 — Contas empresariais, promoções, comunicações e relatórios

- `/admin/empresas`: clientes empresariais com contrato, preços acordados, limite de crédito e facturação mensal (`business.view`, `business.manage`).
- `/admin/promocoes`: códigos de desconto e campanhas, com regras, orçamento e uso (`promotions.view`, `promotions.manage`).
- `/admin/comunicacoes`: avisos por push, SMS e e-mail para clientes e prestadores, só em modo de demonstração; nenhum envio real sem `MESSAGING_LIVE=true` e pedido explícito (`communications.send`).
- `/admin/relatorios`: relatórios por período (operação, finanças, prestadores, zonas) com exportação CSV (`reports.view`).

### Fase 16 — Suporte avançado, segurança, protecção de dados e integrações

- Suporte: respostas prontas, prazos de resposta (`support.firstResponseHours`) e inquérito de satisfação.
- Segurança: dois factores no login, sessões activas com terminar sessão remotamente e registo de acessos (`security.manage`).
- `/admin/proteccao-dados`: pedidos de acesso, rectificação e eliminação ao abrigo da Lei 22/11, com prazos (`privacy.manage`).
- `/admin/integracoes`: chaves de API e webhooks, com rotação e registo de entregas (`integrations.manage`).

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
- O CRM continua a funcionar, com a marca Leva Já.
