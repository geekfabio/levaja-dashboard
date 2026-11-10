import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não definido (ver .env.example)");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  schemaFilter: [process.env.DB_SCHEMA ?? "angoleva"],
  dbCredentials: {
    url: databaseUrl,
  },
});
