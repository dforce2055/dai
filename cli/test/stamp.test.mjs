// Test de integración de `dai stamp` — corre el CLI de verdad (subproceso), porque
// cmdStamp no se exporta. Usa el backend md: ahí "estampar" es escribir
// .dai/us/<ID>.coverage.md, así que se puede afirmar que el dry-run NO escribe.
// Regresión de los issues #57/#61: --dry-run se documentaba y no se leía nunca, y el
// "preview" ya dejaba el comentario en el tracker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { acHash } from "../lib/ac-hash.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dai.mjs");

const US = "# Login\n\n## Criterios de aceptación\n\n- AC-1: el usuario entra con su mail.\n";

function seedRepo() {
  const repo = mkdtempSync(join(tmpdir(), "dai-stamp-"));
  const g = (...a) => execFileSync("git", a, { cwd: repo, stdio: "ignore" });
  g("init", "-q", "-b", "feature/ABC-1-login");
  g("config", "user.email", "t@t"); g("config", "user.name", "t");
  mkdirSync(join(repo, ".dai", "us"), { recursive: true });
  writeFileSync(join(repo, ".dai", "us", "ABC-1.md"), US);
  mkdirSync(join(repo, "openspec", "changes", "login"), { recursive: true });
  writeFileSync(join(repo, "openspec", "changes", "login", "implements.yaml"),
    `change: login\nrepo: api\n\nimplements:\n  - id: ABC-1\n    version: v1\n    ac_hash: ${acHash(US)}\n`);
  g("add", "."); g("commit", "-q", "-m", "init");
  return repo;
}

const run = (repo, ...args) => spawnSync(process.execPath, [CLI, "stamp", ...args], {
  cwd: repo, encoding: "utf8", env: { ...process.env, DAI_PM: "md" },
});
const coverage = (repo) => join(repo, ".dai", "us", "ABC-1.coverage.md");

test("dai stamp --dry-run no escribe en el tracker y lo dice", () => {
  const repo = seedRepo();
  const r = run(repo, "--dry-run");
  assert.equal(r.status, 0, `stderr:\n${r.stderr}`);
  assert.ok(!existsSync(coverage(repo)), "el dry-run no debe estampar");
  assert.match(r.stdout, /\[dry-run\] ABC-1/);
  assert.match(r.stdout, /estamparía ABC-1/, "en condicional: todavía no se estampó");
  assert.doesNotMatch(r.stdout, /^✓/m, "el ✓ es el de la escritura consumada");
});

test("dai stamp sin --dry-run sí estampa (el corte no se come la corrida real)", () => {
  const repo = seedRepo();
  const r = run(repo);
  assert.equal(r.status, 0, `stderr:\n${r.stderr}`);
  assert.ok(existsSync(coverage(repo)), "la corrida real estampa");
  assert.match(r.stdout, /✓ ABC-1/);
});
