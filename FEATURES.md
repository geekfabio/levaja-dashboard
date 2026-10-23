# Funcionalidades — Leva Já

O que cada módulo faz e o que conta como «pronto». A especificação detalhada do painel de administração, com as regras de negócio, está em `LEVA_JA_ADMIN.md`; a ordem de entrega em `ROADMAP.md`; as regras de implementação em `CLAUDE.md`.

Estado: `✅ existe` · `🔨 parcial` · `⬜ por construir`

---

## Painel de administração — `/admin`

Todos os dados vêm de `repositories()` (`data/leva-ja/`). Em modo mock, a `MockDatabase` aplica as regras de negócio, guarda o estado no navegador e simula tempo real; trocar para a API real é mudar `NEXT_PUBLIC_DATA_SOURCE=http`.

| # | Módulo | Rota | O que faz |
| --- | --- | --- | --- |
| 1 | Login (mock) | `/admin/login` | E-mail e código de 6 dígitos, mais o código da aplicação de autenticação quando o segundo factor é exigido. Cada papel (`admin`, `operations`, `support`, `finance`) só vê as suas secções. |
| 2 | Visão geral | `/admin` | KPIs do dia e da semana, gráficos de pedidos, serviços, funil e receita, e a lista «precisa de atenção». |
| 3 | Pedidos | `/admin/pedidos[/id]` | Tabela com filtros e paginação; separador Prazos com atribuição e chegada dentro do prazo (percentagem, média, percentil 90), por dia, zona e serviço, e pedidos fora do prazo; detalhe com trajecto, linha temporal, fotografias da recolha, da entrega e dos danos, preço, proposta, comprovativo, pagamento, reembolsos, sinistros e avaliação; reatribuir, cancelar, abrir disputa e forçar conclusão, sempre com motivo. |
| 18 | Agendados | `/admin/agendados` | Pedidos marcados para mais tarde, agrupados por dia, com indicadores (hoje, 7 dias, por atribuir, em risco a menos de 3 h sem prestador) e atribuição directa. Só entram no mapa e na atribuição automática a `dispatch.scheduleLeadMinutes` da hora marcada. |
| 19 | Sinistros | `/admin/sinistros` | Danos, acidentes e extravios participados a partir do pedido; análise com seguradora e apólice, notas, aprovação da indemnização (até 150 % do estimado), recusa e pagamento. |
| 20 | Contas empresariais | `/admin/empresas` | Empresas com contrato (desconto, prazo de pagamento, limite de crédito), utilizadores autorizados, extractos mensais com desconto e estado (em curso, por pagar, em atraso, pago), crédito usado e suspensão. |
| 21 | Promoções e cupões | `/admin/promocoes` | Códigos de desconto (percentagem ou valor fixo, máximo, pedido mínimo, serviços, primeiro pedido, usos por cliente) com orçamento e período; pausar, retomar e terminar; utilizações e volume. |
| 22 | Comunicações | `/admin/comunicacoes` | Notificações, SMS e e-mails para clientes ou prestadores por segmento e zona, com estimativa do público, contador de caracteres e pré-visualização; rascunho, agendamento e envio **sempre simulado**: nada sai do painel. |
| 23 | Relatórios | `/admin/relatorios` | Operação, finanças, prestadores, zonas e contas empresariais por período, com resumo, tabela e exportação CSV. |
| 24 | Protecção de dados | `/admin/proteccao-dados` | Pedidos dos titulares (acesso, rectificação, eliminação, portabilidade, oposição) com prazo de 30 dias e alertas; iniciar, concluir e recusar com fundamento; exportação JSON para acesso e portabilidade; eliminação por anonimização, bloqueada com pedidos em curso ou disputas abertas. |
| 25 | Integrações | `/admin/integracoes` | Chaves de API com permissões e validade, mostradas uma só vez, e revogação; webhooks `https` com eventos, segredo de assinatura mostrado uma vez, activar e desactivar, envios recentes e teste **sempre simulado**. |
| 4 | Mapa operacional | `/admin/mapa` | Mapa OpenStreetMap de Angola com zoom e arrastar; viaturas disponíveis por classe (livres e em serviço) e pedidos activos, com posições simuladas que se actualizam. Ao escolher um pedido, desenha a rota pelas estradas (prestador → recolha → paragens → entrega) com km e duração por troço e no total. Mapa de calor da procura (7 dias, por hora) ou da oferta (agora) e procura por prestador em cada zona. |
| 5 | Prestadores | `/admin/prestadores[/id]` | Estado, verificação, avaliação, viatura, zonas e ganhos; documentos, cobertura, carteira, qualidade, avaliações e histórico; aprovar, suspender e reactivar. Vista «Qualidade e penalizações» com pontuação de 0 a 100 (cancelamentos, atrasos, avaliações e disputas dos últimos 30 dias) e alertas; advertências, multas (descontadas à carteira) e suspensões temporárias, que se podem anular. |
| 16 | Candidaturas | `/admin/candidaturas` | Funil de novos prestadores (registo, documentos, entrevista, vistoria) com marcação da entrevista, registo da vistoria, aprovação que cria o prestador com documentos por validar e recusa com motivo. |
| 17 | Frotas | `/admin/frotas` | Empresas com várias viaturas: motoristas, estatísticas de 30 dias, acrescentar e retirar motoristas, suspender e reactivar. |
| 6 | Validação de documentos | `/admin/documentos` | Fila de documentos por validar com pré-visualização, aprovar ou recusar com motivo, e alerta dos que expiram em 30 dias. |
| 7 | Clientes | `/admin/clientes[/id]` | Lista e detalhe (pedidos, métodos de pagamento, avaliações dadas, ocorrências), com bloqueio e desbloqueio. |
| 8 | Finanças | `/admin/financas` | Receita por período e serviço (líquida de reembolsos); levantamentos (aprovar, rejeitar, marcar como pago); lotes de pagamento (juntar levantamentos aprovados, descarregar o ficheiro de transferências, marcar o lote como pago ou cancelá-lo); transacções com exportação CSV. |
| 9 | Preços e zonas | `/admin/precos` | Base e preço por km, extras, taxa e comissão com pré-visualização; zonas com nome, centro e raio. |
| 10 | Suporte | `/admin/suporte` | Ocorrências (atribuir, responder com respostas prontas, resolver) com prazo de primeira resposta por prioridade e indicadores; satisfação (nota média, satisfeitos, taxa de resposta, respostas recentes); alertas SOS em destaque e avaliações baixas para revisão. |
| 11 | Utilizadores e auditoria | `/admin/utilizadores`, `/admin/auditoria` | Gestão de administradores, papéis e segundo factor; sessões activas com terminar sessão remotamente; registo de entradas, saídas e tentativas falhadas; log de auditoria filtrável. |
| 12 | Definições | `/admin/definicoes` | Conta da sessão; definições da plataforma (geral, serviços, atribuição, cancelamentos, pagamentos e reembolsos, impostos, documentos, notificações, suporte, segurança e app), cada secção com motivo e auditoria; matriz editável de papéis e permissões; em modo mock, «Repor dados de demonstração» e simulação de rede lenta ou com falhas. |
| 13 | Disputas | `/admin/disputas` | Pedidos contestados com categoria, prazo de 72 h e indicadores; painel com notas internas, reembolsos do pedido e resolução sem reembolso, com reembolso total ou parcial, imputado ou não ao prestador. |
| 15 | Facturação | `/admin/facturacao` | Facturas-recibo e notas de crédito com IVA incluído, numeração por série e ano, documento detalhado e exportação CSV; reconciliação diária dos recebimentos por cartão e Multicaixa (registar extracto, justificar diferenças); numerário que os prestadores têm de entregar, com prazo e registo de entregas. |
| 14 | Reembolsos | `/admin/reembolsos` | Pedidos de reembolso (manuais, de disputas e de cancelamentos) com aprovação das Finanças, dupla aprovação acima do limite, rejeição com motivo e pagamento com referência; o valor sai da receita ou da carteira do prestador. No detalhe do pedido, «Pedir reembolso». |

