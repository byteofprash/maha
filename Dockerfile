FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./
RUN mkdir -p /app/data
# SQLite DB + backups live here: mount a persistent volume on /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server/index.mjs"]
