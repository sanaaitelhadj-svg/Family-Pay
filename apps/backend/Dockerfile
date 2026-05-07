FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

# ── DÉVELOPPEMENT ─────────────────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── BUILD ─────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
# installe TOUTES les dépendances (y compris TypeScript, ts-node, etc.)
COPY . .
RUN npx prisma generate && npm run build

# ── PRODUCTION ────────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# prod uniquement pour l'image finale légère
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
