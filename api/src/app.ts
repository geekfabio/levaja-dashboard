import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./env";
import { registerErrorHandler } from "./plugins/error-handler";
import { authRoutes } from "./routes/auth";
import { adminAuthRoutes } from "./routes/admin-auth";
import { chatRoutes } from "./routes/chat";
import { deviceRoutes } from "./routes/devices";
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
import { providerRoutes } from "./routes/providers";
import { paymentRoutes } from "./routes/payments";
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
  await app.register(paymentRoutes);
  await app.register(chatRoutes);
  await app.register(deviceRoutes);
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
