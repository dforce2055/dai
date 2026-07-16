// Test de integración de `dai sync` — corre el CLI de verdad (subproceso), porque
// cmdSync no se exporta. Cubre la regresión de 0.8.0: el bloque Copilot de sync llamaba
// a `skillToPrompt` (borrada en el pase a Agent Skills nativas), así que `dai sync` en un
// repo Copilot moría con `ReferenceError: skillToPrompt is not defined`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dai.mjs");

function seedRepo({ oldPrompts = false } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "dai-sync-"));
  mkdirSync(join(repo, ".dai"), { recursive: true });
  writeFileSync(join(repo, ".dai", "VERSION"), "0.7.0\n"); // scaffold viejo → hay algo que sincronizar
  if (oldPrompts) {
    mkdirSync(join(repo, ".github", "prompts"), { recursive: true });
    writeFileSync(join(repo, ".github", "prompts", "tdd.prompt.md"), "prompt viejo de dai\n");
  } else {
    mkdirSync(join(repo, ".github", "skills"), { recursive: true }); // detecta Copilot por el layout nativo
  }
  return repo;
}

const run = (repo) => spawnSync(process.execPath, [CLI, "sync", "--for", "copilot", repo], { encoding: "utf8" });

test("dai sync --for copilot no crashea y genera skills nativas (regresión skillToPrompt)", () => {
  const repo = seedRepo();
  const r = run(repo);
  assert.equal(r.status, 0, `dai sync debería salir 0, salió ${r.status}. stderr:\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /skillToPrompt|ReferenceError/, "no debe quedar la referencia a la función borrada");
  const skillsDir = join(repo, ".github", "skills");
  assert.ok(existsSync(skillsDir), "debería crear .github/skills/");
  assert.ok(readdirSync(skillsDir).length >= 7, "debería copiar las 7 skills nativas");
  assert.ok(existsSync(join(skillsDir, "tdd", "SKILL.md")), "cada skill es un dir con SKILL.md (copia cruda)");
});

test("dai sync --for copilot migra el layout viejo: crea skills/ y limpia los .prompt.md", () => {
  const repo = seedRepo({ oldPrompts: true });
  const r = run(repo);
  assert.equal(r.status, 0, `stderr:\n${r.stderr}`);
  assert.ok(existsSync(join(repo, ".github", "skills", "tdd")), "migra a .github/skills/");
  assert.ok(!existsSync(join(repo, ".github", "prompts", "tdd.prompt.md")), "limpia el .prompt.md viejo de dai");
});
