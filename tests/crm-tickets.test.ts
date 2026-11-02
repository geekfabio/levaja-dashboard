import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockRepositories } from "@/data/crm/mock";
import { isRepositoryError } from "@/data/crm/repositories";
import type { TicketDraft } from "@/data/crm/repositories";

function repos() {
  return createMockRepositories({ latencyMs: 0 });
}

const DRAFT: TicketDraft = {
  subject: "Teste de contrato",
  description: "Descrição de teste.",
  companyId: "nova-vida",
  companyName: "Supermercado Nova Vida",
  contactName: "Pedro Muanza",
  priority: "Normal",
  origin: "Manual",
  assignee: "Sara Neto",
  assigneeAvatar: "/x.png",
};

test("list devolve a colecção semeada e cópias defensivas", async () => {
  const crm = repos();
  const first = await crm.tickets.list();
  assert.ok(first.length > 0);
  first[0].subject = "alterado localmente";
  const second = await crm.tickets.list();
  assert.notEqual(second[0].subject, "alterado localmente");
});

test("create gera id, estado Aberto e cronograma inicial", async () => {
  const crm = repos();
  const before = (await crm.tickets.list()).length;
  const ticket = await crm.tickets.create(DRAFT);
  assert.match(ticket.id, /^tk-/);
  assert.equal(ticket.status, "Aberto");
  assert.equal(ticket.comments.length, 0);
  assert.equal(ticket.timeline[0].label, "Ticket criado");
  assert.equal((await crm.tickets.list()).length, before + 1);
});

test("create a partir de e-mail usa o rótulo e autor certos", async () => {
  const crm = repos();
  const ticket = await crm.tickets.create({ ...DRAFT, origin: "E-mail", contactName: "Isabel Capinda" });
  assert.equal(ticket.timeline[0].label, "Ticket criado a partir de e-mail");
  assert.equal(ticket.timeline[0].author, "Isabel Capinda");
});

test("create recusa assunto vazio", async () => {
  const crm = repos();
  await assert.rejects(crm.tickets.create({ ...DRAFT, subject: "   " }), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "validation");
    return true;
  });
});

test("get de id inexistente devolve not_found", async () => {
  const crm = repos();
  await assert.rejects(crm.tickets.get("tk-inexistente"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("addComment marca a primeira resposta e acrescenta cronograma", async () => {
  const crm = repos();
  const created = await crm.tickets.create(DRAFT);
  const commented = await crm.tickets.addComment(created.id, "Primeira resposta.");
  assert.equal(commented.comments.length, 1);
  assert.ok(commented.firstResponseAt);
  assert.equal(commented.timeline.at(-1)?.label, "Primeira resposta enviada");
  const again = await crm.tickets.addComment(created.id, "Segundo comentário.");
  assert.equal(again.timeline.at(-1)?.label, "Comentário adicionado");
});

test("setStatus para estado fechado regista a resolução", async () => {
  const crm = repos();
  const created = await crm.tickets.create(DRAFT);
  const resolved = await crm.tickets.setStatus(created.id, "Resolvido");
  assert.equal(resolved.status, "Resolvido");
  assert.ok(resolved.resolvedAt);
  const unchanged = await crm.tickets.setStatus(resolved.id, "Resolvido");
  assert.equal(unchanged.timeline.length, resolved.timeline.length);
});

test("setPriority e setAssignee actualizam e registam cronograma", async () => {
  const crm = repos();
  const created = await crm.tickets.create(DRAFT);
  const prioritised = await crm.tickets.setPriority(created.id, "Urgente");
  assert.equal(prioritised.priority, "Urgente");
  assert.equal(prioritised.timeline.at(-1)?.label, "Prioridade alterada para Urgente");
  const reassigned = await crm.tickets.setAssignee(created.id, "Jaime Teixeira", "/y.png");
  assert.equal(reassigned.assignee, "Jaime Teixeira");
  assert.equal(reassigned.timeline.at(-1)?.label, "Atribuído a Jaime Teixeira");
});
