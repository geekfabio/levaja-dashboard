# Painel administrativo Leva Já — especificação e estado do trabalho

Documento de passagem de testemunho. Contém o pedido original, as decisões já tomadas com o utilizador e o ponto exacto onde o trabalho parou. Lê-o inteiro antes de escrever código.

> `CLAUDE.md`, `AGENTS.md`, `FEATURES.md` e `ROADMAP.md` ainda descrevem o CRM antigo da **Alimenta Angola**. As regras de código continuam válidas: sem comentários, `Button` sempre com `variant` explícito, sem estilos de fonte em `p`/`h1`–`h3`, cores só por token, `Asset` para imagens e nenhuma biblioteca nova sem autorização. O produto, a marca e o idioma mudaram para o que está descrito aqui. Quando este documento e esses ficheiros se contradisserem, vale este documento.

---

## 1. Pedido original

**Contexto.** Painel administrativo do **Leva Já**, uma app móvel de Luanda (Angola) que liga clientes a prestadores de **reboque**, **carga com pickup**, **mudança pequena** e **mudança de casa**. A app móvel (React Native + Expo) usa dados mockados atrás do padrão Repository. O painel segue a mesma regra: **ainda não há backend**, todos os dados são mockados, e trocar os mocks pela API real tem de ser só trocar uma implementação.

**Idioma, moeda e datas**
- Todos os textos do painel em **português de Portugal (pt-PT)**: «ecrã», «utilizador», «registo», «facturação», «activo».
- Kwanza formatado como `12 500 Kz`: espaço como separador de milhares e sem casas decimais. Usar `formatKz` de `lib/format.ts`.
- Datas em `dd/MM/yyyy HH:mm`, fuso `Africa/Luanda`. Usar `formatDateTimeNumeric` de `lib/format.ts`.

**Regras gerais**
- Reutilizar os componentes do CRM. Não criar duplicados. Quando faltar um componente, criá-lo no mesmo estilo e na mesma pasta dos existentes.
- O painel vive na sua própria área, `/admin`.

### Tipos

Os tipos já estão escritos em `types/leva-ja.ts`. Para além dos tipos da app, o ficheiro inclui `AdminUser` (papéis `admin`, `operations`, `support` e `finance`), `Ticket` (estados `open`, `in_progress` e `resolved`, com prioridade), `SosAlert`, `Withdrawal`, `PricingRule`, `PricingConfig` e `AuditLogEntry`, mais as contas de administração `ProviderAccount` e `ClientAccount`.

### Regras de negócio (iguais às da app)

**Estados e rótulos** (estão em `lib/leva-ja/status.ts`):

| Estado | Rótulo |
| --- | --- |
| `searching` | A procurar prestador |
| `assigned` | Prestador atribuído |
| `en_route` | A caminho |
| `arrived` | No local |
| `pickup_confirmed` | Recolha confirmada |
| `in_transit` | Em transporte |
| `delivered` | Entregue |
| `paid` | Pago |
| `rated` | Concluído |
| `cancelled` | Cancelado |

**Máquina de estados**
- A sequência é `searching → assigned → en_route → arrived → pickup_confirmed → in_transit → delivered → paid → rated`.
- Só se cancela em `searching`, `assigned`, `en_route` ou `arrived`, e sempre com motivo.
- O admin nunca salta estados. As acções de operação são três: reatribuir prestador, cancelar com motivo e forçar a conclusão em disputa. Todas exigem motivo e ficam no log de auditoria.

**Serviços**

| Código | Nome |
| --- | --- |
| `tow` | Reboque de viatura |
| `cargo` | Carga com pickup |
| `small_move` | Mudança pequena |
| `house_move` | Mudança de casa |

**Preço**

| Serviço | Base | Por km |
| --- | --- | --- |
| `tow` | 8 000 Kz | 250 Kz |
| `cargo` | 5 500 Kz | 250 Kz |
| `small_move` | 9 000 Kz | 300 Kz |
| `house_move` | 18 000 Kz | 400 Kz |

- Fórmula: `base + km × preço/km + extras`, arredondado a múltiplos de 500 Kz.
- Taxa da plataforma: 500 Kz por pedido.
- Comissão: 15 % do valor do serviço. O ganho do prestador é o valor do serviço menos a comissão.
- Nas mudanças de casa, o prestador pode fazer uma proposta de preço, que o cliente aceita ou recusa.

