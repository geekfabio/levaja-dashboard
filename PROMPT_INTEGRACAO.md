# Prompt — implementar tudo o que falta (API, mobile e web)

Este ficheiro é um **prompt pronto a usar**, não um registo do que já foi feito. Cola-o inteiro numa conversa nova (ou usa-o para orquestrar agentes) quando quiseres avançar com o resto do trabalho. Não foi executado — é só o enunciado.

---

## Prompt

Estás a trabalhar em três repositórios do AngoLeva:

- `levaja-dashboard` — painel de administração + CRM (Next.js) **e** a API real em `api/` (Fastify + Drizzle + Neon, schema Postgres `angoleva`, dentro da base de dados partilhada `umoja-ai` deste ambiente — nunca tocar em `public`).
- `leva-ja` — app móvel (Expo/React Native), cliente + prestador.

O estado actual está documentado em `PLANO_API.md` e `api/README.md` (lista as fases já feitas e o que cada uma cobre). Lê os dois antes de começar. A tarefa agora é fechar tudo o que ainda falta, em três frentes que podem avançar em paralelo: **A** (backend), **B** (mobile) e **C** (web). Cada uma tem a sua lista de módulos; trata cada módulo como uma unidade: desenho → implementação → testes reais → validação, antes de passar ao seguinte. Nunca dês um módulo por feito sem `tsc`, `lint` e os testes a passar.

### Regras transversais

