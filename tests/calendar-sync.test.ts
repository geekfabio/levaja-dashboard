import { test } from "node:test";
import assert from "node:assert/strict";
import { useCalendarSyncStore } from "@/stores/calendar-sync-store";
import { useCompaniesStore } from "@/stores/companies-store";
import type { FollowUp } from "@/data/follow-ups";
import { nowLuandaLocal } from "@/lib/format";
import { addDays } from "@/lib/follow-up";

function setFollowUp(companyId: string, followUp: FollowUp | null) {
  useCompaniesStore.setState((state) => ({
    companies: state.companies.map((company) => (company.id === companyId ? { ...company, nextFollowUp: followUp ?? undefined } : company)),
  }));
}

test("sincronização cria, atualiza e remove eventos das visitas e reuniões", () => {
  const today = nowLuandaLocal().slice(0, 10);
  const [first, second] = useCompaniesStore.getState().companies;
  setFollowUp(first.id, { date: addDays(today, 2), type: "Visita", note: "Tabela nova", owner: first.owner });
  setFollowUp(second.id, { date: addDays(today, 3), type: "Chamada", note: "", owner: second.owner });

  const sync = useCalendarSyncStore.getState();
  sync.startConnect("google");
  useCalendarSyncStore.getState().confirmConnect("gestor@alimentaangola.co.ao");
  const created = useCalendarSyncStore.getState().synced.filter((event) => event.provider === "google");
  assert.ok(created.some((event) => event.uid === `followup-${first.id}`));
  assert.ok(!created.some((event) => event.uid === `followup-${second.id}`));

  setFollowUp(first.id, { date: addDays(today, 5), type: "Visita", note: "Tabela nova", owner: first.owner });
  useCalendarSyncStore.getState().syncNow("google", { silent: true });
  assert.equal(useCalendarSyncStore.getState().log[0].action, "Atualizado");

  setFollowUp(first.id, null);
  useCalendarSyncStore.getState().syncNow("google", { silent: true });
  assert.ok(!useCalendarSyncStore.getState().synced.some((event) => event.uid === `followup-${first.id}`));
  assert.ok(useCalendarSyncStore.getState().log.some((entry) => entry.action === "Removido"));

  useCalendarSyncStore.getState().disconnect("google");
  assert.equal(useCalendarSyncStore.getState().synced.length, 0);
});