**Prestadores**
- Um prestador só recebe pedidos se cumprir as três condições: está online, tem os documentos verificados e tem cobertura compatível (zonas e serviços).
- Os documentos são quatro: carta de condução, BI, documento da viatura e seguro.

**Pagamentos:** referência bancária (Multicaixa), cartão ou numerário.

### Páginas do painel

1. **Login (mock).** Credenciais `admin@levaja.ao` com o código `123456`. Cada papel só vê as suas secções.
2. **Visão geral.**
   - KPIs do dia e da semana: pedidos, em curso, concluídos, cancelados, receita da plataforma (taxas + comissões), volume transaccionado, tempo médio até atribuição, prestadores online e avaliação média.
   - Gráficos: pedidos por dia, distribuição por serviço, funil por estado e receita.
   - Lista «precisa de atenção»: pedidos parados em `searching`, alertas SOS abertos, documentos por validar e levantamentos pendentes.
3. **Pedidos.**
   - Tabela com filtros: estado, serviço, zona, intervalo de datas, método de pagamento e pesquisa por código, cliente ou prestador.
   - Detalhe: cliente, prestador, trajecto num mapa mock, linha temporal, decomposição do preço, proposta, comprovativo, pagamento e avaliação.
   - Acções: reatribuir, cancelar com motivo e marcar disputa.
4. **Mapa operacional (mock).** Prestadores online e pedidos activos sobre Luanda, em SVG ou canvas, com posições simuladas que se actualizam periodicamente.
5. **Prestadores.**
   - Lista com estado (online, offline ou suspenso), verificação, avaliação, viatura, zonas e ganhos.
   - Detalhe: documentos (aprovar, ou recusar com motivo), cobertura, carteira e transacções, avaliações e histórico.
   - Acções: aprovar, suspender e reactivar.
6. **Validação de documentos.** Fila dos documentos `pending` e `needs_update`, com pré-visualização mock, botões aprovar e recusar, e alerta para os documentos que expiram nos próximos 30 dias.
7. **Clientes.** Lista e detalhe (pedidos, métodos de pagamento, avaliações dadas, ocorrências), com bloqueio e desbloqueio.
8. **Finanças.**
   - Receita por período e por serviço.
   - Levantamentos: aprovar, rejeitar e marcar como pago.
   - Transacções, com exportação para CSV.
9. **Preços e zonas.**
   - Edição da base e do preço por km de cada serviço, dos extras, da taxa e da comissão, com pré-visualização de uma estimativa.
   - Zonas: nome, centro e raio.
   - Tudo fica registado na auditoria.
10. **Suporte.**
    - Ocorrências: atribuir, responder e resolver.
    - Alertas SOS em destaque, com o tempo desde a abertura.
    - Avaliações baixas (≤ 2 estrelas) para revisão.
11. **Utilizadores do painel e auditoria.** Gestão de administradores e papéis, e log de auditoria filtrável (quem, o quê, quando e motivo).

**Requisitos transversais às páginas**
- Todas as listas assíncronas têm esqueleto de carregamento, estado vazio, estado de erro com «Tentar novamente» e paginação.
- As acções destrutivas pedem confirmação.
- O feedback é dado por toast.

### Dados: padrão Repository (obrigatório)

```
data/leva-ja/
  repositories/   contratos, um por área (FEITO)
  mock/           MockDatabase em memória semeada, latência ~300 ms, falhas de
                  rede opcionais, cópias defensivas, subscribe (tempo real simulado)
  http/           esqueleto REST com fetch; erros convertidos em RepositoryError
  index.ts        repositories() escolhe mock ou http por NEXT_PUBLIC_DATA_SOURCE
                  (mock por omissão)
```

**Regras**
- Componentes e páginas nunca importam mocks. Usam hooks de TanStack Query sobre `repositories()`.
- As regras de negócio (máquina de estados, motivo obrigatório, validação de preços, saldo do levantamento) são aplicadas na implementação mock, como o servidor fará.
- Os erros chegam como `RepositoryError` com `code`, que pode ser `network`, `not_found`, `invalid_transition`, `forbidden`, `validation` ou `unauthorized`.
- **Testes de contrato do mock:**
  - transição inválida recusada;
  - cancelamento sem motivo recusado;
  - aprovar o último documento torna o prestador elegível;
  - levantamento acima do saldo recusado.

**Endpoints**
- Já usados pela app móvel (manter os nomes coerentes):
  - `/auth/*`
  - `/providers/:id/availability|coverage|documents/:docId|earnings|reviews|nearby-requests`
  - `/clients/:id` e `/clients/:id/addresses`
  - `/sos`
