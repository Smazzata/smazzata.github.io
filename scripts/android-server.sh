#!/data/data/com.termux/files/usr/bin/bash
# Avvia Burraco Online su un telefono Android con Termux e lo rende raggiungibile
# da internet con un tunnel Cloudflare gratuito.
#
#   Primo avvio:   bash ~/burraco/scripts/android-server.sh
#   Avvio automatico all'accensione (serve l'app Termux:Boot):
#                  bash ~/burraco/scripts/android-server.sh --install-boot
#
# Lo script: installa ciò che serve, aggiorna il gioco da GitHub, avvia il server
# (riavviandolo se si ferma), controlla gli aggiornamenti ogni 5 minuti e apre il tunnel.

REPO_URL="https://github.com/simonemuliello010500-web/BurracoByMSF.git"
DIR="$HOME/burraco"
PORT=3000
URL_FILE="$HOME/burraco-indirizzo.txt"
PID_FILE="$HOME/.burraco-server.pid"
UPDATE_EVERY=300

log() { echo "[$(date +%H:%M:%S)] $*"; }

if [ "${1:-}" = "--install-boot" ]; then
  mkdir -p "$HOME/.termux/boot"
  cat > "$HOME/.termux/boot/burraco.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash "$DIR/scripts/android-server.sh" > "$HOME/burraco.log" 2>&1
EOF
  chmod +x "$HOME/.termux/boot/burraco.sh"
  echo "Avvio automatico installato: al prossimo riavvio del telefono Burraco partirà da solo."
  echo "Log in $HOME/burraco.log, indirizzo in $URL_FILE"
  exit 0
fi

# 1. Dipendenze
need=""
command -v node >/dev/null 2>&1 || need="$need nodejs-lts"
command -v git >/dev/null 2>&1 || need="$need git"
command -v cloudflared >/dev/null 2>&1 || need="$need cloudflared"
if [ -n "$need" ]; then
  log "Installo:$need"
  pkg update -y && pkg install -y $need || { echo "Installazione non riuscita"; exit 1; }
fi

# Impedisce ad Android di sospendere Termux
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

# 2. Codice del gioco
if [ ! -d "$DIR/.git" ]; then
  log "Scarico il gioco da GitHub"
  git clone "$REPO_URL" "$DIR" || exit 1
fi
cd "$DIR" || exit 1
git fetch -q origin main && git reset -q --hard origin/main
log "Installo le librerie"
npm ci --omit=dev --no-audit --no-fund || exit 1

# 3. Server, riavviato automaticamente se si ferma
server_loop() {
  while true; do
    PORT=$PORT BOT_DELAY=700 node server/index.js &
    echo $! > "$PID_FILE"
    wait $!
    log "Server fermato, riavvio tra 2 secondi"
    sleep 2
  done
}

# 4. Aggiornamenti automatici da GitHub
update_loop() {
  while true; do
    sleep "$UPDATE_EVERY"
    git fetch -q origin main 2>/dev/null || continue
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
      log "Nuova versione trovata: aggiorno"
      git reset -q --hard origin/main
      npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1
      [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null
    fi
  done
}

cleanup() {
  log "Chiusura"
  [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null
  kill 0 2>/dev/null
}
trap cleanup EXIT INT TERM

server_loop &
update_loop &
sleep 3

# 5. Tunnel pubblico (ripartito se cade). L'indirizzo cambia a ogni riavvio del tunnel.
while true; do
  log "Apro il tunnel Cloudflare…"
  cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" 2>&1 | while IFS= read -r line; do
    url=$(echo "$line" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com')
    if [ -n "$url" ]; then
      echo "$url" > "$URL_FILE"
      echo ""
      echo "=============================================="
      echo "  BURRACO È ONLINE!"
      echo "  Indirizzo da condividere:"
      echo "  $url"
      echo "=============================================="
      echo ""
    fi
  done
  log "Tunnel chiuso, lo riapro tra 5 secondi"
  sleep 5
done
