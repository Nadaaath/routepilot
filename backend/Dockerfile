# =========================
# BUILD STAGE
# =========================
FROM node:24-bookworm-slim AS build

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

# Includes dev dependencies needed for TypeScript compilation
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

# Build-time placeholder only
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/routepilot_build?schema=public

RUN npm run prisma:generate
RUN npm run build


# =========================
# RUNTIME STAGE
# =========================
FROM node:24-bookworm-slim AS runtime

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

# Only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 8000

CMD ["node", "dist/server.js"]