- Propostos para o admin:
  - `GET /admin/requests?status=&kind=&zone=&from=&to=&q=&page=`
  - `POST /admin/requests/:id/cancel`
  - `POST /admin/requests/:id/reassign`
  - `POST /admin/documents/:id/approve|reject`
  - `POST /admin/withdrawals/:id/approve|reject|paid`
  - `PUT /admin/pricing`
  - `GET /admin/metrics?from=&to=`
  - `GET /admin/audit`

### Dados mock

- **Volumes:** cerca de 40 clientes, 25 prestadores (documentos em estados variados e alguns suspensos) e 300 pedidos nos últimos 60 dias, em todos os estados e serviços.
- **Zonas:** Ingombota, Maianga, Alvalade, Talatona, Kilamba, Viana, Cazenga, Benfica, Camama e Rangel.
- **Coerência:** os preços seguem a fórmula e as linhas temporais respeitam a máquina de estados.
- **Formatos:** telefones `+244 9XX XXX XXX`, matrículas `LD-12-34-AB` e nomes angolanos (Armando Silva, João Manuel, Ana Neto…).
- **Semente fixa:** o gerador produz os mesmos dados a cada arranque.
- **Reposição:** as definições têm a opção «Repor dados de demonstração», disponível só em modo mock.

### Visual

- **Tema do projecto com os acentos Leva Já:**

  | Uso | Cor |
  | --- | --- |
  | Primário (botões com texto branco, AA) | `#0A8743` |
  | Verde vivo, só em elementos sem texto | `#12A150` |
  | Tinta | `#0F2A1E` |
  | Fundo | `#F8F9F7` |
  | Bordas | `#E3E9E5` |
  | Perigo | `#D92D20` |
  | Aviso | `#B45309` |
  | Info | `#2457A8` |

- **Badges de estado** com cor e texto:
  - `searching` em aviso;
  - `assigned`, `en_route` e `in_transit` em info;
  - estados concluídos em sucesso;
  - `cancelled` em perigo.
- **Acessibilidade WCAG AA:** foco visível, teclado nas tabelas e nos modais, e `aria-label` nos botões que só têm ícone.
- **Responsivo:** pensado primeiro para desktop e utilizável em tablet.

### Fases (um commit pequeno por fase)

1. Inventário e plano. **Feito.**
2. Tipos, contratos, MockDatabase, gerador e testes de contrato. **Feito.**
3. Layout do painel (sidebar e topbar do CRM), login mock e permissões por papel. Inclui o rebrand do CRM e a remoção de módulos (secção 2). **Feito.**
4. Visão geral e pedidos (lista, detalhe e acções). **Feito.**
5. Prestadores e validação de documentos. **Feito.**
6. Clientes, finanças e levantamentos. **Feito.**
7. Preços, zonas, suporte e SOS, auditoria e utilizadores. **Feito.**
8. Esqueleto HTTP, README (como correr, como ligar à API, credenciais de demonstração) e revisão final. **Feito.**

### Critérios de conclusão

- `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build` passam sem erros.
- Nenhuma página importa mocks directamente.
- Todas as páginas têm estados de carregamento, vazio, erro e sucesso.
- Todos os textos do painel estão em pt-PT.
- As acções críticas têm confirmação, motivo e registo na auditoria.
- O CRM existente continua a funcionar, já com a marca Leva Já.

---

## 2. Decisões tomadas com o utilizador

- **CRM existente:** passa para a marca Leva Já (nome, logótipo, cores e metadata) e perde a **cadeia Cash & Carry**. Remove-se:
  - as páginas Vendas (`/vendas`), Cotações/Encomendas (`/cotacoes`), Previsão (`/previsao`) e Relatórios (`/relatorios`);
  - tudo o que depende delas:
    - o simulador de vendas e o diálogo de associar vendas;
    - o catálogo de produtos (separador nas definições);
    - as comissões;
    - a secção Compras no detalhe do cliente;
    - a integração de vendas (`lib/integrations/sales`);
    - os gatilhos de automação baseados em compras;
    - os testes `quotes` e `reports`, e as partes de `analytics`, `engine` e `triggers` que dependem de vendas.

  Ficam: Clientes, Oportunidades, Follow-up, Actividades, Contactos, Conversas, Campanhas, Automações, Tickets, Auditoria e Definições.

  **Antes de apagar `components/forecast/`**, move os gráficos reutilizáveis (`chart-card`, `chart-tooltip` e os gráficos SVG) para `components/_common/charts/`. O painel vai usá-los.

  Actualiza também `CLAUDE.md`, `AGENTS.md`, `FEATURES.md` e `ROADMAP.md`, que ainda falam da Alimenta Angola. Depois de remover, confirma que não ficaram imports partidos (`grep`) e que os testes que restam passam.
