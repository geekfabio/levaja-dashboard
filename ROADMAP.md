# Roadmap — Alimenta Angola CRM

Ordem de trabalho. Cada fase fecha com algo utilizável, não com "metade de três módulos". O detalhe funcional está em `FEATURES.md`; as regras em `CLAUDE.md`.

As durações são estimativas para uma pessoa a trabalhar com assistência de agente. Não são compromissos com data.

---

## Fase 0 — Tradução e identidade `← a seguir`

Primeiro ponto do pedido: traduzir o template antes de lhe acrescentar seja o que for. Cada ecrã novo construído em inglês é trabalho feito duas vezes.

1. `app/layout.tsx` — `lang="pt-AO"`
2. `lib/seo.ts` — `SITE_NAME` = "Alimenta Angola CRM", `SITE_DESCRIPTION`, `SITE_ROUTES`, `openGraph.locale: "pt_AO"`
3. `lib/format.ts` (novo) — Kwanza, datas em `pt-AO`/`Africa/Luanda`, percentagens, números. Substitui `formatMoney` e `formatDate` de `lib/companies.ts`, que usam `en-US` e meses em inglês.
4. `data/companies.ts` — segmentos, fases, nomes de gestores, e-mails e telefones passam a dados angolanos plausíveis (+244, domínio `alimentaangola.co.ao`); nomes de clientes passam a nomes de retalho e HORECA de Luanda
5. `data/notifications.ts` — textos em português
6. `components/_common/sidebar/sidebar-content.tsx` — navegação pelo glossário de `FEATURES.md`; bloco "14 Days / Add Billings" sai (é do template SaaS)
7. `components/companies/**` — todas as strings de UI: cabeçalho, barra de ferramentas, colunas, detalhe, diálogos, paleta de comandos, perfil
8. `lib/csv.ts` e `companiesCsvRows` — cabeçalhos do CSV em português, separador `;` (o Excel em pt-AO espera ponto e vírgula)
9. Marca — logótipo em `public/assets/images/_common/brand/`, tokens `--brand` / `--brand-accent` em `app/globals.css`, favicon, `apple-icon`, `opengraph-image`

**Feito quando:** não existe uma única string em inglês visível na aplicação, os valores aparecem em Kz e as datas em português. `npm run lint` e `npm run build` passam.

---

## Fase 1 — Fundação técnica

Antes de módulos novos, a base que todos vão usar.

1. Projecto Supabase ligado — variáveis de ambiente, clientes de browser e de servidor, `.env.example` sem valores reais
2. Autenticação: entrada, saída, sessão, protecção de rotas, recuperação de palavra-passe
3. Schema inicial: `profiles`, `teams`, `zones`, `companies`, `contacts` — com RLS activo e políticas por perfil desde a primeira migração
4. `lib/phone.ts` — validação +244, E.164, operadora
5. `lib/i18n.ts` — dicionário central para strings dinâmicas
6. Tratamento de erros e estados de carregamento partilhados, em português

**Feito quando:** um utilizador entra com a sua conta e só vê os clientes a que tem direito, com a regra a ser aplicada pela base de dados.

---

## Fase 2 — Clientes a sério

1. Módulo de Clientes a ler e escrever em Supabase; `data/companies.ts` deixa de alimentar a aplicação
2. Campos do negócio: NIF, alvará, morada, zona, província, limite de crédito, condições de pagamento, canal de entrega
3. Edição inline e formulário completo, com validação
4. Importação CSV/Excel com pré-visualização, mapeamento de colunas e deteção de duplicados por NIF e telefone
5. Classificação ABC e indicador de risco
6. Pesquisa do lado do servidor e paginação — a tabela actual assume que tudo cabe em memória

**Feito quando:** a carteira real de clientes está carregada e a equipa comercial consegue trabalhar nela.

---

## Fase 3 — Contactos, Oportunidades e Atividades

1. Contactos, com **consentimento por canal** — é o pré-requisito de tudo o que vem a seguir
2. Oportunidades: tabela, quadro Kanban, fases, motivos de perda, previsão ponderada
3. Atividades: registo, tarefas, calendário, linha de tempo por cliente
4. "Último contacto" e "valor em carteira" passam a ser calculados, não fixos
5. Vista "rota do dia", pensada para telemóvel

**Feito quando:** o funil comercial inteiro vive no CRM e a direção vê a previsão do mês sem folha de cálculo.

---

## Fase 4 — Email Marketing

Decisão a tomar no início da fase: **fornecedor de e-mail**. Candidatos a avaliar por entregabilidade em Angola, preço e webhooks — Resend, Brevo, Postmark, Amazon SES. A escolha fica registada neste ficheiro quando for feita.

