import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { devices } from "../db/schema/auth";
import { authenticate } from "../lib/authenticate";
import { apiError } from "../lib/envelope";

const registerDeviceBodySchema = z.object({
  push_token: z.string().min(8),
  platform: z.enum(["android", "ios", "web"]),
  role: z.enum(["client", "provider"]),
});

export async function deviceRoutes(app: FastifyInstance) {
  app.post("/devices", { preHandler: authenticate }, async (request, reply) => {
    const account = request.account!;
    const body = registerDeviceBodySchema.parse(request.body);

    await db
      .insert(devices)
      .values({ pushToken: body.push_token, accountId: account.id, platform: body.platform })
      .onConflictDoUpdate({ target: devices.pushToken, set: { accountId: account.id, platform: body.platform } });

    reply.status(204).send();
  });

  app.delete("/devices/:push_token", { preHandler: authenticate }, async (request, reply) => {
    const { push_token } = request.params as { push_token: string };
    const account = request.account!;

    const [device] = await db.select().from(devices).where(eq(devices.pushToken, push_token)).limit(1);
    if (!device) throw apiError("not_found", "Dispositivo não encontrado.");
    if (device.accountId !== account.id) {
      throw apiError("forbidden", "Este dispositivo pertence a outra conta.");
    }

    await db.delete(devices).where(eq(devices.pushToken, push_token));
    reply.status(204).send();
  });
}