- **Hooks:** TanStack Query (`@tanstack/react-query`), já autorizado. O `QueryClientProvider` fica no layout do admin.
- **Git:** o repositório foi criado nesta sessão. Faz um commit por fase em pt-PT, e cada mensagem termina com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Logótipo:** cria um wordmark SVG provisório «Leva Já» em `public/assets/images/_common/brand/leva-ja-logo.svg`.
- **Rotas:**
  - `app/admin/login/` fica fora da guarda;
  - `app/admin/(painel)/layout.tsx` tem a guarda de sessão, a verificação de papel, a sidebar e a topbar reutilizadas do CRM, e o `QueryClientProvider`;
  - as páginas são `/admin` (visão geral), `pedidos[/id]`, `mapa`, `prestadores[/id]`, `documentos`, `clientes[/id]`, `financas`, `precos`, `suporte`, `utilizadores`, `auditoria` e `definicoes`.
- **Dados em `data/leva-ja/`**, não em `src/data/`. O projecto não tem `src/` e o alias `@/*` aponta para a raiz.
- **Componentes:**
  - Os módulos ficam em `components/admin/<modulo>/` e seguem o padrão de `components/companies/` (`header/`, `toolbar/`, `table/`, `detail/`).
  - As peças genéricas que faltam vão para as pastas existentes: `components/_ui/skeleton.tsx`, `components/_common/async-state.tsx` (vazio, erro e «Tentar novamente»), `components/_common/pagination.tsx` e `components/_common/confirm-dialog.tsx` (com campo de motivo obrigatório).
- **Reutilizar:**
  - `_ui/`: `button`, `table`, `tag` (badges), `dialog`, `sheet` (drawer), `select`, `tabs`, `field`, `input`, `textarea`, `checkbox`, `popover`, `dropdown-menu`, `avatar`, `count-badge` e `scroll-area`;
  - `_common/`: `module-header` (topbar), `header-actions`, `sidebar/*`, `totals/totals-bar`, `stat-tile`, `sparkline`, `filter-menu`, `detail-section`, `form-section` e `ranked-bar-list`;
  - `toast()` de `stores/toast-store.ts` e `downloadCsv` de `lib/csv.ts`.
- **Tema:** os tokens Leva Já ficam em `app/globals.css` com âmbito `[data-area="admin"]` (tema claro, fundo `#F8F9F7`) e são expostos via `@theme inline`. A fonte continua a **Geist**, porque o projecto já a define.
- **Contas de demonstração:** todas usam o código `123456`.

  | E-mail | Papel |
  | --- | --- |
  | `admin@levaja.ao` | admin |
  | `operacoes@levaja.ao` | operations |
  | `suporte@levaja.ao` | support |
  | `financas@levaja.ao` | finance |

---

## 3. Regras de implementação já decididas (aplicar no mock)

**Preço** (`lib/leva-ja/pricing.ts`)
- O valor do serviço é `round500(base + km×perKm + extras)`. Na decomposição, o arredondamento é absorvido pela parcela `distance`, para que a soma das parcelas bata certo com o total.
- `total = valor do serviço + platformFee`.
- `providerEarning = valor do serviço − round(valor do serviço × commissionRate)`.
- `platformRevenue = comissão + taxa`.
- Quando há proposta aceite, usa-se `priceWithProposal`.

**Acções sobre pedidos**
- **Cancelar:** só nos estados de `CANCELLABLE_STATUSES` e com motivo não vazio. Caso contrário, devolve `invalid_transition` ou `validation`.
- **Reatribuir:**
  - estados permitidos: `searching`, `assigned`, `en_route` ou `arrived`;
  - o novo prestador tem de ser elegível (`lib/leva-ja/eligibility.ts`) e diferente do actual;
  - o estado volta a `assigned` e o evento fica na timeline.
