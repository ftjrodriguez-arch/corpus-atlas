#!/bin/sh
# Corpus Atlas sin internet (Linux): sh abrir-corpus-linux.sh
cd "$(dirname "$0")" || exit 1
PORT=8765
echo "Abriendo Corpus Atlas en http://localhost:$PORT/index.html (cierra esta ventana para salir)"
( sleep 2; xdg-open "http://localhost:$PORT/index.html" >/dev/null 2>&1 ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
