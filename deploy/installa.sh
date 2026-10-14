#!/usr/bin/env bash
# Installa o aggiorna La Ruota in un container Debian 13 della rete di casa:
# nginx (sito + proxy PeerJS sulla porta 80), server PeerJS e coturn (TURN sulla porta 3478).
# Va eseguito come root dalla cartella del pacchetto creato da deploy/crea-pacchetto.sh.
#   ./installa.sh           installa/aggiorna
#   ./installa.sh --relay   forza tutto il traffico attraverso il TURN (solo per provarlo)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DEST=/opt/ruota
SEGRETO=/etc/ruota/turn-password
RELAY=false
[ "${1:-}" = "--relay" ] && RELAY=true

[ "$(id -u)" -eq 0 ] || { echo "Eseguire come root"; exit 1; }
for f in sito/index.html peer/peer-server.mjs peer/node_modules nginx-ruota.conf ruota-peer.service; do
  [ -e "$DIR/$f" ] || { echo "Manca $f nel pacchetto"; exit 1; }
done

echo "== Pacchetti"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nginx coturn nodejs

echo "== File"
mkdir -p "$DEST" /etc/ruota
rm -rf "$DEST/sito.nuovo" "$DEST/peer.nuovo"
cp -a "$DIR/sito" "$DEST/sito.nuovo"
cp -a "$DIR/peer" "$DEST/peer.nuovo"
rm -rf "$DEST/sito" "$DEST/peer"
mv "$DEST/sito.nuovo" "$DEST/sito"
mv "$DEST/peer.nuovo" "$DEST/peer"

# Password del TURN: generata la prima volta, poi riusata negli aggiornamenti
if [ ! -s "$SEGRETO" ]; then
  (umask 077; head -c 18 /dev/urandom | base64 | tr -d '/+=' > "$SEGRETO")
fi
PASS="$(cat "$SEGRETO")"
printf '{"turn":{"username":"ruota","credential":"%s","port":3478},"relay":%s}\n' "$PASS" "$RELAY" > "$DEST/sito/rete.json"
chmod 644 "$DEST/sito/rete.json"

echo "== coturn"
cat > /etc/turnserver.conf <<EOF
# La Ruota: TURN per la rete di casa
listening-port=3478
min-port=49160
max-port=49200
fingerprint
lt-cred-mech
realm=ruota
user=ruota:$PASS
no-tls
no-dtls
no-cli
no-multicast-peers
stale-nonce
syslog
EOF
chmod 640 /etc/turnserver.conf
chgrp turnserver /etc/turnserver.conf 2>/dev/null || true
[ -f /etc/default/coturn ] && sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn

echo "== nginx"
cp "$DIR/nginx-ruota.conf" /etc/nginx/sites-available/ruota
ln -sf /etc/nginx/sites-available/ruota /etc/nginx/sites-enabled/ruota
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "== Servizi"
cp "$DIR/ruota-peer.service" /etc/systemd/system/ruota-peer.service
systemctl daemon-reload
systemctl enable -q coturn nginx ruota-peer
systemctl restart coturn ruota-peer
systemctl reload-or-restart nginx

sleep 2
for s in nginx coturn ruota-peer; do
  printf '%-11s %s\n' "$s" "$(systemctl is-active "$s")"
done
IP="$(hostname -I | awk '{print $1}')"
echo
echo "Fatto. Apri sulla TV:  http://$IP/"
$RELAY && echo "ATTENZIONE: relay forzato attivo. Per l'uso normale rilancia ./installa.sh senza --relay."
exit 0
