import { test } from "node:test";
import assert from "node:assert/strict";
import { useCalendarSyncStore } from "@/stores/calendar-sync-store";
import { useCompaniesStore } from "@/stores/companies-store";
import { nowLuandaLocal } from "@/lib/format";
import { addDays } from "@/lib/follow-up";

test("sincronização cria, atualiza e remove eventos das visitas e reuniões", () => {
  const today = nowLuandaLocal().slice(0, 10);
  const companies = useCompaniesStore.getState();
  const [first, second] = companies.companies;
  companies.scheduleFollowUp(first.id, { date: addDays(today, 2), type: "Visita", note: "Tabela nova", owner: first.owner }, { silent: true });
  companies.scheduleFollowUp(second.id, { date: addDays(today, 3), type: "Chamada", note: "", owner: second.owner }, { silent: true });

  const sync = useCalendarSyncStore.getState();
  sync.startConnect("google");
  useCalendarSyncStore.getState().confirmConnect("gestor@alimentaangola.co.ao");
  const created = useCalendarSyncStore.getState().synced.filter((event) => event.provider === "google");
  assert.ok(created.some((event) => event.uid === `followup-${first.id}`));
  assert.ok(!created.some((event) => event.uid === `followup-${second.id}`));

  companies.scheduleFollowUp(first.id, { date: addDays(today, 5), type: "Visita", note: "Tabela nova", owner: first.owner }, { silent: true });
  useCalendarSyncStore.getState().syncNow("google", { silent: true });
  assert.equal(useCalendarSyncStore.getState().log[0].action, "Atualizado");

  companies.scheduleFollowUp(first.id, null, { silent: true });
  useCalendarSyncStore.getState().syncNow("google", { silent: true });
  assert.ok(!useCalendarSyncStore.getState().synced.some((event) => event.uid === `followup-${first.id}`));
  assert.ok(useCalendarSyncStore.getState().log.some((entry) => entry.action === "Removido"));

  useCalendarSyncStore.getState().disconnect("google");
  assert.equal(useCalendarSyncStore.getState().synced.length, 0);
});
