# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS app
ENV NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 NPM_CONFIG_FETCH_TIMEOUT=300000
ARG APP_REF=real-data-no-mocks
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch ${APP_REF} https://github.com/geekfabio/leva-ja.git app
WORKDIR /src/app
# Versão web da app sob /app (só afeta a exportação web).
RUN node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("app.json"));j.expo.experiments={...j.expo.experiments,baseUrl:"/app"};fs.writeFileSync("app.json",JSON.stringify(j,null,2))'
RUN npm ci --no-audit --no-fund
ENV EXPO_PUBLIC_API_URL=/api
RUN npx expo export -p web --output-dir /out/app

FROM node:22-bookworm-slim AS panel
ENV NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 NPM_CONFIG_FETCH_TIMEOUT=300000
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_DATA_SOURCE=http NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NPM_CONFIG_FETCH_RETRIES=5 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 NPM_CONFIG_FETCH_TIMEOUT=300000
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=caddy:2 /usr/bin/caddy /usr/bin/caddy
WORKDIR /srv
COPY --from=panel /src /srv/panel
COPY api /srv/api
RUN cd /srv/api && npm ci --no-audit --no-fund
COPY --from=app /out/app /srv/app
COPY Caddyfile /srv/Caddyfile
COPY docker/start.sh /usr/local/bin/start.sh
ENV NODE_ENV=production
EXPOSE 8080 3000
CMD ["/usr/local/bin/start.sh"]
