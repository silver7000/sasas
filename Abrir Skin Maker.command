#!/bin/sh
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP="$SCRIPT_DIR/minecraft-skin-maker.html"
if command -v open >/dev/null 2>&1; then
  open "$APP"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP"
else
  echo "Abre manualmente este archivo en tu navegador: $APP"
fi
