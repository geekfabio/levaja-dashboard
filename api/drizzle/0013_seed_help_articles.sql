INSERT INTO "angoleva"."help_articles" ("id", "category", "question", "answer") VALUES
('help-orders-cancel', 'orders', 'Até quando posso cancelar um pedido?', 'Podes cancelar enquanto o pedido ainda está à procura de prestador, ou já com prestador atribuído mas antes de confirmares a recolha. Depois de confirmares a recolha já não é possível cancelar a partir da app.'),
('help-orders-schedule', 'orders', 'Posso agendar um serviço para mais tarde?', 'Sim. Ao criares o pedido escolhe a opção de agendar e indica a data e a hora; o prestador é procurado tendo em conta essa hora, em vez de imediatamente.'),
('help-payments-price', 'payments', 'Como é calculado o preço do serviço?', 'O preço tem uma parte fixa consoante o tipo de serviço, mais um valor por quilómetro percorrido, taxas extra de acordo com os detalhes do pedido (peso, volume, andares, ajudantes, entre outros) e uma pequena taxa de plataforma. O valor final é sempre mostrado antes de confirmares o pedido.'),
('help-payments-methods', 'payments', 'Que formas de pagamento posso usar?', 'Podes pagar por referência Multicaixa, cartão ou em dinheiro. O pagamento só é pedido depois de a entrega ou o serviço estar confirmado como concluído.')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "angoleva"."help_articles" ("id", "category", "question", "answer") VALUES
('help-safety-sos', 'safety', 'O que faço se estiver em perigo durante um serviço?', 'Usa o botão de SOS no ecrã do pedido. A nossa equipa de suporte recebe o alerta de imediato, com a tua localização, e passa a acompanhá-lo até estar resolvido.'),
('help-safety-report', 'safety', 'Como denuncio um problema com o prestador ou com o cliente?', 'Abre uma ocorrência de suporte a partir do pedido em causa, descrevendo o que aconteceu. A nossa equipa analisa e volta a contactar-te com uma resposta.')
ON CONFLICT ("id") DO NOTHING;
