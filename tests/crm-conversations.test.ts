import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockConversations } from "@/data/crm/mock/conversations";
import { useContactsStore } from "@/stores/contacts-store";
import { useConversationsStore } from "@/stores/conversations-store";

function repo() {
  return createMockConversations(0);
}

test("start reaproveita conversa existente para o mesmo canal", async () => {
  const conversations = repo();
  const contact = useContactsStore.getState().contacts.find((item) => item.phone);
  if (!contact) throw new Error("sem contacto de teste");
  const first = await conversations.start(contact.id, "SMS");
  const second = await conversations.start(contact.id, "SMS");
  assert.equal(first.id, second.id);
});

test("reply bloqueia quando o contacto não tem consentimento", async () => {
  const conversations = repo();
  const contact = useContactsStore.getState().contacts.find((item) => !item.consent.sms.granted) ?? useContactsStore.getState().contacts[0];
  useContactsStore.setState((state) => ({
    contacts: state.contacts.map((item) => (item.id === contact.id ? { ...item, consent: { ...item.consent, sms: { ...item.consent.sms, granted: false } } } : item)),
  }));
  const conversation = await conversations.start(contact.id, "SMS");
  const replied = await conversations.reply(conversation.id, "Olá");
  const last = replied.messages.at(-1);
  assert.equal(last?.status, "Bloqueado");
});

test("receive com PARAR retira o consentimento e devolve optedOut", async () => {
  const conversations = repo();
  const contact = useContactsStore.getState().contacts.find((item) => item.consent.sms.granted);
  if (!contact) throw new Error("sem contacto de teste");
  const { conversation, optedOut } = await conversations.receive(contact.id, "SMS", "PARAR");
  assert.equal(optedOut, true);
  assert.equal(useContactsStore.getState().contacts.find((item) => item.id === contact.id)?.consent.sms.granted, false);
  assert.ok(conversation.messages.some((message) => message.direction === "system"));
});

test("markRead zera o contador de não lidas", async () => {
  const conversations = repo();
  const contact = useContactsStore.getState().contacts[0];
  useConversationsStore.setState((state) => ({ activeId: null, conversations: state.conversations }));
  const { conversation } = await conversations.receive(contact.id, "SMS", "Mensagem de teste.");
  const refreshed = (await conversations.list()).find((item) => item.id === conversation.id)!;
  assert.ok(refreshed.unread > 0);
  await conversations.markRead(conversation.id);
  const afterRead = (await conversations.list()).find((item) => item.id === conversation.id)!;
  assert.equal(afterRead.unread, 0);
});
