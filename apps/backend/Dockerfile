FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl

# Copie package.json en premier pour profiter du cache Docker
COPY package*.json ./
RUN npm ci

# Copie le reste des sources
COPY . .

# Génère le client Prisma et compile TypeScript
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 4000

# Migrations au démarrage puis lancement du serveur
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
