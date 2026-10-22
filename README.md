# Alimenta Angola CRM

CRM interno da **Alimenta Angola — Cash and Carry**: carteira de clientes, funil comercial, atividades, **Email Marketing** e **SMS**, tudo em português de Angola.

Construído sobre o template `kargul-starter` (Next.js 16 · React 19 · Tailwind CSS 4 · Zustand · Supabase), actualmente a ser adaptado de um "Sales CRM" genérico em inglês. O estado de cada módulo está em [FEATURES.md](FEATURES.md); a ordem de trabalho em [ROADMAP.md](ROADMAP.md).

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

| Comando                | O que faz                                               |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento                             |
| `npm run build`        | Build de produção                                       |
| `npm run start`        | Serve o build de produção                               |
| `npm run lint`         | ESLint                                                  |
| `npm run to:avif`      | Converte uma imagem para AVIF e reporta o custo inline  |
| `npm run extract:avif` | Extrai o primeiro frame de cada `.webm` em `public/`    |
| `npm run frame:rive`   | Gera um poster a partir de um ficheiro `.riv`           |

## Documentação

| Ficheiro                     | O que tem                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)       | Contexto do produto, regras de código, marca, stack. **Lê primeiro.** |
| [FEATURES.md](FEATURES.md)   | Especificação por módulo, glossário do negócio, estado actual    |
| [ROADMAP.md](ROADMAP.md)     | Fases de entrega, decisões em aberto, riscos                     |
| [AGENTS.md](AGENTS.md)       | Regras de execução para agentes + notas da versão do Next.js     |
| `.builderrules`              | As 7 regras de base do template                                  |

## Estrutura

```
app/                    rotas, layout, globals.css, robots/sitemap/llms.txt
components/_ui/         primitivas (button, dialog, table, asset…)
components/_common/     sidebar, header, scroll-to-top
components/companies/   módulo de Clientes — a referência para todos os outros
data/                   dados fictícios, substituídos por Supabase ao longo do roadmap
lib/                    lógica pura: filtros, formatação, CSV, SEO, easings
stores/                 stores Zustand
hooks/                  hooks de React
public/assets/images/   ícones e imagens, a espelhar components/
```

## Regras que não se negoceiam

1. **Tudo em pt-AO no ecrã**, identificadores em inglês no código.
2. **Kwanza (Kz)**, datas em `Africa/Luanda`, telefones `+244` — sempre pelos helpers de `lib/`.
3. **Sem comentários no código**; sem estilos de fonte em `h1`/`h2`/`h3`/`p` (a escala é global em `app/globals.css`); botões sempre pelo componente `Button` com `variant` explícito.
4. **RLS activo em todas as tabelas** do Supabase, desde a primeira migração.
5. **Email e SMS em sandbox** por omissão. Envio real exige `MESSAGING_LIVE=true` e confirmação humana.

O detalhe está em [CLAUDE.md](CLAUDE.md).

## Marca

Logótipo: `public/assets/images/_common/brand/alimenta-angola-logo.png`

| Token          | Hex       |
| -------------- | --------- |
| `brand`        | `#DF2828` |
| `brand-accent` | `#F9EB2A` |
| `brand-ink`    | `#000000` |
| `brand-paper`  | `#FFFFFF` |

## Configuração inicial de ambiente

1. **`lib/seo.ts`** — `SITE_NAME`, `SITE_URL`, `SITE_DESCRIPTION`, `SITE_ROUTES`. `app/robots.ts`, `app/sitemap.ts`, `app/llms.txt/route.ts` e a metadata de cada página derivam daqui. `NEXT_PUBLIC_SITE_URL` sobrepõe o URL por deploy.
2. **`app/globals.css`** — escala tipográfica (`@layer base`) e tokens de cor, incluindo os de marca.
3. **`app/opengraph-image.jpg`** — 1200×630, com `opengraph-image.alt.txt` ao lado.
4. **Supabase** — servidor MCP configurado em `.mcp.json`; precisa de ser autorizado numa sessão interactiva (`/mcp`). As variáveis de ambiente ficam em `.env.local`, fora do Git.
