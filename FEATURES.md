# Funcionalidades — Leva Já

O que cada módulo faz e o que conta como «pronto». A especificação detalhada do painel de administração, com as regras de negócio, está em `LEVA_JA_ADMIN.md`; a ordem de entrega em `ROADMAP.md`; as regras de implementação em `CLAUDE.md`.

Estado: `✅ existe` · `🔨 parcial` · `⬜ por construir`

---

## Painel de administração — `/admin`

Todos os dados vêm de `repositories()` (`data/leva-ja/`). Em modo mock, a `MockDatabase` aplica as regras de negócio, guarda o estado no navegador e simula tempo real; trocar para a API real é mudar `NEXT_PUBLIC_DATA_SOURCE=http`.

| # | Módulo | Rota | O que faz |
| --- | --- | --- | --- |
| 1 | Login (mock) | `/admin/login` | E-mail e código de 6 dígitos. Cada papel (`admin`, `operations`, `support`, `finance`) só vê as suas secções. |
| 2 | Visão geral | `/admin` | KPIs do dia e da semana, gráficos de pedidos, serviços, funil e receita, e a lista «precisa de atenção». |
| 3 | Pedidos | `/admin/pedidos[/id]` | Tabela com filtros e paginação; detalhe com trajecto, linha temporal, preço, proposta, comprovativo, pagamento e avaliação; reatribuir, cancelar, abrir disputa e forçar conclusão, sempre com motivo. |
| 4 | Mapa operacional | `/admin/mapa` | Mapa OpenStreetMap de Angola com zoom e arrastar; viaturas disponíveis por classe (livres e em serviço) e pedidos activos, com posições simuladas que se actualizam. Ao escolher um pedido, desenha a rota pelas estradas (prestador → recolha → paragens → entrega) com km e duração por troço e no total. |
| 5 | Prestadores | `/admin/prestadores[/id]` | Estado, verificação, avaliação, viatura, zonas e ganhos; documentos, cobertura, carteira, avaliações e histórico; aprovar, suspender e reactivar. |
| 6 | Validação de documentos | `/admin/documentos` | Fila de documentos por validar com pré-visualização, aprovar ou recusar com motivo, e alerta dos que expiram em 30 dias. |
| 7 | Clientes | `/admin/clientes[/id]` | Lista e detalhe (pedidos, métodos de pagamento, avaliações dadas, ocorrências), com bloqueio e desbloqueio. |
| 8 | Finanças | `/admin/financas` | Receita por período e serviço; levantamentos (aprovar, rejeitar, marcar como pago); transacções com exportação CSV. |
| 9 | Preços e zonas | `/admin/precos` | Base e preço por km, extras, taxa e comissão com pré-visualização; zonas com nome, centro e raio. |
| 10 | Suporte | `/admin/suporte` | Ocorrências (atribuir, responder, resolver), alertas SOS em destaque e avaliações baixas para revisão. |
| 11 | Utilizadores e auditoria | `/admin/utilizadores`, `/admin/auditoria` | Gestão de administradores e papéis; log de auditoria filtrável. |
| 12 | Definições | `/admin/definicoes` | Conta da sessão e, em modo mock, «Repor dados de demonstração» e simulação de rede lenta ou com falhas. |

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
