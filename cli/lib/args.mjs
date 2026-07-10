// dai · parser de argumentos del CLI (cero dependencias).
// Distingue flags BOOLEANOS (`--force`, `--global`, `--dry-run`) de flags con
// VALOR (`--us x`, `--local repo`): un flag toma valor solo si lo que sigue no es
// otro flag. Así `--global --dry-run` NO consume mal el segundo.

export const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// Tokens válidos de `--for`. Sirve para detectar el error común de separar la lista
// con un espacio (`--for claude, cursor`): la shell parte antes de que dai lo vea, y
// `cursor` cae como posicional (el `<repo>`). Con esto damos un hint claro.
const ASSISTANT_TOKENS = new Set(["claude", "copilot", "cursor", "both", "all"]);
export const isAssistantToken = (s) => ASSISTANT_TOKENS.has(String(s ?? "").toLowerCase());

// Parsea el valor de `--for` como una LISTA COMBINABLE de asistentes.
// Acepta "claude", "copilot", "cursor" (combinables con coma o espacio),
// "both" (= claude+copilot) y "all" (= los tres). Lanza si hay un token inválido.
// Ej.: "claude,cursor" → { claude:true, copilot:false, cursor:true }.
export function parseAssistants(str) {
  const want = { claude: false, copilot: false, cursor: false };
  const toks = String(str ?? "all").toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (toks.length === 0) { want.claude = want.copilot = want.cursor = true; return want; }
  for (const t of toks) {
    if (t === "all") { want.claude = want.copilot = want.cursor = true; }
    else if (t === "both") { want.claude = want.copilot = true; }
    else if (t in want) { want[t] = true; }
    else throw new Error(`asistente inválido: '${t}' (claude|copilot|cursor, combinables con coma; o both|all)`);
  }
  return want;
}

export function parseFlags(argv) {
  const opts = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = camel(a.slice(2));
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { opts[key] = next; i++; }
      else opts[key] = true;                 // flag booleano
    } else {
      pos.push(a);
    }
  }
  return { opts, pos };
}
