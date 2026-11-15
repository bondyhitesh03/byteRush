# ByteRush: one container with the website, the API and Java. Works on Render and any Docker host.
# ---- 1) build the website
FROM node:20-bookworm-slim AS web
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2) run the server (Node + a Java compiler)
FROM node:20-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless gcc g++ libc6-dev python3 bash util-linux \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package*.json backend/
RUN cd backend && npm install --omit=dev --no-audit --no-fund
COPY backend/ backend/
COPY --from=web /app/frontend/dist frontend/dist
# The server stays root so that visitors' Java code can be run as the unprivileged user "nobody"
# (it can't read the server's files or environment). Nothing secret is needed for the free setup.
RUN mkdir -p backend/data && chmod 700 backend/data
ENV PUBLIC_MODE=true RUNNER=local HOST=0.0.0.0 PORT=10000 TRUST_PROXY=1 \
    MAX_CONCURRENT_RUNS=1 MAX_CONCURRENT_GRADES=1 RUN_TIMEOUT_MS=15000 COMPILE_TIMEOUT_MS=45000
EXPOSE 10000
CMD ["node", "backend/server.js"]
