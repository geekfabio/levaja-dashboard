import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockActivities } from "@/data/crm/mock/activities";
import { isRepositoryError } from "@/data/crm/repositories";
import { useActivitiesStore } from "@/stores/activities-store";
import type { Activity } from "@/data/activities";
import type { Task } from "@/data/tasks";

function repo() {
  return createMockActivities(0);
}

const ACTIVITY: Activity = {
  id: "act-teste",
  type: "Chamada",
  companyId: "boa-esperanca",
  companyName: "Mercearia Boa Esperança",
  owner: "Sara Neto",
  zone: "Luanda",
  date: "2026-10-20",
  note: "Nota de teste.",
};

const TASK: Task = {
  id: "task-teste",
  title: "Tarefa de teste",
  assignee: "Sara Neto",
  dueDate: "2026-10-25",
  status: "Por Fazer",
};

test("create acrescenta à store partilhada", async () => {
  const activities = repo();
  const before = (await activities.list()).length;
  const { activity } = await activities.create(ACTIVITY);
  assert.equal(activity.id, "act-teste");
  assert.equal((await activities.list()).length, before + 1);
  assert.ok(useActivitiesStore.getState().activities.some((item) => item.id === "act-teste"));
});

test("update de id inexistente devolve not_found", async () => {
  const activities = repo();
  await assert.rejects(activities.update("act-inexistente", { note: "x" }), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("remove devolve o índice e restore repõe na mesma posição", async () => {
  const activities = repo();
  await activities.create(ACTIVITY);
  const before = await activities.list();
  const index = before.findIndex((item) => item.id === "act-teste");
  const { activity, index: removedIndex } = await activities.remove("act-teste");
  assert.equal(removedIndex, index);
  assert.ok(!useActivitiesStore.getState().activities.some((item) => item.id === "act-teste"));
  await activities.restore(activity, removedIndex);
  const after = await activities.list();
  assert.equal(after.findIndex((item) => item.id === "act-teste"), index);
});

test("createTask acrescenta e moveTaskStatus altera o estado", async () => {
  const activities = repo();
  await activities.createTask(TASK);
  assert.ok(useActivitiesStore.getState().tasks.some((item) => item.id === "task-teste"));
  const moved = await activities.moveTaskStatus("task-teste", "Feita");
  assert.equal(moved.status, "Feita");
});

test("postponeTask altera a data de prazo", async () => {
  const activities = repo();
  await activities.createTask(TASK);
  const postponed = await activities.postponeTask("task-teste", "2026-11-01");
  assert.equal(postponed.dueDate, "2026-11-01");
});
