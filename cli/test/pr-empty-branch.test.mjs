// Test de integración de `dai pr` con una branch sin commits propios — corre el CLI de
// verdad (subproceso) contra un remoto bare local. Regresión del issue #62: ante "No
// commits between" dai sugería `git push origin <base>`, y seguirlo subió el trabajo
// directo a develop, sin PR ni review. Ahora corta ANTES de pushear y explica por qué.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dai.mjs");

// origin (bare) con `develop`, y un clone parado en una feature branch salida de origin/develop.
function seed() {
  const root = mkdtempSync(join(tmpdir(), "dai-pr-empty-"));
  const origin = join(root, "origin.git"), repo = join(root, "repo");
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: "ignore" });
  g(root, "init", "-q", "--bare", "-b", "develop", origin);
  g(root, "clone", "-q", origin, repo);
  g(repo, "config", "user.email", "t@t"); g(repo, "config", "user.name", "t");
  g(repo, "checkout", "-q", "-b", "develop");
  writeFileSync(join(repo, "a.txt"), "a\n"); g(repo, "add", "."); g(repo, "commit", "-q", "-m", "init");
  g(repo, "push", "-q", "origin", "develop");
  return { repo, g: (...a) => g(repo, ...a), originRef: () => execFileSync("git", ["rev-parse", "develop"], { cwd: origin, encoding: "utf8" }).trim() };
}

const run = (repo) => spawnSync(process.execPath, [CLI, "pr", "--base", "develop", "--yes"], {
  cwd: repo, encoding: "utf8", env: { ...process.env, DAI_PM: "md" },
});

test("dai pr: commits en develop LOCAL y branch vacía → explica cómo moverlos, sin push a develop", () => {
  const { repo, g, originRef } = seed();
  const before = originRef();
  g("checkout", "-q", "-b", "feature/ABC-1-x", "origin/develop");
  g("checkout", "-q", "develop");
  writeFileSync(join(repo, "b.txt"), "b\n"); g("add", "."); g("commit", "-q", "-m", "trabajo en develop por error");
  g("checkout", "-q", "feature/ABC-1-x");

  const r = run(repo);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /1 sin publicar/);
  assert.match(r.stdout, /git branch -f feature\/ABC-1-x develop/);
  assert.doesNotMatch(r.stdout + r.stderr, /git push origin develop/);
  assert.equal(originRef(), before, "dai no tocó la develop del remoto");
});

test("dai pr: branch == origin/develop → nada que proponer, sin sugerir ningún push", () => {
  const { repo, g } = seed();
  g("checkout", "-q", "-b", "feature/ABC-1-x", "origin/develop");
  const r = run(repo);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /no hay nada que proponer/);
  assert.doesNotMatch(r.stdout + r.stderr, /git push/);
});
