#!/usr/bin/env bash
# Crea il pacchetto da installare sul mini PC: build del sito + server PeerJS con le sue dipendenze.
# Uso: deploy/crea-pacchetto.sh [destinazione.tar.gz]   (default: ./ruota-server.tar.gz)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(realpath -m "${1:-ruota-server.tar.gz}")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$REPO"
npm run build
mkdir -p "$TMP/ruota-server/peer"
cp -a dist "$TMP/ruota-server/sito"
rm -f "$TMP/ruota-server/sito/rete.json"
cp deploy/peer-server.mjs deploy/package.json "$TMP/ruota-server/peer/"
(cd "$TMP/ruota-server/peer" && npm install --omit=dev --no-audit --no-fund --silent)
cp deploy/installa.sh deploy/nginx-ruota.conf deploy/ruota-peer.service "$TMP/ruota-server/"
chmod 755 "$TMP/ruota-server/installa.sh"
tar -czf "$OUT" -C "$TMP" ruota-server
echo "Pacchetto: $OUT ($(du -h "$OUT" | cut -f1))"
