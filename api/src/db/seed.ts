import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "../lib/ids";

/**
 * Dados iniciais da plataforma. Idempotente: pode correr-se as vezes que for
 * preciso, só acrescenta o que falta. Preços e definições não precisam de linha
 * (têm valores por omissão no código até alguém os mudar no painel).
 *
 * Os centros e raios das zonas são aproximados; corrigem-se em Zonas, no painel.
 */
const ADMIN = { email: "trindadecode@gmail.com", name: "Administrador AngoLeva" };

const ZONES: { name: string; lat: number; lng: number; radiusKm: number }[] = [
  { name: "Ingombota", lat: -8.8147, lng: 13.2302, radiusKm: 3 },
  { name: "Maianga", lat: -8.832, lng: 13.238, radiusKm: 3 },
  { name: "Rangel", lat: -8.823, lng: 13.265, radiusKm: 3 },
  { name: "Sambizanga", lat: -8.8, lng: 13.24, radiusKm: 3 },
  { name: "Samba", lat: -8.8858, lng: 13.213, radiusKm: 4 },
  { name: "Kilamba Kiaxi", lat: -8.93, lng: 13.26, radiusKm: 5 },
  { name: "Cazenga", lat: -8.835, lng: 13.29, radiusKm: 4 },
  { name: "Viana", lat: -8.905, lng: 13.375, radiusKm: 8 },
  { name: "Cacuaco", lat: -8.775, lng: 13.368, radiusKm: 7 },
  { name: "Talatona", lat: -8.9167, lng: 13.1833, radiusKm: 6 },
  { name: "Belas", lat: -9.0, lng: 13.17, radiusKm: 8 },
  { name: "Kilamba", lat: -8.998, lng: 13.265, radiusKm: 5 },
];

async function ensureAdmin() {
  const [existing] = await db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.email, ADMIN.email), eq(schema.accounts.kind, "admin")))
    .limit(1);
  if (existing) return "já existia";
  await db.insert(schema.accounts).values({ id: newId("acc"), kind: "admin", email: ADMIN.email, fullName: ADMIN.name, active: true, adminRole: "admin", passwordHash: null });
  return "criado";
}

async function ensureZones() {
  const existing = new Set((await db.select({ name: schema.zones.name }).from(schema.zones)).map((zone) => zone.name));
  let created = 0;
  for (const zone of ZONES) {
    if (existing.has(zone.name)) continue;
    await db.insert(schema.zones).values({ id: newId("zn"), name: zone.name, lat: zone.lat.toString(), lng: zone.lng.toString(), radiusKm: zone.radiusKm.toString() });
    created += 1;
  }
  return created;
}

/** Zonas deixadas por testes antigos ("Zona <nome> <hex>") que não chegaram a ser apagadas. */
async function removeTestZones() {
  const removed = await db.delete(schema.zones).where(sql`${schema.zones.name} ~ '^Zona .+ [0-9a-f]{6}$'`).returning({ name: schema.zones.name });
  return removed.map((zone) => zone.name);
}

console.log("administrador:", await ensureAdmin());
console.log("zonas de teste removidas:", (await removeTestZones()).join(", ") || "nenhuma");
console.log("zonas criadas:", await ensureZones());
process.exit(0);
