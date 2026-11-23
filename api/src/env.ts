import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DB_SCHEMA: z.string().min(1).default("angoleva"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ADMIN_SESSION_SECRET: z.string().min(32),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  OTP_FIXED_CODE: z
    .string()
    .regex(/^\d{6}$/, "OTP_FIXED_CODE tem de ter 6 dígitos")
    .refine((value) => value !== "000000", "OTP_FIXED_CODE não pode ser 000000")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Configuração inválida:\n${issues}`);
  }
  return result.data;
}
