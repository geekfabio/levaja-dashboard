import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { loadEnv } from "../env";
import * as schema from "./schema/index";

const env = loadEnv();

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export { schema };
