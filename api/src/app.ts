import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./env";
import { registerErrorHandler } from "./plugins/error-handler";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";

export async function buildApp() {
  const env = loadEnv();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true, credentials: true });
  await app.register(cookie, { secret: env.ADMIN_SESSION_SECRET });

  registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);

  return app;
}
