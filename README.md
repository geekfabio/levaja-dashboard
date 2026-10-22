# Leva Já — painel de administração e CRM

Repositório web do **Leva Já**, a app de Luanda que liga clientes a prestadores de reboque, carga com pickup, mudança pequena e mudança de casa.

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

## Credenciais de demonstração

Em modo mock, todas as contas usam o código **`123456`**. Cada papel só vê as suas secções.

| E-mail | Papel | O que vê |
| --- | --- | --- |
| `admin@levaja.ao` | Administrador | Tudo, incluindo utilizadores do painel e auditoria |
| `operacoes@levaja.ao` | Operações | Pedidos, mapa, prestadores, documentos, clientes, zonas e SOS |
| `suporte@levaja.ao` | Suporte | Ocorrências, SOS, avaliações baixas e clientes |
| `financas@levaja.ao` | Finanças | Receita, reembolsos, levantamentos e transacções |

Os dados de demonstração são gerados com uma semente fixa (os mesmos a cada arranque), ficam guardados no navegador e podem ser repostos em **Definições → Repor dados de demonstração**. Nas mesmas definições pode simular uma rede lenta ou com falhas para ver os estados de carregamento e de erro.

## Dados: padrão Repository

```
data/leva-ja/
  repositories/   contratos por área e RepositoryError
  mock/           MockDatabase semeada com as regras de negócio e tempo real simulado
  http/           implementação REST com fetch
  index.ts        repositories(): escolhe mock ou http
```

Páginas e componentes nunca importam a implementação: usam os hooks de `hooks/admin/`, que chamam `repositories()`. As regras de negócio (estados, preços, elegibilidade e permissões) estão em `lib/leva-ja/` e são as mesmas na UI e no mock.

### Ligar à API real

1. Crie `.env.local` (fica fora do Git):

   ```bash
   NEXT_PUBLIC_DATA_SOURCE=http
   NEXT_PUBLIC_API_URL=https://api.levaja.ao
   ```

2. Reinicie o servidor. `repositories()` passa a usar `data/leva-ja/http/`, sem mudanças na UI.

A implementação HTTP envia `Authorization: Bearer <token>` com o token devolvido por `POST /auth/login`, converte os erros em `RepositoryError` (`400`/`422` → `validation` com `issues`, `401` → `unauthorized`, `403` → `forbidden`, `404` → `not_found`, `409` → `invalid_transition`, falha de rede ou `5xx` → `network`) e, como ainda não há canal de tempo real, actualiza as listas por consulta periódica.

Endpoints usados (os da app móvel mantêm os nomes):

| Área | Endpoints |
| --- | --- |
| Sessão | `POST /auth/request-code`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| Pedidos | `GET /admin/requests?status=&kind=&zone=&from=&to=&q=&page=`, `GET /admin/requests/:id`, `POST /admin/requests/:id/cancel\|reassign\|dispute\|force-complete` |
| Prestadores | `GET /admin/providers`, `GET /providers/:id`, `GET /providers/:id/earnings\|reviews`, `POST /admin/providers/:id/approve\|suspend\|reactivate` |
| Documentos | `GET /admin/documents`, `POST /admin/documents/:id/approve\|reject` |
| Clientes | `GET /admin/clients`, `GET /clients/:id`, `POST /admin/clients/:id/block\|unblock` |
| Finanças | `GET /admin/revenue`, `GET /admin/withdrawals`, `POST /admin/withdrawals/:id/approve\|reject\|paid`, `GET /admin/transactions` |
| Preços e zonas | `GET\|PUT /admin/pricing`, `GET\|POST /admin/zones`, `PUT\|DELETE /admin/zones/:id` |
| Suporte | `GET /admin/tickets`, `POST /admin/tickets/:id/assign\|reply\|resolve`, `GET /admin/sos`, `POST /admin/sos/:id/acknowledge\|resolve`, `GET /admin/reviews/low` |
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
