// dai · higiene de lo que se publica.
//
// dai es un paquete PÚBLICO en npm. Dos cosas no pueden viajar en él, y las dos se
// escaparon de una revisión a ojo antes de que este archivo existiera:
//
//   1. Bytes NUL en un fuente. Se coló un `\x00` donde iba un espacio: el módulo seguía
//      funcionando (los tests pasaban), pero git lo marcaba como binario, así que el
//      diff dejaba de ser revisable y nadie iba a ver el próximo cambio ahí adentro.
//   2. Identificadores de terceros. Un ID de tracker o un nombre de branch de un repo
//      corporativo, copiados de un reporte de bug a un comentario o a un test. La
//      convención del repo es ACME para todo lo que ilustre.
//
// Un `git grep` a mano antes de cada push es exactamente el chequeo que se olvida.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Los archivos que git versiona (= el universo de lo que puede terminar publicado).
// Si git no está disponible (tarball descargado, sandbox), el test se salta solo en vez
// de fallar por algo que no es del código.
function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "buffer" })
      .toString("utf8").split("\0").filter(Boolean);
  } catch { return null; }
}

const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".pdf", ".zip"]);
const isText = (f) => !BINARY_EXT.has(extname(f).toLowerCase());

test("ningún fuente versionado tiene bytes NUL (git lo trataría como binario)", () => {
  const files = trackedFiles();
  if (!files) return;                       // sin git no hay nada que verificar
  const bad = [];
  for (const f of files.filter(isText)) {
    let buf;
    try { buf = readFileSync(join(ROOT, f)); } catch { continue; }
    if (buf.includes(0)) bad.push(f);
  }
  assert.deepEqual(bad, [], `archivos con NUL: ${bad.join(", ")}`);
});

test("los archivos de texto son UTF-8 válido", () => {
  const files = trackedFiles();
  if (!files) return;
  const dec = new TextDecoder("utf8", { fatal: true });
  const bad = [];
  for (const f of files.filter(isText)) {
    let buf;
    try { buf = readFileSync(join(ROOT, f)); } catch { continue; }
    try { dec.decode(buf); } catch { bad.push(f); }
  }
  assert.deepEqual(bad, [], `no son UTF-8: ${bad.join(", ")}`);
});

// Los ejemplos usan ACME (86acme482, ABC-482, acme.com). Cualquier cosa que parezca un
// identificador copiado de un repo real no va — venga de un reporte de bug, de una
// sesión de debug o de un pantallazo.
test("no viajan identificadores de repos de terceros — la convención es ACME", () => {
  const files = trackedFiles();
  if (!files) return;
  // Ids de ClickUp reales que aparecieron en reportes (86 + 7 alfanuméricos que NO son
  // 'acme…'), y los nombres de branch de esos mismos repos.
  const PATRONES = [
    { re: /\b86(?!acme)[a-z0-9]{7,}\b/g, que: "id de ClickUp que no es de la convención ACME" },
    { re: /\b\d{3}ass\b/g, que: "slug de branch de un repo corporativo" },
  ];
  const hits = [];
  for (const f of files.filter(isText)) {
    if (f.startsWith("cli/test/package-hygiene")) continue;   // este archivo los nombra a propósito
    let t;
    try { t = readFileSync(join(ROOT, f), "utf8"); } catch { continue; }
    for (const { re, que } of PATRONES) {
      for (const m of t.matchAll(re)) hits.push(`${f}: '${m[0]}' (${que})`);
    }
  }
  assert.deepEqual(hits, [], `identificadores de terceros:\n  ${hits.join("\n  ")}`);
});

// El sitio (index.html / onboarding.html) vive en el repo pero NO es parte del paquete:
// está fuera de `files[]`. Si se colara, cada `npm i -g dai` bajaría la landing.
test("package.json no publica el sitio ni archivos de entorno", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const files = pkg.files || [];
  assert.ok(files.length > 0, "package.json debería declarar files[] (si no, se publica todo)");
  for (const pat of files) {
    assert.ok(!/\.html$/.test(pat), `files[] no debería incluir html: ${pat}`);
    assert.ok(!/^\.env$|^\.env$/.test(pat), `files[] no debería incluir el .env: ${pat}`);
  }
});
