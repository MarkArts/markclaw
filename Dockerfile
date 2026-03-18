FROM node:22-slim

# Install Podman for spawning agent containers (no Docker socket needed)
RUN apt-get update && apt-get install -y \
    podman fuse-overlayfs slirp4netns uidmap ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Configure Podman storage for operation inside a container
RUN mkdir -p /etc/containers /run/containers/storage /var/lib/containers/storage && \
    printf '[storage]\ndriver = "overlay"\nrunroot = "/run/containers/storage"\ngraphroot = "/var/lib/containers/storage"\n[storage.options.overlay]\nmount_program = "/usr/bin/fuse-overlayfs"\n' \
    > /etc/containers/storage.conf && \
    printf '[engine]\ncgroup_manager = "cgroupfs"\nevents_logger = "file"\n' \
    > /etc/containers/containers.conf

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
RUN npm prune --omit=dev

# Create directories for mounted volumes
RUN mkdir -p store data logs groups .ssh

ENV CONTAINER_RUNTIME=podman

EXPOSE 8080

CMD ["node", "dist/index.js"]
