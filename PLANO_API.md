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

- **Um projecto Neon**, branch `main` (produção) e uma branch por ambiente de pré-produção; o branching do Neon (cópia instantânea, copy-on-write) serve bem para **branches de PR** da API — cada pull request ganha uma base de dados isolada com os mesmos dados de semente, sem custo de cópia completa.
- **Pooling**: usar o *connection pooler* do Neon (compatível com PgBouncer, modo `transaction`) — obrigatório em ambiente serverless (Lambda/Vercel/Fly com muitas instâncias curtas); ligação directa só para migrações.
- **Região**: a mais próxima do serviço da API (não há região Neon em África; Europa — `eu-central-1` — é a mais próxima de Angola em latência).
- **Esquemas Postgres** dentro do mesmo database, para organizar sem separar fisicamente os dados:
  - `auth` — contas, sessões, tokens, códigos
  - `ops` — domínio operacional (pedidos, prestadores, viaturas, pagamentos, zonas) — serve a app e o painel
  - `crm` — clientes empresariais, contactos, oportunidades, campanhas, automações, tickets do CRM
  - `admin` — utilizadores do painel, auditoria, definições da plataforma

## 2. Stack da API

- **Serviço Node.js + TypeScript** à parte dos dois repositórios de frontend (os dois já pressupõem isto: `DEFAULT_API_URL = "http://localhost:4000/api"` em `data/leva-ja/index.ts` e `data/crm/index.ts`, porta diferente da app Next.js).
- **Fastify** (recomendado) — leve, rápido, bom suporte a validação com Zod (`@fastify/type-provider-zod`), que já é a biblioteca de esquemas usada nos dois frontends. Alternativas: NestJS (mais estrutura, mais peso) ou Express (mais simples, menos ferramentas prontas).
- **ORM: Drizzle** (recomendado) — TypeScript-first, sem geração de código separada, driver HTTP/serverless próprio para Neon (`@neondatabase/serverless` + `drizzle-orm/neon-http`), migrações simples (`drizzle-kit`). Alternativa: Prisma (mais maduro, mas o cliente gerado pesa mais em arranque serverless).
- **Onde vive**: um repositório novo (ex. `geekfabio/angoleva-api`), não dentro de `levaja-dashboard` nem de `leva-ja` — os dois consumidores já tratam a API como um serviço externo.

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

O CRM (`/`, fora de `/admin`) ainda não tem guarda de sessão própria nesta fase (mock). Duas opções a decidir com o utilizador:
1. Reaproveitar a sessão de administração (um utilizador do painel também usa o CRM) — mais simples, um só login.
2. Conta de CRM à parte (equipa comercial, sem acesso a `/admin`) — precisa de um novo papel e de uma tabela de permissões própria.

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

- **CRM**: sessão própria ou partilhada com o painel de administração (secção 4)?
- **Framework da API**: Fastify (proposto) vs NestJS vs Express.
- **ORM**: Drizzle (proposto) vs Prisma.
- **Onde hospedar o serviço** (o Neon é só a base de dados): Render, Railway, Fly.io ou VPS próprio.
- **E-mail transaccional** para os códigos OTP e de verificação de registo: Resend, Amazon SES ou outro.
- **Processador de pagamentos real** (EMIS/Multicaixa Express) e **notificações push** (Expo) ficam marcados como «ainda por integrar» em `docs/api.md` — fora do âmbito inicial deste plano, a juntar depois da Fase 3.
