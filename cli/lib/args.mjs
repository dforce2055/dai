// dai · parser de argumentos del CLI (cero dependencias).
// Distingue flags BOOLEANOS (`--force`, `--global`, `--dry-run`) de flags con
// VALOR (`--us x`, `--local repo`): un flag toma valor solo si lo que sigue no es
// otro flag. Así `--global --dry-run` NO consume mal el segundo.

export const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

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
