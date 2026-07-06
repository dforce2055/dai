// dai · utilidades de filesystem para el instalador (cero dependencias).

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

// Mapa { pathRelativo → contenido } de todos los archivos bajo dir.
export function fileMap(dir, base = dir, map = {}) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) fileMap(p, base, map);
    else map[relative(base, p)] = readFileSync(p, "utf8");
  }
  return map;
}

// ¿Dos directorios tienen exactamente los mismos archivos con el mismo contenido?
export function dirsEqual(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  const ma = fileMap(a), mb = fileMap(b);
  const ka = Object.keys(ma).sort(), kb = Object.keys(mb).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => ma[k] === mb[k]);
}
