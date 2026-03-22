FROM node:20-alpine AS base
WORKDIR /app

# Install all dependencies (including dev for prisma generate)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (requires prisma devDep)
RUN npx prisma generate

# Prune dev dependencies after generation
RUN npm prune --omit=dev

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "--import", "tsx", "src/index.ts"]
