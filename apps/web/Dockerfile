FROM node:20-alpine AS builder

WORKDIR /app/apps/web

COPY apps/web/package.json ./
RUN npm install

COPY apps/web ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
