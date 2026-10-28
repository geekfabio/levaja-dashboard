@AGENTS.md

# AngoLeva — CRM e painel de administração

Repositório web do **AngoLeva**, a app móvel de Luanda que liga clientes a prestadores de **reboque**, **carga com pickup**, **mudança pequena** e **mudança de casa**. Tem duas áreas:

| Área | Rotas | O que é |
| --- | --- | --- |
| **Painel de administração** | `/admin/*` | Operação da plataforma: pedidos, mapa, prestadores, documentos, clientes, finanças, preços e zonas, suporte, utilizadores e auditoria. Especificação completa em `LEVA_JA_ADMIN.md`. |
| **CRM** | `/`, `/oportunidades`, `/campanhas`… | CRM comercial herdado do template `kargul-starter`, já com a marca AngoLeva: clientes, contactos, oportunidades, follow-up, actividades, conversas, campanhas, automações, tickets, auditoria e definições. |

Antes de escrever código, lê também:

| Ficheiro | O que tem |
| --- | --- |
| `LEVA_JA_ADMIN.md` | Especificação do painel, decisões tomadas e estado do trabalho. **Prevalece sobre os restantes.** |
| `FEATURES.md` | O que cada módulo faz, nas duas áreas |
| `ROADMAP.md` | Fases de entrega e critérios de conclusão |
| `AGENTS.md` | Regras de execução para agentes + notas da versão do Next.js |
| `.builderrules` | As 7 regras de base do template |

## Regras do produto

1. **Idioma.** O painel `/admin` está todo em **português de Portugal (pt-PT)**: «ecrã», «utilizador», «registo», «facturação», «activo». O CRM mantém o texto que já tem. Nenhuma string em inglês chega ao ecrã. `<html lang="pt-AO">`.
2. **Identificadores ficam em inglês.** Ficheiros, componentes, variáveis, tipos e chaves de API em inglês (`requests`, `providerEarning`). Só o texto visível é traduzido.
3. **Moeda: Kwanza.** No painel usa `formatKz` de `lib/format.ts` (`12 500 Kz`, espaço nos milhares, sem decimais). No CRM, `formatMoney`. Nunca `toLocaleString("en-US")`.
4. **Datas: fuso `Africa/Luanda`.** No painel, `formatDateTimeNumeric` (`dd/MM/yyyy HH:mm`) e `formatDateNumeric`. Os timestamps do painel são ISO em UTC.
5. **Telefones de Angola.** `+244 9XX XXX XXX`. Validação e E.164 em `lib/phone.ts`.
6. **Regras de negócio num só sítio.** Estados, preço, elegibilidade e permissões vivem em `lib/leva-ja/` e são usadas pela UI e pela implementação mock dos repositórios.

## Dados — padrão Repository

```
data/leva-ja/
  repositories/   contratos (interfaces) por área e RepositoryError
  mock/           MockDatabase semeada, regras de negócio, tempo real simulado
  http/           implementação REST (troca por NEXT_PUBLIC_DATA_SOURCE=http)
  index.ts        repositories()
```

- Páginas e componentes **nunca** importam `data/leva-ja/mock`. Usam os hooks de TanStack Query em `hooks/admin/`, que chamam `repositories()`.
- Os erros chegam como `RepositoryError` com `code` (`network`, `not_found`, `invalid_transition`, `forbidden`, `validation`, `unauthorized`).
- O CRM está a migrar para o mesmo padrão Repository, em `data/crm/` (contratos + mock que simula a API + esqueleto HTTP, troca por `NEXT_PUBLIC_DATA_SOURCE=http`), consumido pelos hooks de TanStack Query em `hooks/crm/` sob o `CrmProviders`. Áreas já migradas: **tickets**, **oportunidades** e **clientes** (`companies`) — nestas, a store Zustand do módulo passou a guardar só estado de UI (filtros, diálogos, selecção). **Excepção de `companies`:** seis outras stores (`automation-runs`, `rename-zone`, `calendar-sync`, `documents`, `field`, `activities`) dependem de leitura síncrona da lista de clientes para simulações internas (automações, sincronização de calendário, nomes). Por isso `data/crm/mock/companies.ts` opera sobre o estado partilhado em `stores/companies-store.ts` (e não um array próprio): a escrita passa pelo repositório (regras, `RepositoryError`, pronta para a API real); a leitura continua reactiva via Zustand, para essas stores não precisarem de mudar. As áreas ainda não migradas (contactos, conversas, campanhas, actividades, automações) continuam com dados fictícios em `data/*.ts` e stores Zustand em `stores/`.