- **Disputa:** pode abrir-se nos estados `pickup_confirmed` a `rated`, com motivo.
- **Forçar conclusão:**
  - exige uma disputa aberta e um estado de `FORCE_COMPLETE_STATUSES`;
  - percorre os estados em falta **um a um** até `rated`, acrescentando cada passo à timeline (não salta estados);
  - fecha a disputa com o motivo como resolução.

**Auditoria**
- Todas as acções anteriores, e as dos prestadores, documentos, clientes, levantamentos, preços, zonas, suporte e utilizadores, criam uma `AuditLogEntry`.
- Cada entrada leva o actor da sessão, o motivo e, quando se aplica, as alterações (`changes`).

**Permissões**
- `lib/leva-ja/permissions.ts` é aplicado na UI, que esconde secções e botões, **e** no mock, que devolve `forbidden`.
- Um pedido sem sessão devolve `unauthorized`.

**Carteira do prestador**
- Por cada pedido `paid`/`rated` há duas transacções: `earning` (+ valor do serviço) e `fee` (− comissão).
- Em pedidos `delivered`, essas transacções ficam `pending`.
- O `balance` é a soma das transacções concluídas menos os levantamentos pagos.

**Levantamentos**
- `requestWithdrawal` recusa (`validation`) quando o pedido excede `balance − levantamentos pendentes`.
- `approve` volta a validar o saldo.
- `paid` desconta o valor ao saldo e cria uma transacção `withdrawal`.

**Documentos**
- `approve` exige `validUntil` no futuro e passa o documento a `verified`.
- `reject` exige motivo e passa o documento a `needs_update`.
- `verified` (do `Provider`) é `true` se os 4 documentos forem válidos.

**Preços e zonas**
- `pricing.update` valida com `validatePricingConfig` e exige motivo.
- Criar, editar e remover zonas exige motivo. Uma zona com prestadores ou pedidos activos não pode ser removida (`validation`).

**MockDatabase**
- **Semente:** semente fixa com PRNG mulberry32. As datas são relativas ao dia actual de Luanda, para que os KPIs «de hoje» tenham dados; o gerador recebe `now` como parâmetro para os testes.
- **Persistência:** o estado vai para `localStorage` (com `try/catch` e degradação silenciosa), para que «Repor dados de demonstração» faça sentido.
- **Leituras:** devolvem cópias com `structuredClone`.
- **Latência e falhas:** `latencyMs` é 300 por omissão e 0 nos testes. A `failureRate` é configurável em `repositories().demo.configure` e, quando dispara, devolve `network`.
- **Tempo real:** `subscribe(listener)` emite eventos por tópico. Um ticker, que só corre enquanto houver subscritores, move os prestadores online e de vez em quando cria um pedido `searching` ou avança um pedido activo um passo.
- **Inclui ainda:** alguns pedidos parados em `searching` há 15–40 min, 2 SOS abertos, cerca de 25 ocorrências, cerca de 20 levantamentos (6 pendentes), alguns prestadores `pending_approval` e suspensos, 2 clientes bloqueados e cerca de 30 entradas de auditoria iniciais.

**Ambiente**
- **Node 24 corre os testes em TS por type stripping:**
  - usa sempre `import type` para tipos;
  - não uses `enum`, `namespace` nem parameter properties nas classes;
  - os testes ficam em `tests/leva-ja-*.test.ts`, correm com `node:test` e resolvem o alias `@/` por `tests/resolve-alias.mjs`.
- **Next.js 16.3 (lê `node_modules/next/dist/docs/`):** `params` é uma `Promise` (`await params`), e o middleware chama-se agora `proxy`. Não é preciso, porque a guarda corre no cliente.

---

## 4. Estado actual

Todas as fases estão feitas, com um commit por fase. No fim de cada uma, `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build` passaram.

**O que existe**
- `data/leva-ja/mock/`: gerador com semente fixa (`seed.ts`), `MockDatabase` (latência, falhas, cópias defensivas, `localStorage` com deslocação das datas para o dia actual, `subscribe` e ticker), uma implementação por repositório e `createMockRepositories`.
- `data/leva-ja/http/`: cliente REST com conversão de erros e todos os repositórios; `repositories()` escolhe por `NEXT_PUBLIC_DATA_SOURCE` (mock por omissão) e `NEXT_PUBLIC_API_URL`.
- Páginas: `/admin/login`, `/admin`, `pedidos[/id]`, `mapa`, `prestadores[/id]`, `documentos`, `clientes[/id]`, `financas`, `precos`, `suporte`, `utilizadores`, `auditoria` e `definicoes`.
- Hooks de TanStack Query em `hooks/admin/`; peças genéricas em `components/_ui/skeleton.tsx`, `components/_common/{async-state,pagination,confirm-dialog}.tsx` e `components/_common/charts/`.
- Testes: `tests/leva-ja-contracts.test.ts` (regras de negócio, permissões, auditoria), `leva-ja-domain.test.ts` (preço, formatação, máquina de estados, gerador, CSV) e `leva-ja-http.test.ts` (endpoints e erros).

