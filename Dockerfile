# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG BUILD_IMAGE=node:24.15.0-bookworm@sha256:f22d6a1f082c02f292e86929b5b0442ac2e5eaf438a5dea9b1566601c3e05940
ARG RUNTIME_IMAGE=node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d

FROM ${BUILD_IMAGE} AS toolchain
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace

FROM toolchain AS builder
ARG SOURCE_REVISION
COPY . .
RUN node scripts/write-image-revision.mjs "$SOURCE_REVISION" && rm -rf /workspace/.git
# Git hooks are a developer convenience; the image has no repository to install them into.
RUN --mount=type=cache,id=pickflick-pnpm,target=/pnpm/store \
    HUSKY=0 pnpm install --frozen-lockfile
ARG BACKEND_INTERNAL_URL=http://127.0.0.1:3001
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
RUN SOURCE_REVISION="$(cat .source-revision)" pnpm build

FROM builder AS backend-package
RUN --mount=type=cache,id=pickflick-pnpm,target=/pnpm/store \
    pnpm --config.strict-peer-dependencies=false --filter @pickflick/backend deploy --prod --legacy /out/backend

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

FROM ${RUNTIME_IMAGE} AS frontend
LABEL org.opencontainers.image.source="https://github.com/Shagon1k/PickFlick" \
      org.opencontainers.image.title="PickFlick frontend"
ENV HOSTNAME=0.0.0.0 NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /workspace/apps/frontend/.next/standalone/ ./
COPY --from=builder --chown=node:node /workspace/apps/frontend/.next/static/ ./apps/frontend/.next/static/
USER node
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]

FROM ${RUNTIME_IMAGE} AS backend
LABEL org.opencontainers.image.source="https://github.com/Shagon1k/PickFlick" \
      org.opencontainers.image.title="PickFlick backend"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-package --chown=node:node /out/backend/ ./
COPY --from=builder --chown=node:node /workspace/.source-revision ./.source-revision
USER node
EXPOSE 3001
CMD ["sh", "-c", "export SOURCE_REVISION=\"$(cat .source-revision)\" && exec node dist/main.js"]

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
