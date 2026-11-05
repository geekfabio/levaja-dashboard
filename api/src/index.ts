import { buildApp } from "./app";
import { loadEnv } from "./env";

async function main() {
  const env = loadEnv();
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
