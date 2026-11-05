#!/bin/bash
# Corpus Atlas sin internet (Mac). Si macOS no deja abrirlo: clic derecho > Abrir.
cd "$(dirname "$0")" || exit 1
PORT=8765
echo "Abriendo Corpus Atlas en http://localhost:$PORT/index.html"
echo "Deja esta ventana abierta mientras lo uses. Para cerrar Corpus, cierra esta ventana."
( sleep 2; open "http://localhost:$PORT/index.html" ) &
if command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v ruby >/dev/null 2>&1; then exec ruby -run -e httpd . -p "$PORT" -b 127.0.0.1
else echo "Este Mac necesita Python 3: escribe 'python3' en la Terminal y acepta instalar las herramientas que propone."; read -r; fi
