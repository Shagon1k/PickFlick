# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG BUILD_IMAGE=node:22.23.2-bookworm@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d
ARG RUNTIME_IMAGE=node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

FROM ${BUILD_IMAGE} AS toolchain
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace

FROM toolchain AS builder
COPY . .
RUN --mount=type=cache,id=pickflick-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
ARG BACKEND_INTERNAL_URL=http://127.0.0.1:3001
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
RUN pnpm build

FROM builder AS api-package
RUN --mount=type=cache,id=pickflick-pnpm,target=/pnpm/store \
    pnpm --config.strict-peer-dependencies=false --filter @pickflick/api deploy --prod --legacy /out/api

FROM builder AS worker-package
RUN --mount=type=cache,id=pickflick-pnpm,target=/pnpm/store \
    pnpm --config.strict-peer-dependencies=false --filter @pickflick/worker deploy --prod --legacy /out/worker

FROM builder AS release-package
RUN --mount=type=cache,id=pickflick-pnpm,target=/pnpm/store \
    pnpm --config.strict-peer-dependencies=false --filter @pickflick/database deploy --legacy /out/database

FROM toolchain AS openssl-files
RUN mkdir /openssl-root && \
    cp --parents \
      /usr/bin/openssl \
      /usr/lib/*-linux-gnu/libcrypto.so.3 \
      /usr/lib/*-linux-gnu/libssl.so.3 \
      /usr/lib/ssl/openssl.cnf \
      /openssl-root

FROM ${RUNTIME_IMAGE} AS web
LABEL org.opencontainers.image.source="https://github.com/Shagon1k/PickFlick" \
      org.opencontainers.image.title="PickFlick web"
ENV HOSTNAME=0.0.0.0 NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /workspace/apps/web/.next/standalone/ ./
COPY --from=builder --chown=node:node /workspace/apps/web/.next/static/ ./apps/web/.next/static/
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM ${RUNTIME_IMAGE} AS api
LABEL org.opencontainers.image.source="https://github.com/Shagon1k/PickFlick" \
      org.opencontainers.image.title="PickFlick API"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-package --chown=node:node /out/api/ ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM ${RUNTIME_IMAGE} AS worker
LABEL org.opencontainers.image.source="https://github.com/Shagon1k/PickFlick" \
      org.opencontainers.image.title="PickFlick worker"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=worker-package --chown=node:node /out/worker/ ./
USER node
CMD ["node", "dist/main.js"]

FROM ${RUNTIME_IMAGE} AS release
LABEL org.opencontainers.image.source="https://github.com/Shagon1k/PickFlick" \
      org.opencontainers.image.title="PickFlick release"
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=openssl-files /openssl-root/ /
COPY --from=release-package --chown=node:node /out/database/ ./packages/database/
COPY --from=builder --chown=node:node \
    /workspace/node_modules/.pnpm/@prisma+engines@7.10.0/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
    ./packages/database/node_modules/.pnpm/@prisma+engines@7.10.0/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
COPY --from=builder --chown=node:node /workspace/scripts/run-release.mjs ./scripts/run-release.mjs
USER node
CMD ["node", "scripts/run-release.mjs"]
