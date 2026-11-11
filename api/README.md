# angoleva-api

API que serve o painel web (`levaja-dashboard`, admin + CRM) e a app móvel (`leva-ja`), sobre uma base de dados **Neon** (Postgres serverless).

Plano completo em [`../PLANO_API.md`](../PLANO_API.md). Contrato da app móvel em [`leva-ja/docs/api.md`](https://github.com/geekfabio/leva-ja/blob/main/docs/api.md).

## Decisão de infra desta fase

Esta API corre sobre uma base de dados **Neon partilhada** com outra aplicação (projecto `umoja-ai`) — por isso todas as tabelas vivem isoladas no schema Postgres **`angoleva`**, nunca em `public`. Nunca criar tabelas, alterar ou consultar `public.*` a partir deste serviço.

A ligação usa o **driver HTTP do Neon** (`@neondatabase/serverless` + `drizzle-orm/neon-http`), não TCP directo — é o que funciona em ambientes com saída de rede restrita a HTTPS, e é o modo recomendado para runtimes serverless.

## Começar

```bash
cp .env.example .env   # preencher DATABASE_URL e os segredos (ver comentários no ficheiro)
npm install
npm run db:generate    # gera a migração a partir de src/db/schema/
npm run db:migrate     # aplica contra o schema `angoleva`
npm run dev             # http://localhost:4000, com recarregamento
npm test
```

## Stack

Fastify + TypeScript + Zod · Drizzle ORM (`drizzle-orm/neon-http`) · `tsx` (dev **e** produção, por agora — ver nota de módulos abaixo).

## Estrutura

```
src/
  env.ts            variáveis de ambiente validadas (Zod)
  app.ts            build() do Fastify: plugins, tratamento de erros, rotas
  index.ts           arranque (porta 4000)
  db/
    client.ts         ligação Drizzle + Neon HTTP
    migrate.ts         aplica as migrações geradas
    schema/
      schema.ts         pgSchema("angoleva")
      auth.ts            accounts, sessions, refresh_tokens, otp_codes, devices
      ops.ts             domínio operacional (pedidos, prestadores, pagamentos, chat…) — contrato da app móvel
      admin.ts           auditoria e definições do painel
      crm.ts             tabelas do CRM — contrato de data/crm/repositories/*.ts
  plugins/
    error-handler.ts    converte erros no envelope { error: { code, message } } do contrato
  lib/
    envelope.ts          ApiError, dataEnvelope(), listEnvelope()
    ids.ts                 newId(prefix) com cuid2
  routes/
    health.ts              GET /health (confirma a ligação à BD)
drizzle/              migrações SQL geradas (versionadas)
tests/                 node:test — um ficheiro por módulo, à medida que as fases avançam
```

## Nota sobre módulos ESM

`tsconfig.json` usa `moduleResolution: "bundler"` (importações sem extensão `.js`), e por isso o arranque em produção ainda corre por `tsx` (`npm start`), não por `tsc` + `node dist/`. Antes de um deploy real, rever: ou mudar para `NodeNext` com extensões `.js` explícitas em todos os imports (mais Node-idiomático), ou manter `tsx`/um bundler (esbuild) no passo de build. Não é um bloqueio para as fases seguintes.

## Fases

Ver a tabela em `../PLANO_API.md`. Feitas: Fase 1 (scaffolding + esquema), Fase 2 (autenticação da app móvel), Fase 3 (autenticação do painel/CRM), Fase 4 (pedidos de serviço e a máquina de estados — incl. reatribuição, abertura de disputa e conclusão forçada, directamente em `requests.ts`/`admin-requests.ts`), Fase 5 (prestadores — estado, viatura, cobertura, zonas, documentos, carteira e levantamentos), Fase 6 (pagamentos, chat e dispositivos — tempo real por polling), Fase 7 (painel administrativo: pedidos, prestadores, clientes, documentos, zonas, preços, segurança incl. registo de acessos e 2FA, auditoria, métricas, definições da plataforma, operações agendadas/SLA/mapa de calor — as secções todas), Fase 8 (CRM: empresas, contactos, oportunidades, tickets, actividades, conversas, documentos, campanhas, automações, propostas de desconto — campanhas/automações só com as acções discretas, a edição fina de rascunho fica no frontend por desenho), Fase 9 (ficheiros — `/uploads`; candidatura de prestador → aprovação cria conta), um segundo lote de módulos do painel (finanças, facturação, reembolsos, disputas, reclamações), um terceiro lote (suporte avançado — tickets, SOS, avaliações baixas, SLA; negócio — contas empresariais e extractos; qualidade — pontuação e penalizações; privacidade — pedidos de titular de dados; frotas; integrações — chaves de API e webhooks; comunicações — broadcasts; promoções) e um quarto lote, de rotas só para a app móvel que faltavam desde o início (confirmado por grep que não existiam): `/locations/*` (posição aproximada, geocodificação inversa via Nominatim, pesquisa de endereço, bairros a partir de `zones`), `/vehicles/nearby` (viaturas de prestadores online para o mapa do cliente), `/help` + `/help/emergency-contacts` (FAQ e contactos de emergência, públicas), `/tickets` + `/sos` (abertura de ocorrência e alerta SOS pelo cliente/prestador — antes só o painel conseguia geri-los, nunca criá-los), e `/clients/:id/addresses` + `/clients/:id/payment-methods` (moradas e cartões guardados do cliente). As fases seguintes acrescentam rotas em `src/routes/`, com os testes de contrato correspondentes em `tests/`, sem mexer no que já está — o esquema pode crescer (novas colunas/tabelas), mas o que existe aqui não muda de forma incompatível sem motivo.

Nota sobre o quarto lote: `help_articles` foi semeado com 6 artigos (orders/payments/safety), cada um citando uma regra de negócio real do código (nunca inventados) — a categoria `account` ficou deliberadamente vazia por não haver uma regra clara para citar. `emergency_contacts` fica deliberadamente vazia — são números de telefone de segurança reais, inventá-los seria perigoso; alguém do produto tem de os preencher (via painel ou migração de dados) antes de lançar.

Quinto lote — núcleo do negócio (pedir/aceitar uma corrida) reforçado com localização real e negociação de preço:
- `PUT /providers/:id/location`: o prestador passa a poder actualizar a sua posição (`providers.lat/lng`), que já era devolvida em `provider.location` dentro de `GET /requests/:id` e `GET /requests/changes` — antes não havia nenhuma rota a escrever estas colunas, por isso a posição do motorista nunca reflectia o GPS real.
- Negociação de preço (`request_negotiations`, nova tabela): durante `searching`, um prestador pode abrir uma negociação a partir do preço estimado (`POST /requests/:id/negotiations`, `direction: "up"|"down"`), e qualquer um dos dois lados ajusta por `api/src/lib/negotiation.ts::NEGOTIATION_STEP_KZ` (50 Kz) de cada vez (`.../adjust`), dentro de ±15% do preço estimado (`NEGOTIATION_RANGE_PERCENT`, também em `negotiation.ts`). Aceitar (`.../accept`) atribui o pedido ao prestador com o preço negociado (recalcula `pricing`/`provider_earning_kz`, tal como o antigo `proposal/answer`) e cancela as outras negociações pendentes do mesmo pedido; `accept()`/`proposal/answer` directos (sem negociação) também cancelam as pendentes. Substitui, para todos os tipos de serviço incluindo mudança de casa, o mecanismo anterior de proposta única do prestador — esse mecanismo (`/proposal`, `/proposal/answer`) continua no código (não foi removido, por segurança/retrocompatibilidade) mas deixa de ser o caminho usado pela app.
- Quem está do lado de fora de uma negociação não a vê: `GET /requests/:id/negotiations` devolve todas ao cliente (dono do pedido) mas só a própria ao prestador.

Sexto lote — saldo de numerário do prestador (único meio de pagamento é dinheiro em mão, por decisão de produto):
- Como o cliente paga directamente ao prestador em numerário, é o prestador que fica com a taxa da plataforma e a comissão de cada corrida em numerário — isso já era calculado para o ecrã "Facturação → Numerário" (`admin-billing.ts::cashDebtOf`), mas sem nenhuma consequência: um prestador endividado continuava a receber pedidos normalmente.
- Novo `api/src/lib/cash-balance.ts::cashBalanceKz(providerAccountId)`: o mesmo cálculo (devido por corridas em numerário entregues/avaliadas, menos depósitos confirmados em `cash_deposits`), duplicado de propósito em vez de reaproveitar `admin-billing.ts` — para acrescentar o bloqueio sem arriscar esse módulo já testado. `isBlockedByCashBalance()` é só `saldo < 0`.
- Saldo negativo bloqueia: `PUT /providers/:id/availability` recusa `online: true` (`422`, mensagem indica quantos Kz faltam); `POST /requests/:id/accept`, a atribuição por negociação (`assignAtNegotiatedAmount`) e `POST /requests/:id/proposal/answer` recusam atribuir um pedido a um prestador com saldo negativo (`403`), independentemente do estado `online` guardado.
- Auto-pausa: quando uma corrida em numerário é confirmada (`lib/payments.ts::confirmPayment`, chamado por `POST /requests/:id/payments` com `payment_method: "cash"`) deixa o saldo negativo, o prestador é posto `online: false` automaticamente — não precisa de esperar pela próxima tentativa de ficar disponível para ser bloqueado.
- Novo `GET /providers/:id/balance` (self): `{ owed_kz, deposited_kz, balance_kz, blocked }`, para a app móvel mostrar ao prestador quanto deve e se está bloqueado.
- Carregar saldo continua manual: o prestador transfere por fora da app e um administrador confirma o depósito em `POST /admin/billing/cash-deposits` (já existia, Fase "Facturação") — sem gateway de pagamento. Isto é deliberado: no lançamento a comissão (`commission_rate`) e a taxa fixa (`platform_fee`) em "Definições → Preços" ficam a 0, por isso nenhuma corrida gera dívida e o bloqueio nunca activa, até haver taxa.

**Ainda por fazer** (ver `../PROMPT_INTEGRACAO.md`): A4 — testes de contrato ponta-a-ponta contra os dois frontends (mobile e web); ligação entre o pedido de levantamento feito pela app (`wallet_transactions`) e a gestão administrativa de levantamentos (`withdrawals`, hoje dois registos paralelos); módulo de reembolsos ainda não alimenta `revenue()`/notas de crédito de facturação; aplicação real de uma promoção no fluxo de checkout (`promotion_uses` só é populável directamente na BD por agora); preencher `emergency_contacts` com números reais antes de lançar; candidatura de prestador pela app móvel (`POST /applications` já existe e funciona, mas nenhum ecrã da app o chamava — correcção em curso no repositório `leva-ja`); Secção B (mobile: WebSocket, push, pagamentos reais) continua por fazer; Secção C (web: mapeador snake_case↔camelCase, guarda de sessão do CRM) está feita.

Nota sobre `/uploads` (Fase 9): o armazenamento é local em disco (`api/uploads/`, fora do git), com um ficheiro de metadados `<id>.json` ao lado de cada ficheiro — não há object storage real ligado nesta fase. O contrato (`{ id, url, content_type }`) é o mesmo que a Fase de produção terá de cumprir ao trocar para S3/R2/etc.; só a implementação de `src/lib/uploads.ts` muda.

Nota sobre migrações concorrentes (privacidade + frotas): ao gerar a migração dos módulos de privacidade e frotas, `npm run db:generate` falhou porque `drizzle/meta/0004..0007_snapshot.json` já colidiam entre si (quatro fases em paralelo, cada uma a pensar que era a "0004"). Em vez de tentar reconciliar snapshots de outras fases ainda a decorrer, o esquema novo (tabela `fleets`, coluna `providers.fleet_id`, tabela `privacy_requests` + enums) foi aplicado directamente à base de dados partilhada com DDL idempotente (`IF NOT EXISTS`/`duplicate_object`), gravado também em `drizzle/0008_privacy_fleets.sql` com uma entrada em `meta/_journal.json` (`when` maior que todas as existentes, para correr depois de todas elas em qualquer ordem de reconciliação). `npm run db:migrate` corre sem erros a partir desta base. A colisão 0004-0007 em si fica para quem reconciliar as fases na fusão, como já notado abaixo.

Nota sobre a reconciliação do terceiro lote (suporte, negócio+qualidade, privacidade+frotas, integrações+comunicações, promoções+operações, pedidos — resto): seis agentes em paralelo, cada um a gerar a sua própria migração "0008" a partir de um snapshot anterior (0007) que ainda não reflectia o trabalho dos outros. Reconciliado por ordem de chegada — 0008 privacidade+frotas (já aplicado directamente, sem `drizzle-kit generate`, ver nota acima) → 0009 suporte → 0010 integrações+comunicações → 0011 promoções+operações → 0012 negócio+qualidade — renumerando cada ficheiro `.sql`/`meta/*_snapshot.json` e, a cada passo, correndo `db:generate` de novo: como o `.sql` de cada agente só continha as suas próprias tabelas novas (todas com `IF NOT EXISTS`/`duplicate_object`, seguras para reaplicar), mas o `snapshot.json` dessa branch não "via" os módulos mesclados a seguir, o `generate` seguinte propunha sempre recriar essas tabelas; a correcção foi copiar o `snapshot.json` cumulativo que o próprio `generate` gerava (que já cruza o `schema/*.ts` actual com a base de dados real) por cima do snapshot incompleto do agente, e descartar o `.sql` redundante (confirmado sem nenhum `DROP`, nunca chegou a ser aplicado). No fim, `db:generate` voltou a devolver "No schema changes, nothing to migrate" e `db:migrate` continua idempotente. A branch de negócio+qualidade também tinha alterado por engano os timestamps (`when`) das entradas 0005 e 0007 do `_journal.json` ao tentar corrigir a cadeia `prevId` (já corrigida antes, nesta fusão) — repostos os valores originais antes de acrescentar a sua entrada.

Nota sobre migrações concorrentes: as Fases 7 e 8 correram em paralelo e cada uma gerou a sua própria migração "0001" (nomes diferentes, mas o mesmo índice). Como o migrador do Drizzle para Neon HTTP decide o que aplicar comparando só a data (`when`) de cada migração com a da última aplicada — não por hash por migração —, a segunda a ser reconciliada teve de ser renumerada para "0002" com uma assinatura temporal igual à que já tinha sido gravada como aplicada na base de dados (ambas já lá estavam, aplicadas directamente por cada agente antes da fusão). Ao gerar migrações em paralelo no futuro, convém sincronizar com a branch principal (e os `meta/*.json`) antes de cada `db:generate`, para não repetir esta reconciliação manual.

Nota para quem continuar: as Fases 2 e 3 correram em paralelo e colidiram em `src/lib/mailer.ts` e `src/lib/otp.ts` (duas implementações independentes do mesmo problema). Ficou um `sendMail()` só (`src/lib/mailer.ts`, usado pelas duas rotas) e dois módulos de OTP lado a lado — `src/lib/otp.ts` (fluxo completo da app móvel: cria, verifica, conta tentativas) e `src/lib/otp-admin.ts` (primitivas usadas directamente em `admin-auth.ts`). Vale a pena unificar os dois um dia, mas não foi feito agora para não arriscar os testes já a passar.
