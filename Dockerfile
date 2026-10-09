# Stage 1: Build the Vite frontend application
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build production assets
COPY . .
RUN npm run build

# Stage 2: Production lightweight runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled frontend dist and server scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/services ./src/services
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3001

# Launch the unified x402 reverse proxy & static SPA server
CMD ["npx", "tsx", "server/index.ts"]