1. `lib/messaging/` — interface comum, adaptador de e-mail, modo sandbox obrigatório em desenvolvimento
2. Domínio de envio autenticado: SPF, DKIM e DMARC em `alimentaangola.co.ao` (tarefa de infraestrutura, a começar cedo — propagação demora)
3. Motor de segmentos, partilhado com SMS, construído sobre os filtros de Clientes
4. Editor de campanha, biblioteca de modelos com a marca, variáveis de personalização
5. Fila de envio em Edge Functions, com limitação de ritmo e agendamento
6. Webhooks: entregas, aberturas, cliques, devoluções, remoções → estado da campanha + linha de tempo do cliente
7. Página de remoção da subscrição, em português
8. Painel de resultados da campanha

**Feito quando:** a promoção semanal sai do CRM para um segmento real e as métricas voltam para a ficha de cada cliente.

---

## Fase 5 — SMS

Decisão a tomar no início da fase: **agregador de SMS com cobertura Unitel / Africell / Movicel**, e registo do sender ID alfanumérico junto das operadoras. O registo tem prazos próprios — tratar disso antes de construir a UI.

**Decisão registada:** agregador **Umoja Global** (subcontrata a **MIMOSMS**). Pacote único a **20 Kz por mensagem**, pré-pago com carregamento de crédito. Contagem: cada 120 unidades = 1 mensagem; letras com acento contam 2 unidades. Prefixos: Unitel 92/93/94/97, Movicel 91/99, Africell 95/96. O registo do sender ID continua por confirmar.

1. Adaptador de SMS em `lib/messaging/`, com as mesmas garantias de sandbox
2. Composição com contagem de segmentos GSM-7 / Unicode e aviso de custo dos acentos
3. Estimativa de custo antes da confirmação, por operadora
4. Agendamento com janela de envio em hora de Luanda
5. Estados de entrega por mensagem, via webhook
6. SMS transacional: confirmação de encomenda, aviso de entrega, lembrete de pagamento
7. `PARAR` a dar baixa do consentimento automaticamente

**Feito quando:** uma campanha de SMS é enviada com custo previsto antes de confirmar, e as entregas são confirmadas por mensagem.

---

## Fase 6 — Automações e Relatórios

1. Motor de regras gatilho → condição → ação, com os gatilhos listados em `FEATURES.md`
2. Sequências de vários passos, com espera
3. Travão global de frequência por contacto
4. Painel de direção, desempenho por gestor e por zona, desempenho de campanhas
5. Clientes em risco
6. Exportação PDF e relatórios agendados por e-mail

---

## Fase 7 — Operação

1. Registo de auditoria completo
2. Ecrãs de definições: empresa, remetentes, janelas de envio, modelos, equipas e zonas
3. Desempenho: medir e corrigir com listas grandes e rede fraca
4. Revisão de acessibilidade e revisão de segurança (`/security-review`) antes de produção
5. Cópias de segurança, monitorização e alertas
6. Formação da equipa e documentação de utilizador

---

## Decisões em aberto

| Decisão                             | Quando decidir | Notas                                                      |
| ----------------------------------- | -------------- | ---------------------------------------------------------- |
| Fornecedor de e-mail                | Fase 4         | Entregabilidade em Angola, preço, webhooks                 |
| Agregador de SMS e sender ID        | Fase 5         | Decidido: Umoja Global / MIMOSMS, 20 Kz/mensagem. Sender ID por registar |
| Alojamento (Vercel vs outro)        | Fase 1         | Latência a partir de Luanda conta                          |
| Região do projecto Supabase         | Fase 1         | A mais próxima com boa latência para Angola                |
| Integração com facturação/ERP       | Pós-Fase 7     | Depende do sistema que a empresa já usa                    |
| WhatsApp Business como terceiro canal | Pós-Fase 5   | Alto uso em Angola; custo e aprovação de modelos a avaliar |

## Riscos

- **Entregabilidade de e-mail** — domínio novo a enviar em massa vai para spam. Autenticar o domínio cedo e aquecer o volume gradualmente.
- **Custo de SMS** — sem estimativa prévia e sem travão de frequência, uma campanha mal segmentada é cara. Por isso ambos são requisitos, não extras.
- **Qualidade dos dados de contacto** — números e e-mails errados inviabilizam os dois módulos de campanha. A validação na importação (Fase 2) é o que protege as Fases 4 e 5.
- **Consentimento** — construir campanhas antes de ter consentimento por canal cria uma dívida que depois obriga a limpar a base. Contactos vêm antes de Email Marketing, de propósito.
