#!/bin/sh
# =============================================================================
# no-agent-authors · dai · rechaza autoría/co-autoría de agentes de IA
# =============================================================================
# El código de dai lo autora y revisa una persona (ver
# governance/human-authorship.md y CONTRIBUTING.md). Este check rechaza commits
# cuyo *author*, *committer* o `Co-authored-by` sea un agente o bot conocido.
#
# Cero dependencias: POSIX sh + git + grep. No necesita dai, node ni nada más.
#
# Uso:
#   no-agent-authors.sh --range <base>..<head>   # CI: valida un rango de commits
#   no-agent-authors.sh --pending <commit-msg>   # hook: valida el commit en curso
# =============================================================================

# Patrones de identidades de agente (nombre o email), case-insensitive.
# Editable: suma acá cualquier agente nuevo que aparezca.
DENY='cursor|copilot|claude|anthropic|devin|cognition|codeium|windsurf|aider|tabnine|sweep\.dev|\[bot\]'

fail() {
  echo ""
  echo "  ✗  Autoría de agente detectada"
  echo "  ───────────────────────────────────────────────"
  echo "     identidad:   $1"
  echo ""
  echo "     El código de dai lo autora y revisa una persona."
  echo "     No se aceptan commits con author, committer ni"
  echo "     Co-authored-by de un agente o bot."
  echo ""
  echo "     Si un agente te ayudó: revisa el cambio, apropíate"
  echo "     de él y commitea con tu identidad (sin el trailer"
  echo "     del agente). Ver governance/human-authorship.md"
  echo ""
  exit 1
}

# Lee líneas "Nombre <email>" de stdin y falla en el primer match.
check() {
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if printf '%s' "$line" | grep -qiE "$DENY"; then
      fail "$line"
    fi
  done
}

case "$1" in
  --range)
    range="$2"
    [ -z "$range" ] && { echo "uso: $0 --range <base>..<head>" >&2; exit 2; }
    # author, committer y cada Co-authored-by de todos los commits (sin merges:
    # el merge de un PR lo firma la persona que mergea).
    git log --no-merges \
      --format='%an <%ae>%n%cn <%ce>%n%(trailers:key=Co-authored-by,valueonly)' \
      "$range" | check
    ;;
  --pending)
    msg="$2"
    {
      git var GIT_AUTHOR_IDENT    | sed 's/ [0-9]* [-+][0-9]*$//'
      git var GIT_COMMITTER_IDENT | sed 's/ [0-9]* [-+][0-9]*$//'
      [ -n "$msg" ] && [ -f "$msg" ] && \
        grep -iE '^co-authored-by:' "$msg" | sed 's/^[Cc]o-authored-[Bb]y:[[:space:]]*//'
    } | check
    ;;
  *)
    echo "uso: $0 --range <base>..<head> | --pending <commit-msg-file>" >&2
    exit 2
    ;;
esac