1. **Base de dados partilhada.** Todo o trabalho do backend (`api/`) usa o schema `angoleva` dentro da Neon já configurada neste ambiente (`$DATABASE_URL`). Nunca criar, alterar nem consultar tabelas em `public` — é de outra aplicação.
2. **Esquema só cresce.** Podes acrescentar colunas/tabelas (`npm run db:generate` dentro de `api/`), nunca alterar ou remover uma coluna já usada por um módulo existente sem motivo forte — e nesse caso, pergunta antes.
3. **Migrações concorrentes.** Se mais que uma frente gerar uma migração ao mesmo tempo, os números `0001`/`0002`/… podem colidir (já aconteceu nas Fases 7 e 8 — ver a nota em `api/README.md`). Sincroniza com a branch antes de cada `db:generate`; se colidir, renumera manualmente e confirma que `meta/_journal.json` fica com os `when` a bater com o que já está realmente aplicado na base de dados (o migrador do Drizzle para Neon HTTP decide o que aplicar só pela data, não por hash por ficheiro).
4. **Testes reais, sempre com limpeza.** Todos os testes do backend correm contra a base de dados a sério (sem mocks). Usa emails/ids únicos por teste e apaga tudo o que criares no fim (`after()`/`finally`).
5. **Formato de fio da API**: `snake_case`, envelopes `{ "data": ... }` / `{ "data": [...], "meta": {...} }`, erros `{ "error": { "code", "message", "details"? } }` — consistente com o que já existe em `api/src/lib/envelope.ts`.
6. **Sem bibliotecas novas por conta própria.** As que já estão (Fastify, Drizzle, Zod, argon2, jose, `@fastify/*`) chegam para quase tudo. Se precisares mesmo de uma nova (ex. um SDK de um fornecedor de pagamentos ou de e-mail), pergunta antes de instalar.
7. **Critério de concluído, por módulo**: a partir de `api/`, `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros; a partir da raiz de `levaja-dashboard` (mobile e web), os equivalentes de cada projecto (ver secções B e C).

---

### A — Backend (`levaja-dashboard/api/`): módulos em falta

O núcleo (autenticação, pedidos, prestadores, pagamentos, chat, uploads/candidaturas) já está feito. Falta:

**A1. Painel administrativo — resto do núcleo começado na Fase 7**

Contratos em `data/leva-ja/repositories/{operations,requests,security,metrics,settings}.ts` (fora de `api/`, neste mesmo repositório). Mocks de referência em `data/leva-ja/mock/`.

- **Operações**: agendados, SLA, mapa de calor (`data/leva-ja/repositories/operations.ts`). Precisa de decidir como guardar `zone_id` por pedido (`service_requests` não tem essa coluna ainda) e as definições de despacho (prazo de agendamento, metas de SLA) — provavelmente em `platform_settings`, a reutilizar como a Fase 7 já fez para preços.
- **Pedidos — o resto**: reatribuição (`reassignCandidates`, `reassign`), abrir disputa (`openDispute`), forçar conclusão (`forceComplete`). Precisam de um campo de disputa em `service_requests` (acrescentar, não alterar o que já existe) e da lógica de elegibilidade de `lib/leva-ja/eligibility.ts`.
- **Segurança — o resto**: registo de acessos (`accessLog`, sem tabela própria ainda) e activação de 2FA (`setTwoFactor`, precisa de coluna em `accounts` ou numa tabela `admin_two_factor` à parte).
- **Métricas — o resto**: `attention()` (depende de reembolsos, levantamentos, disputas e alertas SOS — ver módulos ainda por começar abaixo).
- **Definições da plataforma** (`data/leva-ja/repositories/settings.ts`, `lib/leva-ja/settings.ts`): 11 secções com validação própria — é um módulo inteiro, trata-o como tal.

**A2. Painel administrativo — módulos nunca começados**

Cada um tem o seu contrato em `data/leva-ja/repositories/<nome>.ts` e o mock de referência em `data/leva-ja/mock/<nome>.ts`:

`finance`, `billing`, `claims`, `refunds`, `disputes`, `support`, `business`, `promotions`, `communications`, `integrations`, `privacy`, `fleets`, `quality`.

Usa a mesma receita das Fases 7/8: autenticação por `authenticate-admin`, permissões de `admin-roles.ts`, CSRF nas mutações, auditoria em `adminAuditLog` nas acções sensíveis, erros replicando o que o mock já valida. Prioriza pelos módulos com mais dependências de outros (ex. `finance`/`billing` antes de `metrics.attention()`, que depende deles).

**A3. CRM — módulos em falta**

Contratos em `data/crm/repositories/{activities,conversations,documents,campaigns,automations,offers}.ts`, mocks em `data/crm/mock/`. Nota: `campaigns` e `automations` têm edição fina de rascunho (blocos, passos) — replica só as acções discretas e auditáveis pelo backend (criar, submeter, activar/pausar, etc.), não cada edição de campo, como já documentado em `CLAUDE.md`.

**A4. Testes de contrato ponta-a-ponta**

Depois de A1–A3 (ou em paralelo com o que já está feito): aponta a app móvel (`EXPO_PUBLIC_DATA_SOURCE=http`) e o painel/CRM (`NEXT_PUBLIC_DATA_SOURCE=http`) a um servidor da API a correr localmente, e corre as suites de contrato dos dois lados contra o servidor real (não contra os mocks). Corrige o que divergir — no backend ou nos `dto.ts`/mappers do lado do cliente — sem mudar ecrãs.

---

### B — Mobile (`leva-ja`): ligar à API real + o que falta

Hoje a app só fala com `src/data/mock/`. Falta:

**B1. Cutover para a API real**

Segue exactamente os passos já documentados em `leva-ja/docs/arquitectura.md`, secção "Mudar de mocks para a API":
1. `EXPO_PUBLIC_API_URL` a apontar para o servidor local (`http://localhost:4000` ou o que a Fase A estiver a servir), `EXPO_PUBLIC_DATA_SOURCE=http`.
2. Correr `repositories.contract.test.ts` contra o servidor real e corrigir o que divergir (no backend, nunca nos ecrãs).
3. `EXPO_PUBLIC_SECURE_STORAGE=device` para builds Android/iOS reais.

**B2. WebSocket** (`leva-ja/docs/api.md`, "Ainda por integrar")

O protocolo já está especificado (tópicos `requests`, `providers/<id>`, `threads/<id>`, mensagens `auth`/`subscribe`/`ping`/`event`/`error`) e a app já sabe falar WebSocket (`src/data/api/WebSocketRealtime.ts`) com recurso automático a polling. Falta o **servidor**: implementa-o em `api/` (ex. `@fastify/websocket`), aplicando as mesmas regras de acesso dos endpoints REST equivalentes (quem pode subscrever cada tópico). Depois, `EXPO_PUBLIC_REALTIME_URL` liga a app a ele — sem mudanças do lado do cliente.

