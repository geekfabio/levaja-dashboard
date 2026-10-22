@AGENTS.md

# Alimenta Angola CRM

CRM interno da **Alimenta Angola — Cash and Carry** (distribuição grossista e retalho alimentar, Luanda / Angola). Construído sobre o template `kargul-starter` (Next.js 16 + React 19 + Tailwind 4), que está a ser adaptado de um "Sales CRM" genérico em inglês para um CRM completo em **português de Angola**, com **Email Marketing** e **SMS** integrados.

Antes de escrever código, lê também:

| Ficheiro        | O que tem                                                    |
| --------------- | ------------------------------------------------------------ |
| `FEATURES.md`   | Especificação funcional por módulo (o quê e porquê)          |
| `ROADMAP.md`    | Fases de entrega, ordem de trabalho, critérios de aceitação  |
| `AGENTS.md`     | Regras de execução para agentes + notas da versão do Next.js |
| `.builderrules` | As 7 regras de base do template                              |

## Regras do produto

1. **Idioma: português de Angola (pt-AO).** Toda a UI, conteúdo, e-mails, SMS, mensagens de erro e metadata são em português. `<html lang="pt-AO">`. Nenhuma string em inglês chega ao ecrã.
2. **Identificadores ficam em inglês.** Nomes de ficheiros, componentes, variáveis, tipos, colunas de base de dados e chaves de API continuam em inglês (`companies`, `pipelineValue`, `openDeals`). Só o texto visível é traduzido. Isto evita um rename em cascata e mantém o código legível para quem vem do template.
3. **Moeda: Kwanza (AOA).** Formata sempre via o helper de `lib/format.ts` — `Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" })`, apresentado como `Kz`. Nunca `toLocaleString("en-US")`.
4. **Datas e horas: `pt-AO`, fuso `Africa/Luanda`.** Meses e dias da semana por extenso em português. Formato curto `dd/MM`, longo `d 'de' MMMM 'de' yyyy`.
5. **Telefones: Angola.** Prefixo `+244`, 9 dígitos, operadoras Unitel / Africell / Movicel. A validação e a normalização para E.164 vivem em `lib/phone.ts` e são usadas tanto pelos formulários como pelo módulo de SMS.
6. **Domínio é Cash & Carry, não SaaS.** Os registos são clientes reais do negócio — mercearias, restaurantes, hotéis, cantinas, revendedores, instituições. Os termos do template (`Deals`, `Pipeline`, `SDR Team`, `ARR`) traduzem-se para o vocabulário do negócio: encomendas, carteira de clientes, equipa comercial, volume de compras. `FEATURES.md` tem o glossário completo.

## Marca

Logótipo em `public/assets/images/_common/brand/alimenta-angola-logo.png` (origem: `alimentaangola.co.ao`). Cores extraídas do ficheiro:

| Token          | Hex       | Uso                                            |
| -------------- | --------- | ---------------------------------------------- |
| `brand`        | `#DF2828` | Vermelho principal — ações primárias, destaque |
| `brand-accent` | `#F9EB2A` | Amarelo — avisos, realces, badges              |
| `brand-ink`    | `#000000` | Texto sobre amarelo                            |
| `brand-paper`  | `#FFFFFF` | Texto sobre vermelho                           |

Estes tokens entram em `app/globals.css` junto dos existentes (`--brand`, `--brand-accent`, …) e são expostos via `@theme inline`. Não introduzas cores de marca inline — todas passam por token. O tema base é escuro (`color-scheme: dark`, `--background: #161616`); o vermelho da marca só é legível sobre escuro com o peso certo, por isso valida contraste antes de o usar em texto.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — `app/`
- **Tailwind CSS 4** — tokens e escala tipográfica em `app/globals.css`
- **Zustand** — estado de UI e de domínio em `stores/`
- **Radix UI + cmdk** — primitivas em `components/_ui/`
- **Motion (Framer Motion) + Rive + Lottie** — via o componente `Asset`
- **Supabase** — Postgres, Auth, RLS, Storage, Realtime e Edge Functions. Configurado em `.mcp.json` (requer autorização do servidor MCP numa sessão interactiva). As skills `supabase` e `supabase-postgres-best-practices` em `.claude/skills/` são de leitura obrigatória antes de mexer em schema ou em políticas RLS.
- **Email/SMS** — fornecedores ainda por fechar; ver `ROADMAP.md` (Fase 4 e 5). A camada de envio é abstraída atrás de `lib/messaging/` para que a troca de fornecedor não toque na UI.

