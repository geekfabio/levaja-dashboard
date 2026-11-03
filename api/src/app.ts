import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./env";
import { registerErrorHandler } from "./plugins/error-handler";
import { authRoutes } from "./routes/auth";
import { adminAuthRoutes } from "./routes/admin-auth";
import { adminAuditRoutes } from "./routes/admin-audit";
import { adminClientRoutes } from "./routes/admin-clients";
import { adminDocumentRoutes } from "./routes/admin-documents";
import { adminMetricsRoutes } from "./routes/admin-metrics";
import { adminPricingRoutes } from "./routes/admin-pricing";
import { adminProviderRoutes } from "./routes/admin-providers";
import { adminRequestRoutes } from "./routes/admin-requests";
import { adminSecurityRoutes } from "./routes/admin-security";
import { adminZoneRoutes } from "./routes/admin-zones";
import { healthRoutes } from "./routes/health";
import { requestRoutes } from "./routes/requests";

export async function buildApp() {
  const env = loadEnv();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true, credentials: true });
  await app.register(cookie, { secret: env.ADMIN_SESSION_SECRET });

  registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminAuthRoutes);
  await app.register(requestRoutes);
  await app.register(adminRequestRoutes);
  await app.register(adminProviderRoutes);
  await app.register(adminClientRoutes);
  await app.register(adminDocumentRoutes);
  await app.register(adminZoneRoutes);
  await app.register(adminPricingRoutes);
  await app.register(adminSecurityRoutes);
  await app.register(adminAuditRoutes);
  await app.register(adminMetricsRoutes);

  return app;
}
