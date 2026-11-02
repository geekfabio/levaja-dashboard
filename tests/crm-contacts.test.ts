import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockContacts } from "@/data/crm/mock/contacts";
import { isRepositoryError } from "@/data/crm/repositories";
import { useContactsStore } from "@/stores/contacts-store";
import { ANONYMIZED_NAME } from "@/lib/privacy";

function repo() {
  return createMockContacts(0);
}

function seedContact() {
  return useContactsStore.getState().contacts[0];
}

test("get de id inexistente devolve not_found", async () => {
  const contacts = repo();
  await assert.rejects(contacts.get("ct-inexistente"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("update aplica patch na store partilhada", async () => {
  const contacts = repo();
  const target = seedContact();
  const updated = await contacts.update(target.id, { role: "Novo Cargo" });
  assert.equal(updated.role, "Novo Cargo");
  assert.equal(useContactsStore.getState().contacts.find((item) => item.id === target.id)?.role, "Novo Cargo");
});

test("setContactability altera o estado", async () => {
  const contacts = repo();
  const target = seedContact();
  const updated = await contacts.setContactability(target.id, "Inválido");
  assert.equal(updated.contactability, "Inválido");
});

test("toggleConsent inverte o estado do canal", async () => {
  const contacts = repo();
  const target = seedContact();
  const before = target.consent.email.granted;
  const updated = await contacts.toggleConsent(target.id, "email");
  assert.equal(updated.consent.email.granted, !before);
});

test("merge combina campos e remove o secundário", async () => {
  const contacts = repo();
  const [primary, secondary] = useContactsStore.getState().contacts;
  const { merged, removedId } = await contacts.merge(primary.id, secondary.id, { role: "secondary", phone: "primary", whatsapp: "primary", email: "primary" });
  assert.equal(merged.role, secondary.role);
  assert.equal(removedId, secondary.id);
  assert.ok(!useContactsStore.getState().contacts.some((item) => item.id === secondary.id));
});

test("anonymize remove dados pessoais e marca Pediu remoção", async () => {
  const contacts = repo();
  const target = seedContact();
  const result = await contacts.anonymize(target.id);
  assert.equal(result.name, ANONYMIZED_NAME);
  assert.equal(result.contactability, "Pediu remoção");
  assert.equal(result.consent.email.granted, false);
});
