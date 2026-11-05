import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { db, schema } from "../src/db/client";
import { createAdminSession, insertAdminAccount } from "./helpers/admin";

let app: FastifyInstance;

const adminAccountIds: string[] = [];
const promotionIds: string[] = [];

before(async () => {
  app = await buildApp();
});

after(async () => {
  if (promotionIds.length > 0) {
    await db.delete(schema.promotionUses).where(inArray(schema.promotionUses.promotionId, promotionIds));
    await db.delete(schema.promotions).where(inArray(schema.promotions.id, promotionIds));
  }
  if (adminAccountIds.length > 0) {
    await db.delete(schema.adminAuditLog).where(inArray(schema.adminAuditLog.actorAccountId, adminAccountIds));
    await db.delete(schema.adminSessions).where(inArray(schema.adminSessions.accountId, adminAccountIds));
    await db.delete(schema.accounts).where(inArray(schema.accounts.id, adminAccountIds));
  }
  await app.close();
});

function promotionBody(code: string, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    code,
    name: `Promoção ${code}`,
    kind: "percent",
    value: 10,
    min_order_kz: 1000,
    services: ["cargo"],
    zone_ids: [],
    starts_at: new Date(now - 60_000).toISOString(),
    ends_at: new Date(now + 30 * 24 * 3_600_000).toISOString(),
    budget_kz: 50_000,
    per_client_limit: 1,
    first_order_only: false,
    ...overrides,
  };
}

test("suporte não pode criar promoções (forbidden); finanças cria, vê a lista e o detalhe", async () => {
  const supportAdmin = await insertAdminAccount("support");
  adminAccountIds.push(supportAdmin.id);
  const supportSession = await createAdminSession(app, supportAdmin.id);

  const financeAdmin = await insertAdminAccount("finance");
  adminAccountIds.push(financeAdmin.id);
  const financeSession = await createAdminSession(app, financeAdmin.id);

  const forbidden = await app.inject({
    method: "POST",
    url: "/admin/promotions",
    cookies: supportSession.cookies,
    headers: supportSession.headers,
    payload: promotionBody("SUPTST01"),
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, "forbidden");

  const invalidPercent = await app.inject({
    method: "POST",
    url: "/admin/promotions",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: promotionBody("FINTST01", { value: 90 }),
  });
  assert.equal(invalidPercent.statusCode, 422);

  const create = await app.inject({
    method: "POST",
    url: "/admin/promotions",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: promotionBody("FINTST01"),
  });
  assert.equal(create.statusCode, 200);
  const promotion = create.json().data;
  promotionIds.push(promotion.id);
  assert.equal(promotion.status, "active");
  assert.equal(promotion.code, "FINTST01");

  const duplicate = await app.inject({
    method: "POST",
    url: "/admin/promotions",
    cookies: financeSession.cookies,
    headers: financeSession.headers,
    payload: promotionBody("FINTST01"),
  });
  assert.equal(duplicate.statusCode, 422);

  const list = await app.inject({
    method: "GET",
    url: "/admin/promotions?status=active",
    cookies: supportSession.cookies,
  });
  assert.equal(list.statusCode, 200);
  assert.ok(list.json().data.some((item: { id: string }) => item.id === promotion.id));

  const get = await app.inject({ method: "GET", url: `/admin/promotions/${promotion.id}`, cookies: supportSession.cookies });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.json().data.recent_uses, []);
});

test("pausar sem motivo falha; pausar, retomar e terminar com motivo fica auditado; não pausa uma promoção terminada", async () => {
  const admin = await insertAdminAccount("admin");
  adminAccountIds.push(admin.id);
  const session = await createAdminSession(app, admin.id);

  const create = await app.inject({
    method: "POST",
    url: "/admin/promotions",
    cookies: session.cookies,
    headers: session.headers,
    payload: promotionBody("ADMTST01"),
  });
  assert.equal(create.statusCode, 200);
  const promotion = create.json().data;
  promotionIds.push(promotion.id);

  const pauseNoReason = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/pause`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(pauseNoReason.statusCode, 422);

  const pause = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/pause`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Orçamento a rever." },
  });
  assert.equal(pause.statusCode, 200);
  assert.equal(pause.json().data.status, "paused");

  const pauseAgain = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/pause`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Repetição." },
  });
  assert.equal(pauseAgain.statusCode, 409);
  assert.equal(pauseAgain.json().error.code, "invalid_transition");

  const resume = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/resume`,
    cookies: session.cookies,
    headers: session.headers,
    payload: {},
  });
  assert.equal(resume.statusCode, 200);
  assert.equal(resume.json().data.status, "active");

  const end = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/end`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Campanha concluída." },
  });
  assert.equal(end.statusCode, 200);
  assert.equal(end.json().data.status, "ended");

  const endAgain = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/end`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "De novo." },
  });
  assert.equal(endAgain.statusCode, 409);

  const pauseEnded = await app.inject({
    method: "POST",
    url: `/admin/promotions/${promotion.id}/pause`,
    cookies: session.cookies,
    headers: session.headers,
    payload: { reason: "Já não devia ser possível." },
  });
  assert.equal(pauseEnded.statusCode, 409);

  const auditRows = await db.select().from(schema.adminAuditLog).where(inArray(schema.adminAuditLog.targetId, [promotion.id]));
  const actions = auditRows.map((row) => row.action).sort();
  assert.deepEqual(actions, ["promotion.create", "promotion.end", "promotion.pause", "promotion.resume"]);
});
