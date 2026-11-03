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

Ver a tabela em `../PLANO_API.md`. Feitas: Fase 1 (scaffolding + esquema), Fase 2 (`src/routes/auth.ts` — autenticação da app móvel), Fase 3 (`src/routes/admin-auth.ts` — autenticação do painel/CRM), Fase 4 (`src/routes/requests.ts` — pedidos de serviço e a máquina de estados; `src/lib/wallet.ts` credita o ganho do prestador na entrega, reutilizado pela Fase 5; `src/lib/request-events.ts` reúne o registo de eventos do histórico do pedido, partilhado com a Fase 6), Fase 5 (`src/routes/providers.ts` — estado do prestador, viatura, cobertura, zonas, documentos, carteira e levantamentos), Fase 6 (`src/routes/payments.ts`, `src/routes/chat.ts`, `src/routes/devices.ts` — pagamentos, chat e dispositivos; tempo real por polling, `GET /threads/:id/changes?since=` no mesmo estilo de `GET /requests/changes`), Fase 7 (`src/routes/admin-{requests,providers,clients,documents,zones,pricing,security,audit,metrics}.ts` — núcleo do painel administrativo, parcial: faltam operações agendadas/SLA/mapa de calor, reatribuição e disputa de pedidos, registo de acesso e 2FA de segurança, alertas de métricas e definições da plataforma), Fase 8 (`src/routes/crm-{companies,contacts,opportunities,tickets}.ts` — CRM, parcial: faltam actividades, conversas, documentos, campanhas e automações/propostas), Fase 9 (`src/routes/uploads.ts` — `POST /uploads` e `GET /uploads/:id`, contrato de `leva-ja/docs/api.md` § Ficheiros; `src/routes/applications.ts` — `POST /applications`, público; `src/routes/admin-applications.ts` — `GET /admin/applications[/:id]`, `POST /admin/applications/:id/approve|reject`, permissão `applications.manage`). As fases seguintes acrescentam rotas em `src/routes/`, com os testes de contrato correspondentes em `tests/`, sem mexer no que já está — o esquema pode crescer (novas colunas/tabelas), mas o que existe aqui não muda de forma incompatível sem motivo.

Nota sobre `/uploads` (Fase 9): o armazenamento é local em disco (`api/uploads/`, fora do git), com um ficheiro de metadados `<id>.json` ao lado de cada ficheiro — não há object storage real ligado nesta fase. O contrato (`{ id, url, content_type }`) é o mesmo que a Fase de produção terá de cumprir ao trocar para S3/R2/etc.; só a implementação de `src/lib/uploads.ts` muda.

Nota sobre migrações concorrentes: as Fases 7 e 8 correram em paralelo e cada uma gerou a sua própria migração "0001" (nomes diferentes, mas o mesmo índice). Como o migrador do Drizzle para Neon HTTP decide o que aplicar comparando só a data (`when`) de cada migração com a da última aplicada — não por hash por migração —, a segunda a ser reconciliada teve de ser renumerada para "0002" com uma assinatura temporal igual à que já tinha sido gravada como aplicada na base de dados (ambas já lá estavam, aplicadas directamente por cada agente antes da fusão). Ao gerar migrações em paralelo no futuro, convém sincronizar com a branch principal (e os `meta/*.json`) antes de cada `db:generate`, para não repetir esta reconciliação manual.

Nota para quem continuar: as Fases 2 e 3 correram em paralelo e colidiram em `src/lib/mailer.ts` e `src/lib/otp.ts` (duas implementações independentes do mesmo problema). Ficou um `sendMail()` só (`src/lib/mailer.ts`, usado pelas duas rotas) e dois módulos de OTP lado a lado — `src/lib/otp.ts` (fluxo completo da app móvel: cria, verifica, conta tentativas) e `src/lib/otp-admin.ts` (primitivas usadas directamente em `admin-auth.ts`). Vale a pena unificar os dois um dia, mas não foi feito agora para não arriscar os testes já a passar.
