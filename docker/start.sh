#!/usr/bin/env bash
set -eu

cd /srv/api
npm run --silent db:migrate
npm run --silent db:seed

PORT=4000 npm start &

cd /srv/panel
npx next start -H 127.0.0.1 -p 3000 &

caddy run --config /srv/Caddyfile --adapter caddyfile &

wait -n
exit $?
