import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./env";
import { registerErrorHandler } from "./plugins/error-handler";
import { authRoutes } from "./routes/auth";
import { adminAuthRoutes } from "./routes/admin-auth";
import { healthRoutes } from "./routes/health";
import { providerRoutes } from "./routes/providers";
import { requestRoutes } from "./routes/requests";
import { crmCompaniesRoutes } from "./routes/crm-companies";
import { crmContactsRoutes } from "./routes/crm-contacts";
import { crmOpportunitiesRoutes } from "./routes/crm-opportunities";
import { crmTicketsRoutes } from "./routes/crm-tickets";

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
  await app.register(providerRoutes);
  await app.register(crmCompaniesRoutes);
  await app.register(crmContactsRoutes);
  await app.register(crmOpportunitiesRoutes);
  await app.register(crmTicketsRoutes);

  return app;
}
