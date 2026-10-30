FROM node:24.21.0-bookworm-slim
ARG OA_RELEASE=unversioned
LABEL org.opencontainers.image.version=$OA_RELEASE
WORKDIR /workspace
COPY apps/control-api/package.json apps/control-api/package-lock.json ./apps/control-api/
COPY tools/nuochong-mcp/package.json tools/nuochong-mcp/package-lock.json ./tools/nuochong-mcp/
RUN npm ci --prefix apps/control-api --ignore-scripts --no-audit --no-fund && npm ci --prefix tools/nuochong-mcp --ignore-scripts --no-audit --no-fund
COPY apps/control-api/src ./apps/control-api/src
COPY apps/control-api/test ./apps/control-api/test
COPY apps/control-api/deploy/ci/host-cycle.mjs ./apps/control-api/deploy/ci/host-cycle.mjs
COPY tools/nuochong-cli ./tools/nuochong-cli
COPY tools/nuochong-mcp/src ./tools/nuochong-mcp/src
COPY tools/nuochong-mcp/test ./tools/nuochong-mcp/test
USER node
CMD ["node", "apps/control-api/src/probe-sdk.mjs"]
