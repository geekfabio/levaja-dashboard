# Plano da API — Neon, autenticação e integração

Plano para a API que serve o **painel web** (admin + CRM, este repositório) e a **app móvel** (`geekfabio/leva-ja`), com **Neon** (Postgres serverless) como base de dados única.

Os dois lados já têm o contrato que a API tem de cumprir, escrito como especificação executável:

| Lado | Contrato | Onde |
| --- | --- | --- |
| App móvel (cliente + prestador) | REST + tempo real, `snake_case`, testado | `leva-ja/docs/api.md`, `src/data/api/dto.ts`, `src/data/mock/server.ts` |
| Painel admin | Interfaces TypeScript por módulo | `data/leva-ja/repositories/*.ts`, tipos em `types/leva-ja.ts` |
| CRM | Interfaces TypeScript por módulo | `data/crm/repositories/*.ts` |

Este plano não inventa um contrato novo: liga os três ao mesmo servidor e à mesma base de dados.

## 1. Base de dados — Neon

- **Decidido:** em vez de um projecto Neon novo, usamos o que já está disponível neste ambiente (`DATABASE_URL`, projecto `umoja-ai`, região `eu-central-1`), **partilhado com outra aplicação**. Por isso todos os dados do AngoLeva vivem isolados num schema Postgres próprio, **`angoleva`** — nunca em `public`, que já tem tabelas de outra app (Prisma). Ligação pelo **driver HTTP do Neon** (`@neondatabase/serverless`), porque este ambiente não permite TCP directo ao Postgres (só HTTPS sai pelo proxy); é também o modo certo para um runtime serverless.
- **Pooling**: o endpoint já usado é o *pooler* do Neon (`-pooler` no hostname, compatível com PgBouncer).
- **Esquemas Postgres** dentro do mesmo database `umoja-ai`, só dentro de `angoleva`, para organizar sem separar fisicamente os dados:
  - `auth` — contas, sessões, tokens, códigos
  - `ops` — domínio operacional (pedidos, prestadores, viaturas, pagamentos, zonas) — serve a app e o painel
  - `crm` — clientes empresariais, contactos, oportunidades, campanhas, automações, tickets do CRM
  - `admin` — utilizadores do painel, auditoria, definições da plataforma

## 2. Stack da API

- **Serviço Node.js + TypeScript**, processo próprio na porta 4000 (os dois frontends já pressupõem isto: `DEFAULT_API_URL = "http://localhost:4000/api"` em `data/leva-ja/index.ts` e `data/crm/index.ts`).
- **Fastify** — leve, rápido, validação com Zod, a mesma biblioteca já usada nos dois frontends.
- **ORM: Drizzle** (`drizzle-orm/neon-http` + `drizzle-kit`) — TypeScript-first, sem geração de código separada, fala HTTP com o Neon (necessário neste ambiente).
- **Onde vive:** `api/`, pasta própria dentro deste repositório (`levaja-dashboard`), não um repositório novo — decisão tomada para começar mais depressa. Processo e `package.json` próprios (não é uma rota Next.js), por isso tem o seu próprio `node_modules`, testes e CI. Pode ser extraído para um repositório dedicado mais tarde sem mudar o contrato.

## 3. Modelo de dados

Fonte de verdade a cruzar (já escrita, só falta transcrever para tabelas):

- `leva-ja/src/types/domain.ts` + `src/data/api/dto.ts` — modelo operacional do lado da app
- `levaja-dashboard/types/leva-ja.ts` — `AdminUser`, `Ticket`, `SosAlert`, `Withdrawal`, `PricingRule`, `PricingConfig`, `AuditLogEntry`, contas de administração
- `data/crm/repositories/*.ts` — `Company`, `Contact`, `Opportunity`, `Campaign`, `Automation`, `DiscountOffer`, etc.

Núcleo de tabelas (nomes indicativos):