**Transversal:** todas as listas têm esqueleto de carregamento, estado vazio, estado de erro com «Tentar novamente» e paginação; as acções destrutivas pedem confirmação; o feedback é dado por toast; todas as acções críticas ficam na auditoria com actor, motivo e alterações.

### Vocabulário

| Código | Ecrã |
| --- | --- |
| `ServiceRequest` | Pedido |
| `Provider` / `ProviderAccount` | Prestador |
| `Client` / `ClientAccount` | Cliente |
| `Ticket` | Ocorrência |
| `SosAlert` | Alerta SOS |
| `Withdrawal` | Levantamento |
| `PricingConfig` | Tabela de preços |
| `AuditLogEntry` | Registo de auditoria |

Os estados, serviços e rótulos estão em `lib/leva-ja/status.ts` e `lib/leva-ja/services.ts`.

---

## CRM — `/`

CRM comercial herdado do template, com a marca Leva Já e dados fictícios em memória (Zustand). Perdeu a cadeia Cash & Carry (vendas, cotações e encomendas, previsão, relatórios, catálogo, comissões e gatilhos de automação baseados em compras).

| Módulo | Interface |
| --- | --- |
| Clientes | Lista e grelha, filtros, edição, arquivo, acções em grupo, ficha fiscal, documentos, importação CSV |
| Contactos | Ficha, consentimento por canal, fusão, chamadas, exportação e anonimização |
| Oportunidades | Kanban, tabela, motivos de perda |
| Follow-up | Contactos agendados, tarefas, lembretes, propostas de desconto, exportação .ics |
| Actividades | Lista, calendário, tarefas, rota do dia com check-in GPS |
| Conversas | WhatsApp e SMS, janela de 24 h, «PARAR» |
| Campanhas | E-mail e SMS: editor, segmentos, revisão, agendamento, medição |
| Automações | Gatilhos por acontecimento e aniversário; propostas de desconto; caixa de saída |
| Tickets | Pedidos e incidentes, SLA, comentários |
| Auditoria | Quem alterou o quê |
| Definições | Empresa, remetentes, modelos, equipas, zonas, acessos, integrações de calendário, mensagens e saldo, protecção de dados |

A classe ABC (campanhas e condições das automações) passou a ser calculada pelo valor em carteira de cada cliente (`abcByPipeline` em `lib/companies.ts`).

---

## Fora de âmbito, por agora

- Backend real e autenticação real do painel (o esqueleto HTTP existe; a API é da app móvel).
- Pagamentos reais (Multicaixa, cartão) e transferências de levantamentos.
- Servidor próprio de tiles e de rotas — por agora usam-se os servidores públicos do OpenStreetMap e do OSRM, só para demonstração.
