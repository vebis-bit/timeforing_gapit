#!/usr/bin/env sh
# Enkleste vei til å kjøre GAPIT i Docker: bygger imaget (henter alle pakker) og
# starter containeren. Kjør: ./run.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "→ Opprettet .env.local fra malen."
  echo "  Fyll inn Tripletex-tokens og admin-passord, og kjør ./run.sh på nytt."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Fant ikke Docker Compose. Installer Docker Desktop, eller:"
  echo "  brew install colima docker-buildx docker-compose && colima start"
  exit 1
fi

echo "→ Bygger og starter (kan ta et par minutter første gang)…"
$COMPOSE up -d --build

echo "✓ GAPIT kjører på http://localhost:3000"
echo "  Logg:  $COMPOSE logs -f"
echo "  Stopp: $COMPOSE down"
