// Test de integración de `dai link-us --resync` — corre el CLI de verdad (subproceso),
// porque cmdLinkUs no se exporta. Backend md (offline).
// Regresión del issue #58: con el ac_hash al día, --resync cortaba con "nada que
// resincronizar" y un link que había quedado en `version: pendiente` no tenía arreglo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { acHash } from "../lib/ac-hash.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dai.mjs");

const US = "# Login\n\n| Campo | Valor |\n| --- | --- |\n| spec\\_version | `v2` |\n\n" +
  "## Criterios de aceptación\n\n- AC-1: el usuario entra con su mail.\n";

function seedRepo(version) {
  const repo = mkdtempSync(join(tmpdir(), "dai-resync-"));
  mkdirSync(join(repo, ".dai", "us"), { recursive: true });
  writeFileSync(join(repo, ".dai", "us", "ABC-1.md"), US);
  const yaml = join(repo, "openspec", "changes", "login", "implements.yaml");
  mkdirSync(dirname(yaml), { recursive: true });
  writeFileSync(yaml, `change: login\nrepo: api\n\nimplements:\n  - id: ABC-1\n    version: ${version}\n    ac_hash: ${acHash(US)}\n`);
  return { repo, yaml };
}

const run = (repo, ...args) => spawnSync(process.execPath, [CLI, "link-us", "ABC-1", "--resync", ...args], {
  cwd: repo, encoding: "utf8", env: { ...process.env, DAI_PM: "md" },
});

test("link-us --resync completa la versión aunque el ac_hash esté al día", () => {
  const { repo, yaml } = seedRepo("pendiente");
  const r = run(repo);
  assert.equal(r.status, 0, `stderr:\n${r.stderr}`);
  assert.match(readFileSync(yaml, "utf8"), /version: v2/);
  assert.match(r.stdout, /version pendiente → v2/);
});

test("link-us --resync con hash y versión al día no toca nada", () => {
  const { repo, yaml } = seedRepo("v2");
  const before = readFileSync(yaml, "utf8");
  const r = run(repo);
  assert.equal(r.status, 0, `stderr:\n${r.stderr}`);
  assert.match(r.stdout, /Nada que resincronizar/);
  assert.equal(readFileSync(yaml, "utf8"), before);
});
