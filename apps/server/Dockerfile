# api와 engine이 같은 이미지를 써요. 빌드 컨텍스트는 저장소 루트예요 (npm workspaces 잠금 파일이 거기 있어요)
#   docker build -f apps/server/Dockerfile .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@sonic-tradelytics/server --include-workspace-root=false --ignore-scripts
COPY apps/server apps/server
RUN npm run build --workspace=@sonic-tradelytics/server

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@sonic-tradelytics/server --include-workspace-root=false --ignore-scripts --omit=dev \
  && npm cache clean --force \
  && mkdir /data && chown node /data
COPY --from=build /app/apps/server/dist apps/server/dist
WORKDIR /app/apps/server
USER node
CMD ["node", "dist/main.js"]
