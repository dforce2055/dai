// dai · loader mínimo de .env (cero dependencias).
// Carga variables desde un archivo .env SIN pisar las que ya estén en el entorno
// (para que un valor exportado en la shell/CI gane sobre el archivo).

import { readFileSync } from "node:fs";

export function loadEnv(path = ".env", env = process.env) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return env; } // sin .env: no pasa nada
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let [, key, val] = m;
    val = val.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in env)) env[key] = val;
  }
  return env;
}
