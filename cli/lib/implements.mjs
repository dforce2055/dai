// dai · parseo y descubrimiento de implements.yaml (ADR-0004).
// Parser YAML mínimo para NUESTRO schema (cero dependencias). No es un parser
// general de YAML: cubre exactamente la forma del implements.yaml.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "vendor", "coverage", ".next", ".cache",
  // scaffolding del propio dai: contienen implements.yaml de PLANTILLA, no trabajo real
  ".claude", ".github", ".dai",
]);

// ¿El id es todavía un placeholder de plantilla (ABC-###, <change-id>)? No es una US real.
export function isPlaceholderId(id) {
  return !id || /[#<>]/.test(id);
}

function unquote(v) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function stripComment(line) {
  // quita comentarios: `#` al inicio o precedido por espacio (nuestros valores no llevan #)
  return line.replace(/(^|\s)#.*$/, "").replace(/\s+$/, "");
}

// Parsea el texto de un implements.yaml a un objeto estructurado.
export function parseImplements(text) {
  const out = { change: null, repo: null, implements: [], introduces: [], autor: null };
  let listKey = null;   // key top-level cuyo valor es una lista
  let curObj = null;    // objeto actual dentro de una lista de objetos

  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();

    if (indent === 0) {
      const m = body.match(/^([\w-]+):\s*(.*)$/);
      if (!m) continue;
      const [, key, val] = m;
      if (val === "") { out[key] = out[key] ?? []; listKey = key; curObj = null; }
      else { out[key] = unquote(val); listKey = null; curObj = null; }
      continue;
    }

    // línea indentada: pertenece a la lista listKey
    if (!listKey) continue;
    if (body.startsWith("- ")) {
      const rest = body.slice(2).trim();
      const kv = rest.match(/^([\w-]+):\s*(.*)$/);
      if (kv && kv[2] !== "") {           // item objeto: "- id: X"
        curObj = { [kv[1]]: unquote(kv[2]) };
        out[listKey].push(curObj);
      } else {                            // item escalar: "- valor"
        out[listKey].push(unquote(rest));
        curObj = null;
      }
    } else if (curObj) {                  // atributo del objeto actual: "version: v1"
      const kv = body.match(/^([\w-]+):\s*(.*)$/);
      if (kv) curObj[kv[1]] = unquote(kv[2]);
    }
  }
  return out;
}

// Camina el árbol desde root y devuelve { path, ...parsed } por cada implements.yaml.
export function discoverImplements(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (name === "implements.yaml") {
        try {
          found.push({ path: full, ...parseImplements(readFileSync(full, "utf8")) });
        } catch { /* archivo inválido: se ignora en el listado */ }
      }
    }
  };
  walk(root);
  return found;
}
