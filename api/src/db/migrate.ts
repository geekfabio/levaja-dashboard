import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { loadEnv } from "../env";

async function main() {
  const env = loadEnv();
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle", migrationsSchema: env.DB_SCHEMA });
  console.log("Migrações aplicadas.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
