import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirsEqual } from "../lib/fsutil.mjs";

function mkTree(files) {
  const root = mkdtempSync(join(tmpdir(), "dai-fs-"));
  for (const [p, c] of Object.entries(files)) {
    const full = join(root, p);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, c);
  }
  return root;
}

test("dirsEqual: idénticos → true", () => {
  const a = mkTree({ "SKILL.md": "hola", "sub/x.md": "y" });
  const b = mkTree({ "SKILL.md": "hola", "sub/x.md": "y" });
  assert.equal(dirsEqual(a, b), true);
});

test("dirsEqual: contenido distinto → false", () => {
  const a = mkTree({ "SKILL.md": "hola" });
  const b = mkTree({ "SKILL.md": "chau" });
  assert.equal(dirsEqual(a, b), false);
});

test("dirsEqual: archivos de más → false", () => {
  const a = mkTree({ "SKILL.md": "hola" });
  const b = mkTree({ "SKILL.md": "hola", "extra.md": "z" });
  assert.equal(dirsEqual(a, b), false);
});

test("dirsEqual: destino inexistente → false", () => {
  const a = mkTree({ "SKILL.md": "hola" });
  assert.equal(dirsEqual(a, join(a, "no-existe")), false);
});
