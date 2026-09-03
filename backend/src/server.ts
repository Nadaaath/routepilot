import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function start() {
  await prisma.$connect();

  const server = app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(async (error) => {
  console.error("Failed to start API:", error);
  await prisma.$disconnect();
  process.exit(1);
});
