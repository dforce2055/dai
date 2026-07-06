import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidKey, slugify, branchName, extractTitle, renderImplementsYaml } from "../lib/link-us.mjs";

test("valida keys del tracker (agnóstico: Jira, ClickUp, custom)", () => {
  assert.ok(isValidKey("ABC-482"));  // jira-style
  assert.ok(isValidKey("86cxyz1"));  // clickup-style (minúsculas/alfanumérico)
  assert.ok(isValidKey("ABC_123"));  // custom
  assert.ok(!isValidKey(""));            // vacío
  assert.ok(!isValidKey("con espacio")); // espacios
  assert.ok(!isValidKey("a/b"));         // barras (rompería branch/URL)
});

test("slugify quita acentos y normaliza", () => {
  assert.equal(slugify("Finalización de la compra del carrito"),
    "finalizacion-de-la-compra-del-carrito");
  assert.equal(slugify("  Múltiples  espacios!! "), "multiples-espacios");
});

test("branchName combina key + slug", () => {
  assert.equal(branchName("ABC-482", "Finalizar la compra"),
    "feature/ABC-482-finalizar-la-compra");
});

test("extractTitle saltea la cabecera de metadata", () => {
  const md = `# 🔗 Metadata de trazabilidad\n\n| ID | ABC-482 |\n\n# Finalizar la compra del carrito\n\n## Historia`;
  assert.equal(extractTitle(md), "Finalizar la compra del carrito");
});

test("renderImplementsYaml produce el schema del ADR-0004", () => {
  const y = renderImplementsYaml({
    change: "finalizar-compra", repo: "frontend",
    id: "ABC-482", version: "v1", ac_hash: "7f3a9c2e", autor: "D. Force",
  });
  assert.match(y, /^change: finalizar-compra$/m);
  assert.match(y, /^repo:   frontend$/m);
  assert.match(y, /id: ABC-482/);
  assert.match(y, /ac_hash: 7f3a9c2e/);
  assert.match(y, /autor: D\. Force/);
});

import { mkdtempSync as mkdt, mkdirSync as mkd, writeFileSync as wf, readFileSync as rf } from "node:fs";
import { tmpdir as td } from "node:os";
import { join as jn } from "node:path";

test("renderImplementsYaml + resync: reemplaza ac_hash y version sin tocar el resto", () => {
  // Simula el reemplazo quirúrgico que hace --resync sobre un yaml existente.
  const orig = renderImplementsYaml({ change: "c", repo: "r", id: "X-1", version: "v1", ac_hash: "aaaaaaaa", autor: "Dev" });
  const resynced = orig.replace(/^(\s*ac_hash:\s*).*$/m, "$1bbbbbbbb").replace(/^(\s*version:\s*).*$/m, "$1v2");
  assert.match(resynced, /ac_hash: bbbbbbbb/);
  assert.match(resynced, /version: v2/);
  assert.match(resynced, /id: X-1/);        // identidad intacta
  assert.match(resynced, /autor: Dev/);     // resto intacto
  assert.doesNotMatch(resynced, /aaaaaaaa/);
});

test("slugify corta en palabra completa cuando excede el máximo", () => {
  const s = slugify("Confirmación deliberada antes de ejecutar acciones con consecuencias");
  assert.ok(s.length <= 42, "no excede el máximo");
  assert.ok(!s.endsWith("-"), "no termina en guion");
  assert.doesNotMatch(s, /conse$/, "no corta a mitad de palabra");
  // títulos cortos quedan intactos
  assert.equal(slugify("Modal de confirmación"), "modal-de-confirmacion");
});
