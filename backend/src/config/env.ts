import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;
const orsApiKey = process.env.ORS_API_KEY;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

if (!orsApiKey) {
  throw new Error("ORS_API_KEY is required");
}

const parsedPort = Number(process.env.PORT ?? 5000);

export const env = {
  DATABASE_URL: databaseUrl,
  ORS_API_KEY: orsApiKey,
  PORT: parsedPort,
};