**B3. Notificações push** (idem)

Regista o token Expo em `POST /devices` (já implementado no backend, Fase 6) e implementa o **envio** do lado do servidor: quando um pedido muda de estado (`api/src/routes/requests.ts`, `payments.ts`), além de gravar o evento, envia a notificação via Expo Push API para os tokens registados da conta certa. Os textos já estão em `leva-ja/src/features/notifications/push.ts` — usa-os, não inventes novos.

**B4. Processador de pagamentos real** (idem)

EMIS / Multicaixa Express: emissão de referência real (hoje é simulada em `api/src/lib/payments.ts`) e recepção da notificação de confirmação do banco (hoje é um `setTimeout`). Tokenização de cartões antes de qualquer cobrança real. **Não avances nesta peça sem credenciais reais do processador** — se não as tiveres neste ambiente, documenta o que falta e para aqui; não simules "mais realista" sem pedido explícito.

**B5. Câmara e localização reais**

Já implementadas do lado do dispositivo (`src/data/device/DeviceCamera.ts`, `DeviceLocation.ts`) — só faltam `EXPO_PUBLIC_CAMERA=device` e `EXPO_PUBLIC_LOCATION=device` nas builds reais, depois de B1 confirmar que `/uploads` (Fase A9, já feito) funciona a sério.

---

### C — Web (`levaja-dashboard`, painel + CRM): ligar à API real + o que falta

Hoje `data/leva-ja/http/` e `data/crm/http/` são **esqueletos**: passam os dados tal como os componentes já os usam (`camelCase`), sem nenhuma camada de tradução para o formato real da API (`snake_case`). Falta:

**C1. Camada de mapeamento — painel**

Para cada repositório em `data/leva-ja/repositories/*.ts` que já tiver endpoint na API (ver secção A), cria o par DTO+mapper em `data/leva-ja/http/`, ao estilo do que a app móvel já tem em `leva-ja/src/data/api/{dto.ts,mappers.ts}`: esquemas Zod para validar cada resposta da API, conversão `snake_case` (fio) ↔ `camelCase` (o que os componentes já esperam) nos dois sentidos. Os componentes **não mudam** — só o que está por trás de `data/leva-ja/http/`.

**C2. Camada de mapeamento — CRM**

O mesmo, para `data/crm/http/*.ts`, módulo a módulo, à medida que cada um ganhar endpoint na API (secção A3).

**C3. Guarda de sessão do CRM**

`app/(app)/layout.tsx` hoje não tem nenhuma guarda de sessão — está aberto. A decisão já tomada (`PLANO_API.md`, secção 4) é o CRM reaproveitar a sessão de administração (a mesma conta, o mesmo cookie, o mesmo `/admin/auth/login`). Falta pôr isso em prática do lado do Next.js: a guarda de `app/admin/(painel)/layout.tsx` já existe — usa o mesmo padrão (ou extrai um componente partilhado) para `app/(app)/layout.tsx`, sem duplicar a lógica de sessão.

**C4. Cutover**

`NEXT_PUBLIC_DATA_SOURCE=http`, `NEXT_PUBLIC_API_URL` a apontar para o servidor da Fase A, primeiro em ambiente de testes. Corre `tests/leva-ja-*.test.ts` e `npm test` contra o servidor real nalgum perfil de CI/local, confirma que o painel e o CRM funcionam a sério no browser (não só os testes), e só depois considera produção.

---

## Ordem sugerida

Dentro de cada frente, os módulos com mais dependências de outros vêm por último (ex.: `metrics.attention()` depois de `finance`/`refunds`/`disputes`; C1/C2 depois de cada módulo correspondente estar pronto em A). Entre frentes, A, B e C podem avançar em paralelo — B e C ambas dependem só do que já está feito na API, não uma da outra.
