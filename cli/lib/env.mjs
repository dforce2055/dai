// dai · loader mínimo de .env (cero dependencias).
// Carga variables desde un archivo .env SIN pisar las que ya estén en el entorno
// (para que un valor exportado en la shell/CI gane sobre el archivo).

import { readFileSync } from "node:fs";

// Config de dai: `.env.dai` (propio, nunca versionado) tiene prioridad sobre `.env`.
// Pensado para equipos que versionan el `.env` (política de empresa): dai deja ese
// archivo en paz y pone sus claves y secretos en `.env.dai` (gitignored). Se carga
// `.env.dai` PRIMERO porque el loader es "primero-gana" (ver más abajo), así la
// precedencia queda: entorno (shell/CI) > .env.dai > .env. Leer también `.env`
// mantiene compatibilidad con repos previos que tienen los DAI_* ahí.
export function loadDaiEnv(env = process.env) {
  loadEnv(".env.dai", env);
  loadEnv(".env", env);
  return env;
}

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
    } else {
      // Valor sin comillas: recortar comentario inline (espacio + #). Evita que un
      // `TOKEN=xxx  # nota` meta la nota — y caracteres no-ASCII como ← — en el valor,
      // que después rompen headers HTTP (ByteString). Para conservar un # literal, usar comillas.
      const c = val.search(/\s#/);
      if (c !== -1) val = val.slice(0, c).trimEnd();
    }
    if (!(key in env)) env[key] = val;
  }
  return env;
}