## Marca

Logótipo provisório em `public/assets/images/_common/brand/leva-ja-logo.svg` (wordmark) e `leva-ja-mark.svg` (símbolo).

| Token | Hex | Uso |
| --- | --- | --- |
| `primary` / `brand` | `#0A8743` | Botões com texto branco (AA) |
| `brand-vivid` | `#12A150` | Verde vivo, só em elementos sem texto |
| `foreground` (painel) | `#0F2A1E` | Tinta |
| `background` (painel) | `#F8F9F7` | Fundo |
| `border` (painel) | `#E3E9E5` | Bordas |
| `danger` | `#D92D20` | Perigo |
| `warning` | `#B45309` | Aviso |
| `info` | `#2457A8` | Informação |

Os tokens do painel estão em `app/globals.css`, no bloco `:root[data-area="admin"]` (tema claro), e são expostos via `@theme inline`. O atributo `data-area` é posto no `<html>` por `components/admin/shell/admin-area.tsx`, para que diálogos e menus em portal herdem o tema. Não introduzas cores inline — todas passam por token.

## Stack

- **Next.js 16.3 (App Router) + React 19 + TypeScript** — `app/`. `params` é uma `Promise`; o middleware chama-se `proxy`.
- **Tailwind CSS 4** — tokens e escala tipográfica em `app/globals.css`
- **TanStack Query** — dados do painel (`QueryClientProvider` em `app/admin/(painel)/layout.tsx`)
- **Zustand** — estado de UI e do CRM em `stores/`
- **Radix UI + cmdk** — primitivas em `components/_ui/`
- **Motion + Rive + Lottie** — via o componente `Asset`

## Estrutura

```
app/(app)/              CRM
app/admin/login/        login do painel (fora da guarda)
app/admin/(painel)/     guarda de sessão e papel, sidebar e topbar, páginas do painel
components/_ui/         primitivas reutilizáveis (button, dialog, table, skeleton…)
components/_common/     chrome partilhado (sidebar, module-header, charts/, async-state, pagination, confirm-dialog)
components/admin/       um folder por módulo do painel, mais shell/ e shared/
components/<modulo>/    módulos do CRM
data/leva-ja/           repositórios do painel
lib/leva-ja/            regras de negócio do painel
hooks/admin/            hooks de TanStack Query do painel
tests/leva-ja-*.test.ts testes de contrato e de domínio do painel
```

Cada módulo segue o padrão de `components/companies/`: um `<modulo>.tsx` que compõe `header/`, `toolbar/`, `table/`, `detail/` e os diálogos.

## Regras de código

Herdadas do template (`.builderrules`) e obrigatórias:

1. Usa a estrutura de secção já existente nos módulos (ver `components/companies/companies.tsx`).
2. **Não acrescentes estilos de fonte a `p`, `h1`, `h2`, `h3`** — a escala está global em `app/globals.css` (`@layer base`). Para variantes usa `.lead-style`, `.caption-style`, `.eyebrow-style`.
3. Qualquer botão passa pelo componente `Button` de `components/_ui/button.tsx`, **sempre com `variant` explícito**.
4. `max-width` de títulos e parágrafos em `em`.
5. Tailwind primeiro; CSS à parte só quando o Tailwind não chega.
6. Bordas entre elementos empilhados com `divide-*` / `outline`, não `border` repetida.
7. **Sem comentários no código.** O nome diz o que faz.

Mais:

8. SVGs: `<Image />` por caminho; componente SVGR só quando o ícone precisa de ser estilizado por CSS.
9. Toda a imagem, vídeo, Rive e Lottie passa pelo componente `Asset`.
10. Ícones exportados do Figma — não instales bibliotecas de ícones.
11. Easings partilhados: tokens `--ease-power*` de `app/globals.css`.
12. SEO do CRM por `lib/seo.ts` → `pageMetadata()`. O painel não é indexado (`robots: noindex`).
13. Acessibilidade WCAG AA no painel: foco visível, teclado nas tabelas e nos modais, `aria-label` nos botões só com ícone.

## Dados sensíveis

- Nunca faças commit de chaves de API, dumps de base de dados ou listas de contactos. `.env.local` fica fora do Git.
- `data/` e `data/leva-ja/mock/` só têm dados fictícios.
- O envio real de e-mails e SMS do CRM exige `MESSAGING_LIVE=true` e confirmação explícita.
