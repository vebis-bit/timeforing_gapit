# syntax=docker/dockerfile:1

# ---------- 1. Avhengigheter ----------
# npm ci installerer ALT i package.json (lås-fila må stemme). Disse pakkene
# spores av Next sitt "standalone"-bygg og legges inn i sluttimaget – ingenting
# installeres på maskinen eller ved oppstart.
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Bygg ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- 3. Kjøring ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat su-exec
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Selvstendig server + statiske filer (fra output: "standalone")
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Startverdier for grupper (overstyres av volumet montert på /app/data)
COPY --from=builder --chown=node:node /app/data ./data

# Entrypoint kjører som root: fikser eierskap på volumet /app/data og dropper
# så til 'node' før serveren startes. Se docker-entrypoint.sh.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
