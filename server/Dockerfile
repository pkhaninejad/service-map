FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace manifests and shared sources
COPY package.json pnpm-lock.yaml ./
COPY src/schema.ts src/schema.ts
COPY src/graph/buildGraph.ts src/graph/buildGraph.ts
COPY data/ data/

# Copy server package
COPY server/package.json server/pnpm-lock.yaml server/
COPY server/src/ server/src/
COPY server/tsconfig.json server/

# Install server deps only (no devDeps)
WORKDIR /app/server
RUN pnpm install --frozen-lockfile --prod

EXPOSE 47821

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["node", "--import", "tsx/esm", "src/server.ts"]
