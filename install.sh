#!/usr/bin/env bash
# dai · shim de arranque para instalación por git-clone.
# Delega TODO en el CLI de Node (única fuente de verdad). Con npm/npx podés usar
# `dai <comando>` directamente y saltearte este script.
#
#   ./install.sh install [--global|--local <repo>] [--force] [--dry-run]
#   ./install.sh init <repo> | docs <destino> | doctor | version
#   ./install.sh skills   → alias de `install` (compat con versiones previas)

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v node >/dev/null 2>&1 || { echo "dai: hace falta Node.js (>=18) para el CLI." >&2; exit 1; }

cmd="${1:-doctor}"
if [ "$cmd" = "skills" ]; then cmd="install"; fi   # compat
shift 2>/dev/null || true

exec node "$HERE/cli/dai.mjs" "$cmd" "$@"