**Decisões tomadas durante a implementação**
- Os timestamps do painel são ISO em UTC; os dias (`YYYY-MM-DD`) são do fuso de Luanda.
- O saldo reservado de um prestador inclui os levantamentos pendentes **e** aprovados ainda não pagos.
- Aprovar um prestador exige os quatro documentos válidos; suspender exige que não tenha pedido em curso.
- O contrato de suporte ganhou `assignees()`, para o papel Suporte poder atribuir ocorrências sem acesso à gestão de utilizadores.
- A classe ABC do CRM (campanhas e automações) passou a ser calculada pelo valor em carteira, porque as vendas foram removidas.
- O mapa (operacional, detalhe do pedido, cobertura do prestador e zonas) usa tiles do OpenStreetMap num componente próprio, `components/admin/map/osm-map/`, sem biblioteca nova: projecção Web Mercator em `lib/map-projection.ts`, arrastar, roda do rato, duplo clique, teclado (setas, + e −), botões «Angola» e «Luanda», agrupamento de marcadores abaixo do zoom 11, escala e atribuição «© Colaboradores do OpenStreetMap». O centro fica limitado à volta de Angola (zoom 5 a 18).
- As viaturas aparecem com o ícone da classe (reboque, pickup, carrinha, camião), verdes quando livres e azuis quando em serviço; as posições mexem com o ticker do mock.
- As rotas vêm do `RoutingRepository` (`data/leva-ja/repositories/routing.ts`): implementação OSRM em `data/leva-ja/http/routing.ts`, usada pelo mock e pelo HTTP, com cache e, se o serviço falhar, a estimativa de `lib/leva-ja/routing.ts` (linha recta × 1,35 a 28 km/h). A duração é ajustada à classe da viatura (camião e reboque × 1,25, carrinha × 1,1). O plano da rota (`routePlan`) liga o prestador à recolha até chegar e à entrega quando está em transporte.
- Endereços configuráveis: `NEXT_PUBLIC_MAP_TILES_URL` (por omissão `https://tile.openstreetmap.org/{z}/{x}/{y}.png`) e `NEXT_PUBLIC_ROUTING_URL` (por omissão o servidor público de demonstração do OSRM). Os dois servidores públicos são só para demonstração; em produção usa-se um servidor de tiles e um OSRM próprios ou contratados.

- Disputas e reembolsos (`lib/leva-ja/refunds.ts`, repositórios `disputes` e `refunds`): só pedidos pagos são reembolsáveis; o total reembolsado (pendente, aprovado ou pago) nunca passa o valor pago; o pedido tem de ser feito no prazo de `payouts.refundWindowDays` (30 dias) desde o pagamento; acima de `payouts.refundDualApprovalAbove` (20 000 Kz) quem pediu não pode aprovar. Reembolso pago e imputado ao prestador cria uma transacção «Reembolso» negativa na carteira; se for da plataforma, desconta à receita (`totals.refunds`). Uma disputa está fora do prazo depois de 72 h aberta; resolvê-la com reembolso exige também `refunds.request` e cria o reembolso por aprovar. O estado do mock passou à versão 3.

**Por decidir com o utilizador**
- Ficheiros da marca antiga que já não são usados ou continuam com o logótipo da Alimenta Angola: `public/assets/images/_common/brand/alimenta-angola-logo.png`, `app/favicon.ico` e `app/apple-icon.png`. Não foram apagados nem substituídos porque não estavam na lista de remoção aprovada.
- `UI_ROADMAP.md` ainda descreve o CRM da Alimenta Angola.
- `components/admin/shared/luanda-map.tsx` (o mapa SVG anterior) deixou de ser usado com o mapa OpenStreetMap. Não foi apagado, por não estar na lista aprovada.
- Código que ficou sem uso depois da remoção de Previsão e Relatórios: `components/_common/at-risk-list.tsx`, `lib/reports.ts` e `lib/dashboard.ts`. Compilam e não foram apagados, por não estarem na lista aprovada.