| Área | Tabelas |
| --- | --- |
| Contas | `accounts` (coluna `kind`: `client` \| `provider` \| `admin`), `sessions`, `refresh_tokens`, `otp_codes`, `devices` (push) |
| Operacional | `providers`, `vehicles`, `service_requests`, `service_request_events` (timeline), `payments`, `wallets`, `wallet_transactions`, `zones`, `provider_documents` |
| Comunicação | `chat_threads`, `chat_messages`, `notifications` |
| Suporte | `tickets`, `sos_alerts`, `emergency_contacts`, `help_articles` |
| CRM | `crm_companies`, `crm_contacts`, `crm_opportunities`, `crm_activities`, `crm_tickets`, `crm_campaigns`, `crm_automations`, `crm_discount_offers`, `crm_audit_log` |
| Administração | `admin_users`, `admin_audit_log`, `platform_settings`, `pricing_rules` |
| Candidaturas | `provider_applications` (candidatura → aprovação cria a linha em `providers`) |

## 4. Autenticação e criação de contas

Uma tabela `accounts` partilhada (email, password hash quando aplicável, `kind`) com duas vertentes de sessão — **não** é preciso unificar o fluxo, só a tabela:

### App móvel — clientes e prestadores

Fluxo já especificado em `docs/api.md`, sem alterações a propor:

- **Login**: `POST /auth/login` com `email + password + role`; JWT de acesso curto (ex. 15 min) + *refresh token* longo (ex. 30 dias), rotação do refresh a cada uso (o antigo é invalidado).
- **Registo (cliente)**: auto-registo — `POST /auth/register` → código por email → `POST /auth/verify` → sessão. Senha com `bcrypt`/`argon2`.
- **Registo (prestador)**: **não** é auto-registo livre. Segue a candidatura já modelada no painel (`data/leva-ja/repositories/applications.ts`, módulo «Candidaturas»): o candidato submete a candidatura (fora da app, ou num fluxo futuro na app), um admin aprova no painel, e **a aprovação cria a conta** `kind: provider` + envia o convite por email/SMS com a palavra-passe inicial ou um link de activação.
- Armazenamento no dispositivo: como já documentado (`EXPO_PUBLIC_SECURE_STORAGE`), sem mudanças do lado do servidor.

### Painel web — administração

Fluxo já especificado em `data/leva-ja/repositories/admin-auth.ts`, sem password:

- **Login por código (OTP)**: `requestCode(email)` → código por email → `login(email, code, otp?)` → sessão. Mais seguro para um painel interno (sem password a vazar/reutilizar), e já é o que o mock faz.
- **Sessão no browser**: cookie `httpOnly` + `Secure` + `SameSite=Strict` (em vez de token Bearer em JS, que fica exposto a XSS) — a API assina um JWT e o browser nunca o lê directamente; mutações (POST/PATCH/DELETE) exigem um cabeçalho CSRF à parte.
- **Criação de contas de administrador**: nunca auto-registo. Um admin existente cria outro (`createUser` já no contrato), com `reason` obrigatório para a auditoria — replicar essa obrigatoriedade no servidor, não só na UI.
- **Papéis**: `admin`, `operations`, `support`, `finance`, já modelados em `lib/leva-ja/permissions.ts` (secções do painel por papel). O servidor tem de aplicar as mesmas regras nos endpoints — nunca confiar só na UI para esconder um botão.

### CRM

**Decidido:** o CRM reaproveita a sessão de administração (secção anterior) — a mesma conta `kind: "admin"`, o mesmo cookie, o mesmo middleware `authenticateAdmin`. Um só login para toda a equipa interna (painel + CRM), sem um segundo sistema de sessões a manter. Se mais tarde for preciso dar acesso ao CRM a alguém sem acesso ao `/admin`, resolve-se com um papel novo na mesma matriz de permissões (`lib/leva-ja/permissions.ts`), não com uma conta/sessão à parte.

## 5. Formato de fio

