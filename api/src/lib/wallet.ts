import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { serviceRequests, wallets, walletTransactions } from "../db/schema/ops";
import { newId } from "./ids";

const SERVICE_TITLE: Record<string, string> = {
  tow: "Reboque",
  cargo: "Carga",
  small_move: "Mudança pequena",
  house_move: "Mudança de casa",
};

async function requestLabel(requestId: string) {
  const [request] = await db
    .select({ code: serviceRequests.code, serviceType: serviceRequests.serviceType })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId))
    .limit(1);
  if (!request) return { title: "Serviço", serviceType: undefined };
  const label = SERVICE_TITLE[request.serviceType] ?? request.serviceType;
  return { title: `${label} · ${request.code}`, serviceType: request.serviceType };
}

/**
 * Credita o ganho de um pedido entregue na carteira do prestador: cria a
 * carteira se ainda não existir, soma o saldo e regista a transacção.
 * Idempotente por `requestId` — chamar duas vezes para o mesmo pedido não
 * credita duas vezes.
 */
export async function creditEarning(providerAccountId: string, requestId: string, amountKz: number) {
  const [existing] = await db
    .select()
    .from(walletTransactions)
    .where(and(eq(walletTransactions.requestId, requestId), eq(walletTransactions.type, "earning")))
    .limit(1);
  if (existing) return existing;

  const [wallet] = await db.select().from(wallets).where(eq(wallets.providerAccountId, providerAccountId)).limit(1);
  if (!wallet) {
    await db.insert(wallets).values({ providerAccountId, balanceKz: amountKz });
  } else {
    await db
      .update(wallets)
      .set({ balanceKz: wallet.balanceKz + amountKz })
      .where(eq(wallets.providerAccountId, providerAccountId));
  }

  const { title, serviceType } = await requestLabel(requestId);

  const [transaction] = await db
    .insert(walletTransactions)
    .values({
      id: newId("tx"),
      providerAccountId,
      type: "earning",
      title,
      amountKz,
      status: "completed",
      serviceType,
      requestId,
    })
    .returning();

  return transaction;
}
