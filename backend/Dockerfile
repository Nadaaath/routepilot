FROM node:24-bookworm-slim AS build
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/routepilot_build

RUN npm run prisma:generate
RUN npm run build


FROM node:24-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

EXPOSE 5000

CMD ["node", "dist/server.js"]