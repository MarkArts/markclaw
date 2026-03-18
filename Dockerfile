FROM node:22-slim

# Install Docker CLI so the main process can spawn agent containers
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY container/ ./container/
COPY public/ ./public/
COPY groups/global/CLAUDE.md ./groups/global/CLAUDE.md
COPY groups/global/TIPS.md ./groups/global/TIPS.md
COPY groups/global/learned-rules.md ./groups/global/learned-rules.md

RUN npx tsc
# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create directories for mounted volumes
RUN mkdir -p store data logs groups .ssh

# HOME must match where docker-compose mounts .credentials.json
ENV HOME=/root

EXPOSE 8080

CMD ["node", "dist/index.js"]
