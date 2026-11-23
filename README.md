# AngoLeva — painel de administração e CRM

Repositório web do **AngoLeva**, a app de Luanda que liga clientes a prestadores de reboque, carga com pickup, mudança pequena e mudança de casa.

- **Painel de administração** em `/admin`: pedidos, mapa operacional, prestadores e documentos, clientes, finanças, preços e zonas, suporte e SOS, utilizadores do painel e auditoria. Todo em português de Portugal.
- **CRM comercial** em `/`: clientes, contactos, oportunidades, follow-up, actividades, conversas, campanhas, automações e tickets.

Next.js 16 · React 19 · Tailwind CSS 4 · TanStack Query · Zustand. A especificação do painel está em [LEVA_JA_ADMIN.md](LEVA_JA_ADMIN.md).

## Como correr

Requer Node.js 22.18 ou mais recente (os testes correm TypeScript por type stripping).

```bash
npm install
npm run dev
```

Abra [http://localhost:3000/admin](http://localhost:3000/admin) para o painel ou [http://localhost:3000](http://localhost:3000) para o CRM.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build de produção |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Verificação de tipos |
| `npm test` | Testes (`node:test`), incluindo os de contrato do painel |

Antes de dar uma alteração por terminada, os quatro (`tsc`, `lint`, `test`, `build`) têm de passar.

## Entrar no painel

O painel fala sempre com a API real (`api/`, base de dados Neon). O login é por e-mail e código de 6 dígitos, sem palavra-passe. Enquanto não há fornecedor de e-mail, o código aparece no log da API, ou é fixo se a API tiver `OTP_FIXED_CODE` definido (ver `api/README.md`). O primeiro administrador cria-se com `npm run db:seed` em `api/`. Cada papel só vê as suas secções.

| Papel | O que vê |
| --- | --- |
| Administrador | Tudo, incluindo utilizadores do painel, sessões e acessos, integrações e auditoria |
| Operações | Pedidos, disputas, mapa, candidaturas, prestadores e qualidade, frotas, documentos, clientes, zonas e SOS |
| Suporte | Ocorrências com prazos e satisfação, SOS, avaliações baixas, clientes e protecção de dados |
| Finanças | Receita, facturação, reembolsos, levantamentos, lotes de pagamento e transacções |

Só o CRM comercial (`/`, `/oportunidades`, …) mantém dados de demonstração, até cada módulo passar a ler da API (`NEXT_PUBLIC_CRM_DATA_SOURCE`).

## Dados: padrão Repository

```
data/leva-ja/
  repositories/   contratos por área e RepositoryError
  http/           implementação REST com fetch
  index.ts        repositories(): sempre HTTP
tests/support/leva-ja-mock/   MockDatabase dos testes de contrato; a aplicação não a importa
```

Páginas e componentes nunca importam a implementação: usam os hooks de `hooks/admin/`, que chamam `repositories()`. As regras de negócio (estados, preços, elegibilidade e permissões) estão em `lib/leva-ja/` e são as mesmas na UI e nos testes.

### Configuração

1. Copie `.env.example` para `.env.local` (fica fora do Git) e ajuste `NEXT_PUBLIC_API_URL` (por omissão `http://localhost:4000`, sem `/api`).
2. Arranque a API (`cd api && npm run dev`) e o painel (`npm run dev`).

O cookie de sessão do painel é `SameSite=Strict` e `Secure`: o painel e a API têm de partilhar o mesmo site (em desenvolvimento, `localhost:3000` e `localhost:4000`; em produção, subdomínios do mesmo domínio, por HTTPS).

A implementação HTTP usa o cookie de sessão e o cabeçalho `x-csrf-token` nas escritas, converte os erros em `RepositoryError` (`400`/`422` → `validation` com `issues`, `401` → `unauthorized`, `403` → `forbidden`, `404` → `not_found`, `409` → `invalid_transition`, falha de rede ou `5xx` → `network`) e actualiza as listas por consulta periódica.

Endpoints usados (os da app móvel mantêm os nomes):

| Área | Endpoints |
| --- | --- |
| Sessão | `POST /auth/request-code`, `POST /auth/login` (com `otp` quando o segundo factor é exigido), `GET /auth/session`, `POST /auth/logout` |
| Pedidos | `GET /admin/requests?status=&kind=&zone=&from=&to=&q=&page=`, `GET /admin/requests/:id`, `POST /admin/requests/:id/cancel\|reassign\|dispute\|force-complete` |
| Prestadores | `GET /admin/providers`, `GET /providers/:id`, `GET /providers/:id/earnings\|reviews`, `POST /admin/providers/:id/approve\|suspend\|reactivate` |
| Documentos | `GET /admin/documents`, `POST /admin/documents/:id/approve\|reject` |
| Clientes | `GET /admin/clients`, `GET /clients/:id`, `POST /admin/clients/:id/block\|unblock` |
| Finanças | `GET /admin/revenue`, `GET /admin/withdrawals`, `POST /admin/withdrawals/:id/approve\|reject\|paid`, `GET /admin/transactions` |
| Preços e zonas | `GET\|PUT /admin/pricing`, `GET\|POST /admin/zones`, `PUT\|DELETE /admin/zones/:id` |
| Suporte | `GET /admin/tickets`, `POST /admin/tickets/:id/assign\|reply\|resolve`, `GET /admin/sos`, `POST /admin/sos/:id/acknowledge\|resolve`, `GET /admin/reviews/low`, `GET /admin/tickets/response-summary\|satisfaction` |
| Protecção de dados | `GET /admin/privacy-requests`, `GET /admin/privacy-requests/summary`, `GET /admin/privacy-requests/:id`, `GET /admin/privacy-requests/:id/export`, `POST /admin/privacy-requests/:id/start\|complete\|reject` |
| Segurança | `GET /admin/security/sessions`, `POST /admin/security/sessions/:id/revoke`, `GET /admin/security/access-log?result=&q=&page=`, `POST /admin/users/:id/two-factor` |
| Integrações | `GET\|POST /admin/integrations/keys`, `POST /admin/integrations/keys/:id/revoke`, `GET\|POST /admin/integrations/webhooks`, `POST /admin/integrations/webhooks/:id/activate\|deactivate\|test` |
| Contas empresariais | `GET\|POST /admin/business-accounts`, `GET /admin/business-accounts/candidates`, `GET /admin/business-accounts/:id`, `PUT /admin/business-accounts/:id/contract`, `POST /admin/business-accounts/:id/members`, `POST /admin/business-accounts/:id/members/:clientId/remove`, `POST /admin/business-accounts/:id/statements/:month/paid`, `POST /admin/business-accounts/:id/suspend\|reactivate` |
| Promoções | `GET\|POST /admin/promotions`, `GET /admin/promotions/:id`, `POST /admin/promotions/:id/pause\|resume\|end` |
| Comunicações | `GET\|POST /admin/broadcasts`, `POST /admin/broadcasts/estimate`, `POST /admin/broadcasts/:id/schedule\|send\|cancel` |
| Relatórios | `GET /admin/reports/:kind?from=&to=` (`operations`, `finance`, `providers`, `zones`, `business`) |
| Operação | `GET /admin/requests/scheduled?state=&days=&zone=`, `GET /admin/metrics/sla?from=&to=`, `GET /admin/metrics/heatmap?kind=&days=&hour=` |
| Sinistros | `GET\|POST /admin/claims`, `GET /admin/claims/summary`, `GET /admin/claims/:id`, `GET /admin/requests/:id/claims`, `POST /admin/claims/:id/review\|notes\|approve\|reject\|paid` |
| Candidaturas | `GET /admin/applications`, `GET /admin/applications/summary`, `GET /admin/applications/:id`, `POST /admin/applications/:id/documents\|interview\|inspection\|advance\|approve\|reject` |
| Frotas | `GET\|POST /admin/fleets`, `GET /admin/fleets/:id`, `POST /admin/fleets/:id/drivers`, `POST /admin/fleets/:id/drivers/:providerId/remove`, `POST /admin/fleets/:id/suspend\|reactivate` |
| Qualidade | `GET /admin/quality`, `GET /admin/quality/:providerId`, `GET /admin/penalties`, `POST /admin/providers/:id/penalties`, `POST /admin/penalties/:id/revoke` |
| Facturação | `GET /admin/invoices`, `GET /admin/invoices/export`, `GET /admin/invoices/:id`, `GET /admin/settlements?from=&to=`, `POST /admin/settlements/:id/received\|resolve`, `GET /admin/cash-debts`, `GET\|POST /admin/cash-debts/:providerId/deposits` |
| Lotes de pagamento | `GET\|POST /admin/payout-batches`, `GET /admin/payout-batches/:id`, `POST /admin/payout-batches/:id/send\|paid\|cancel` |
| Disputas | `GET /admin/disputes?state=&category=&q=&page=`, `GET /admin/disputes/summary`, `POST /admin/disputes/:id/notes\|resolve`, `PUT /admin/disputes/:id/category` |
| Reembolsos | `GET /admin/refunds?status=&source=&q=&page=`, `GET /admin/refunds/summary`, `GET /admin/requests/:id/refunds`, `POST /admin/refunds`, `POST /admin/refunds/:id/approve\|reject\|paid` |
| Métricas e auditoria | `GET /admin/metrics?from=&to=`, `GET /admin/metrics/attention`, `GET /admin/audit` |
| Utilizadores | `GET\|POST /admin/users`, `POST /admin/users/:id/role\|activate\|deactivate` |

As acções críticas enviam `reason` no corpo, que o servidor deve guardar na auditoria.

### Mapa e rotas

Os mapas usam tiles do OpenStreetMap e as rotas pelas estradas vêm de um servidor OSRM (`GET /route/v1/driving/{lng},{lat};…?overview=full&geometries=geojson`). Se o servidor de rotas falhar, o painel mostra uma estimativa em linha recta e avisa. Os dois endereços são configuráveis:

```bash
NEXT_PUBLIC_MAP_TILES_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_ROUTING_URL=https://router.project-osrm.org
```

Os servidores públicos servem só para demonstração (as regras de uso do OpenStreetMap e do OSRM não permitem tráfego de produção). Em produção, aponte para servidores próprios ou contratados e mantenha a atribuição «© Colaboradores do OpenStreetMap».

## Estrutura

```
app/(app)/              CRM
app/admin/login/        login do painel
app/admin/(painel)/     guarda de sessão e de papel, sidebar, topbar e páginas
components/_ui/         primitivas (button, dialog, table, skeleton…)
components/_common/     peças partilhadas (sidebar, charts/, async-state, pagination, confirm-dialog)
components/admin/       módulos do painel, shell/ e shared/
components/<modulo>/    módulos do CRM
data/leva-ja/           repositórios do painel
lib/leva-ja/            regras de negócio do painel
hooks/admin/            hooks de TanStack Query
tests/                  testes (leva-ja-*.test.ts para o painel)
```

## Documentação

| Ficheiro | O que tem |
| --- | --- |
| [LEVA_JA_ADMIN.md](LEVA_JA_ADMIN.md) | Especificação do painel, decisões e estado |
| [CLAUDE.md](CLAUDE.md) | Contexto do produto, regras de código, marca e stack |
| [FEATURES.md](FEATURES.md) | O que cada módulo faz |
| [ROADMAP.md](ROADMAP.md) | Fases de entrega e critérios de conclusão |
| [AGENTS.md](AGENTS.md) | Regras para agentes e notas da versão do Next.js |

## Marca

Logótipo provisório em `public/assets/images/_common/brand/leva-ja-logo.svg` (e o símbolo `leva-ja-mark.svg`). Primário `#0A8743`, verde vivo `#12A150` (só em elementos sem texto), tinta `#0F2A1E`, fundo `#F8F9F7`. Os tokens estão em `app/globals.css`.

## Deploy num só contentor

O `Dockerfile` da raiz compila o painel, a versão web da app (sob `/app`) e a API, e arranca tudo num contentor atrás de um Caddy na porta `8080`:

- `/` → painel
- `/app/` → app (versão web)
- `/api/*` → API (o prefixo `/api` é retirado; o WebSocket fica em `/api/realtime`)

Como tudo está no mesmo domínio, não há CORS entre painel e API, e o cookie de sessão funciona (`SameSite=Strict`).

Variáveis de execução (no Coolify, em Environment Variables): `DATABASE_URL`, `DB_SCHEMA=angoleva`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SESSION_SECRET` (32 caracteres ou mais), `TRUST_PROXY=true`, e `OTP_FIXED_CODE` enquanto não houver e-mail. Com `OTP_FIXED_CODE` definido, quem souber o e-mail de um administrador entra com esse código: retirar assim que o e-mail estiver ligado.

Ao arrancar, o contentor corre `db:migrate` e `db:seed` (ambos idempotentes). Se algum falhar, o contentor para.

O build clona a app pelo argumento `APP_REF` (por omissão `real-data-no-mocks`; depois de fundir a PR, `main`).
