import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockCampaigns } from "@/data/crm/mock/campaigns";
import { isRepositoryError } from "@/data/crm/repositories";
import { useCampaignsStore } from "@/stores/campaigns-store";

function repo() {
  return createMockCampaigns(0);
}

async function draftCampaign() {
  const campaigns = repo();
  return campaigns.createFromTemplate("Email", "modelo-inexistente");
}

test("createFromTemplate acrescenta uma campanha em rascunho", async () => {
  const campaigns = repo();
  const before = (await campaigns.list()).length;
  const campaign = await campaigns.createFromTemplate("Email", "modelo-inexistente");
  assert.equal(campaign.status, "Rascunho");
  assert.equal((await campaigns.list()).length, before + 1);
  assert.ok(useCampaignsStore.getState().campaigns.some((item) => item.id === campaign.id));
});

test("submitForReview falha se a campanha não está em rascunho", async () => {
  const campaigns = repo();
  const campaign = await draftCampaign();
  await campaigns.submitForReview(campaign.id);
  await assert.rejects(campaigns.submitForReview(campaign.id), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "invalid_transition");
    return true;
  });
});

test("backToDraft devolve a campanha a rascunho e limpa o teste", async () => {
  const campaigns = repo();
  const campaign = await draftCampaign();
  await campaigns.submitForReview(campaign.id);
  await campaigns.recordTest(campaign.id);
  const back = await campaigns.backToDraft(campaign.id);
  assert.equal(back.status, "Rascunho");
  assert.equal(back.testSentAt, undefined);
});

test("schedule exige teste enviado antes de agendar", async () => {
  const campaigns = repo();
  const campaign = await draftCampaign();
  await campaigns.submitForReview(campaign.id);
  await assert.rejects(campaigns.schedule(campaign.id, "2026-12-01T10:00", 10), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "invalid_transition");
    return true;
  });
});

test("schedule agenda a campanha depois do teste e cancelSchedule devolve a revisão", async () => {
  const campaigns = repo();
  const campaign = await draftCampaign();
  await campaigns.submitForReview(campaign.id);
  await campaigns.recordTest(campaign.id);
  const scheduled = await campaigns.schedule(campaign.id, "2026-12-01T10:00", 10);
  assert.equal(scheduled.status, "Agendada");
  assert.equal(scheduled.recipients, 10);
  const cancelled = await campaigns.cancelSchedule(campaign.id);
  assert.equal(cancelled.status, "Em revisão");
  assert.equal(cancelled.scheduledAt, undefined);
});