## Estrutura

```
app/                    rotas, layout, globals.css, robots/sitemap/llms.txt
components/_ui/         primitivas reutilizáveis (button, dialog, table, asset…)
components/_common/     chrome partilhado (sidebar, header, scroll-to-top)
components/<modulo>/    um folder por módulo de negócio, com subfolders por bloco
data/                   dados de exemplo (mock) — substituídos por Supabase ao longo do roadmap
lib/                    lógica pura: filtros, formatação, CSV, SEO, easings
stores/                 stores Zustand
hooks/                  hooks de React
public/assets/images/   ícones e imagens, espelhando a estrutura de components/
```

Cada módulo novo segue o padrão de `components/companies/`: um `<modulo>.tsx` que compõe `header/`, `toolbar/`, `table/`, `detail/` e os diálogos, um store em `stores/`, a lógica pura em `lib/` e os dados em `data/`.

## Regras de código

Herdadas do template (`.builderrules`) e obrigatórias:

1. Usa a estrutura de secção já existente nos módulos (ver `components/companies/companies.tsx`).
2. **Não acrescentes estilos de fonte a `p`, `h1`, `h2`, `h3`** — a escala está global em `app/globals.css` (`@layer base`). Para variantes usa as classes utilitárias já definidas: `.lead-style`, `.caption-style`, `.eyebrow-style`.
3. Qualquer botão passa pelo componente `Button` de `components/_ui/button.tsx`, **sempre com `variant` explícito**.
4. `max-width` de títulos e parágrafos em `em` (px alvo ÷ font-size).
5. Tailwind primeiro; CSS à parte só quando o Tailwind não chega.
6. Bordas entre elementos empilhados com `divide-*` / `outline`, não `border` repetida.
7. **Sem comentários no código.** O nome diz o que faz.

Mais:

8. SVGs: `<Image />` por caminho; componente SVGR só quando o ícone precisa de ser estilizado por CSS (ver os imports em `sidebar-content.tsx`).
9. Toda a imagem, vídeo, Rive e Lottie passa pelo componente `Asset`, tipado por `type`, com `width`/`height` a servir de rácio.
10. Ícones exportados do Figma — não instales bibliotecas de ícones.
11. Easings partilhados: usa os tokens `--ease-power*` de `app/globals.css` em Tailwind e em Motion.
12. SEO por `lib/seo.ts` → `pageMetadata()`, com `robots.ts`, `sitemap.ts` e `llms.txt` a derivarem de `SITE_ROUTES`.

> **Nota:** o `CONVENTIONS.md` referido pelo README do template não existe neste repositório. Esta secção é a fonte de verdade. Se o `CONVENTIONS.md` for recuperado, as regras acima têm de ser reconciliadas com ele.

## Dados sensíveis

Os registos são clientes reais e os módulos de Email/SMS enviam para pessoas reais.

- Nunca faças commit de chaves de API, de dumps de base de dados ou de listas de contactos. `.env.local` fica fora do Git.
- Em desenvolvimento, Email e SMS correm em **modo sandbox** (destinatário fixo de teste); o envio real exige `MESSAGING_LIVE=true` e confirmação explícita.
- Nenhum envio em massa é disparado por um agente sem pedido explícito do utilizador.
- O RLS do Supabase é obrigatório em todas as tabelas — sem excepção, nem em tabelas "internas".
