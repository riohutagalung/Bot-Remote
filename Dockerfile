FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js desktop-server.js ahk-server.js system-server.js device-store.js github-state.cjs backup-crypto.cjs ./
EXPOSE 8080
CMD ["node", "server.js"]
