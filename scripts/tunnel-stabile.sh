#!/usr/bin/env bash
# Legge solo il nome pubblico; il token rimane nel file privato di cloudflared.
stable_tunnel_url() {
  [ -s "$1" ] && [ -s "$2" ] || { echo "Configurazione tunnel stabile incompleta." >&2; return 1; }
  local stable_address
  stable_address=$(tr -d '\r\n' < "$2")
  stable_address=${stable_address%/}
  [[ "$stable_address" =~ ^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$ ]] || {
    echo "Indirizzo tunnel non valido: serve https:// seguito dal dominio, senza percorsi o credenziali." >&2; return 1;
  }
  printf '%s\n' "$stable_address"
}
