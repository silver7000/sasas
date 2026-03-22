#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p dist
python3 - <<'PY'
from pathlib import Path
import base64
root = Path('.')
html = (root/'minecraft-skin-maker.html').read_bytes()
encoded = base64.b64encode(html).decode('ascii')
script = f'''#!/usr/bin/env bash
set -euo pipefail

APP_CACHE_DIR="${{XDG_CACHE_HOME:-$HOME/.cache}}/minecraft-skin-maker"
APP_FILE="$APP_CACHE_DIR/minecraft-skin-maker.html"
mkdir -p "$APP_CACHE_DIR"
base64 -d > "$APP_FILE" <<'__SKIN_HTML__'
{encoded}
__SKIN_HTML__

if [[ -n "${{SKIN_MAKER_OPEN_CMD:-}}" ]]; then
  "$SKIN_MAKER_OPEN_CMD" "$APP_FILE"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_FILE" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$APP_FILE" >/dev/null 2>&1 &
else
  echo "No se pudo abrir automáticamente el navegador."
  echo "Abre manualmente este archivo: $APP_FILE"
  exit 1
fi

echo "Minecraft Skin Maker se ha abierto en tu navegador."
'''
out = root/'dist'/'MinecraftSkinMaker'
out.write_text(script)
out.chmod(0o755)
print(f'Generado: {out}')
PY
