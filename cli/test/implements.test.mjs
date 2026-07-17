import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImplements } from "../lib/implements.mjs";

const YAML = `# un comentario
change: finalizar-compra
repo:   frontend

implements:
  - id: ABC-482
    version: v1
    ac_hash: 7f3a9c2e

introduces:
  - guard-carrito-vacio
  - cache-parametros

autor: D. Force (dev)
`;

test("parsea los escalares top-level", () => {
  const p = parseImplements(YAML);
  assert.equal(p.change, "finalizar-compra");
  assert.equal(p.repo, "frontend");
  assert.equal(p.autor, "D. Force (dev)");
});

test("parsea la lista de implements como objetos", () => {
  const p = parseImplements(YAML);
  assert.equal(p.implements.length, 1);
  assert.deepEqual(p.implements[0], { id: "ABC-482", version: "v1", ac_hash: "7f3a9c2e" });
});

test("parsea introduces como lista de escalares", () => {
  const p = parseImplements(YAML);
  assert.deepEqual(p.introduces, ["guard-carrito-vacio", "cache-parametros"]);
});

test("ignora comentarios", () => {
  const p = parseImplements("change: x  # inline\n# full line\nrepo: y");
  assert.equal(p.change, "x");
  assert.equal(p.repo, "y");
});

test("soporta múltiples entradas en implements", () => {
  const p = parseImplements(`change: multi
implements:
  - id: ABC-1
    version: v1
    ac_hash: aaa
  - id: ABC-2
    version: v3
    ac_hash: bbb
`);
  assert.equal(p.implements.length, 2);
  assert.equal(p.implements[1].id, "ABC-2");
  assert.equal(p.implements[1].version, "v3");
});

import { isPlaceholderId, discoverImplements } from "../lib/implements.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";

test("isPlaceholderId detecta plantillas sin completar", () => {
  assert.equal(isPlaceholderId("ABC-###"), true);
  assert.equal(isPlaceholderId("<change-id>"), true);
  assert.equal(isPlaceholderId(""), true);
  assert.equal(isPlaceholderId("86acme731"), false);
  assert.equal(isPlaceholderId("ABC-482"), false);
});

test("discoverImplements ignora el scaffolding de dai (.claude/.github/.dai)", () => {
  const root = mkdtempSync(pjoin(tmpdir(), "dai-disc-"));
  mkdirSync(pjoin(root, "openspec/changes/real"), { recursive: true });
  writeFileSync(pjoin(root, "openspec/changes/real/implements.yaml"), "change: real\nimplements:\n  - id: X-1\n");
  mkdirSync(pjoin(root, ".claude/skills/link-us/templates"), { recursive: true });
  writeFileSync(pjoin(root, ".claude/skills/link-us/templates/implements.yaml"), "change: <x>\nimplements:\n  - id: ABC-###\n");
  const found = discoverImplements(root);
  assert.equal(found.length, 1);
  assert.equal(found[0].change, "real");
});

test("discoverImplements: includeArchived filtra openspec/changes/archive/", () => {
  const dir = mkdtempSync(pjoin(tmpdir(), "dai-arch-"));
  const active = pjoin(dir, "openspec/changes/activo");
  const arch = pjoin(dir, "openspec/changes/archive/viejo");
  mkdirSync(active, { recursive: true });
  mkdirSync(arch, { recursive: true });
  writeFileSync(pjoin(active, "implements.yaml"), "change: activo\nimplements:\n  - id: A-1\n");
  writeFileSync(pjoin(arch, "implements.yaml"), "change: viejo\nimplements:\n  - id: A-0\n");

  const all = discoverImplements(dir).map((f) => f.change).sort();
  assert.deepEqual(all, ["activo", "viejo"]);                        // default: incluye archivados

  const activeOnly = discoverImplements(dir, { includeArchived: false }).map((f) => f.change);
  assert.deepEqual(activeOnly, ["activo"]);                          // saltea archive/
});
