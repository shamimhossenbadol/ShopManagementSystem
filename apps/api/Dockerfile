FROM node:20-alpine AS builder

WORKDIR /app/apps/api

COPY apps/api/package.json ./
RUN npm install

COPY apps/api ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app/apps/api

ENV NODE_ENV=production

RUN apk add --no-cache postgresql-client

COPY apps/api/package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
