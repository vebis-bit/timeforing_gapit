#!/bin/sh
set -e

# data/ er et montert, varig volum. På de fleste hoster (Fly, Railway, Render …)
# opprettes det tomt og eid av root, mens appen kjører som 'node'. Sørg derfor
# for at mappa finnes, er skrivbar for 'node', og har en gyldig groups.json.
mkdir -p /app/data
if [ ! -f /app/data/groups.json ]; then
  printf '{\n  "groups": []\n}\n' > /app/data/groups.json
fi
chown -R node:node /app/data

# Dropp fra root til 'node' og start Next-serveren.
exec su-exec node "$@"