- **Um formato canónico só**, o que já está especificado e testado para a app: `snake_case`, datas ISO 8601 UTC, valores monetários inteiros com sufixo `_kz`, envelopes `{ "data": ... }` / `{ "data": [...], "meta": { "count": n } }`, erros `{ "error": { "code", "message", "details"? } }`.
- Os repositórios HTTP do painel e do CRM (`data/leva-ja/http/`, `data/crm/http/`) ainda não têm essa camada — hoje passam objectos directamente. Ao ligar à API real, ganham um `mappers.ts` próprio (JSON `snake_case` ↔ os tipos `camelCase` que os componentes já usam), tal como a app móvel já tem em `src/data/api/mappers.ts`. É trabalho novo, mas pequeno e isolado — a UI não muda.

## 6. Tempo real

- **Fase 1 — polling**: `GET /requests/changes?since=`, `GET /threads/:id/changes?since=`, `GET /providers/:id/state` — já suportado nos dois lados (painel já faz polling nos repositórios mock/HTTP; a app também).
- **Fase 2 — WebSocket**: protocolo já especificado em `docs/api.md` (`auth`, `subscribe`/`unsubscribe`, `ping`/`pong`, `event`, `error`), tópicos `requests`, `providers/<id>`, `threads/<id>` — um único servidor WebSocket serve o painel (pedidos novos, mapa ao vivo) e a app.

## 7. Plano de integração por fases

| Fase | Entrega | Critério de concluído |
| --- | --- | --- |
| 0 | Provisionar Neon (projecto, branches, pooler); criar o repositório da API; Fastify + Drizzle + CI; ligação à base com `drizzle-kit` | `GET /health` responde com ligação à BD confirmada |
| 1 | Esquema (`auth`, `ops`, `crm`, `admin`) + migrações + dados de semente (os mesmos de `data/leva-ja/mock` e `leva-ja/src/mocks`, para comparar) | Migrações correm do zero numa branch Neon nova |
| 2 | Autenticação: as duas vertentes (app e painel) + testes de contrato contra `docs/api.md` e `admin-auth.ts` | `repositories.contract.test.ts` da app passa com `EXPO_PUBLIC_DATA_SOURCE=http` apontado ao servidor de testes |
| 3 | Domínio operacional (pedidos, prestadores, viaturas, pagamentos, zonas, chat) — contrato da app móvel | Os três percursos E2E da app (`npm run test:e2e`) passam em modo `http` |
| 4 | Painel e CRM: mappers `snake_case`↔`camelCase` em `data/leva-ja/http` e `data/crm/http`, ligados aos mesmos endpoints | `npm test` do painel passa com `NEXT_PUBLIC_DATA_SOURCE=http` contra o servidor de testes |
| 5 | Tempo real por WebSocket (substitui o polling nos dois lados) | Reconexão, resubscrição e fallback para polling testados |
| 6 | Corte: staging primeiro, depois produção; manter o modo `mock` disponível para demonstrações | `NEXT_PUBLIC_DATA_SOURCE=http` / `EXPO_PUBLIC_DATA_SOURCE=http` em produção, sem alterações de UI |

## 8. Decisões em aberto

- **Onde hospedar o serviço em produção** (o Neon é só a base de dados): Render, Railway, Fly.io ou VPS próprio. Em dev/staging corre neste ambiente, processo próprio.
- **E-mail transaccional** para os códigos OTP e de verificação de registo: Resend, Amazon SES ou outro.
- **Base de dados partilhada**: por agora usamos `umoja-ai` com o schema `angoleva` isolado (ver `api/README.md`). Se o AngoLeva crescer a ponto de precisar de isolamento total (backup, limites de tamanho, plano de pagamento próprios), migrar para um projecto Neon dedicado é só um `pg_dump`/`pg_restore` do schema.
- **Processador de pagamentos real** (EMIS/Multicaixa Express) e **notificações push** (Expo) ficam marcados como «ainda por integrar» em `docs/api.md` — fora do âmbito inicial deste plano, a juntar depois da Fase 3.
