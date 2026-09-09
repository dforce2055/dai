// Test de integración de `dai release done` — corre el CLI de verdad contra un repo con
// remoto, porque el comando es casi todo efecto (tag, push, back-merge, borrado de rama) y
// su parte delicada es justamente en qué orden hace las cosas y qué reporta cuando una falla.
//
// Cubre la regresión que apareció cerrando la 0.15.0 de este mismo repo: el forge borra la
// rama de release al mergear (auto-delete on merge, el default de GitHub), la ref local
// `origin/<branch>` queda desactualizada, y dai intentaba borrar algo que ya no existía —
// reportando un ⚠ por un estado que en realidad era el correcto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dai.mjs");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Un repo con develop + main, un tag previo, y una rama de release ya mergeada a main:
// el estado exacto en el que corre `dai release done`.
function seed({ borrarRemota = false } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "dai-done-"));
  const repo = join(raiz, "repo"), remoto = join(raiz, "remoto.git");
  execFileSync("git", ["init", "-q", "--bare", remoto]);
  execFileSync("git", ["init", "-q", "-b", "develop", repo]);
  git(repo, "config", "user.email", "ada@acme.test");
  git(repo, "config", "user.name", "Ada Lovelace");
  writeFileSync(join(repo, ".env.dai"), "DAI_PM=md\nDAI_BRANCH_DEV=develop\nDAI_BRANCH_PROD=main\n");
  writeFileSync(join(repo, "VERSION"), "0.1.0");
  writeFileSync(join(repo, "app.js"), "uno\n");
  git(repo, "add", "-A"); git(repo, "commit", "-qm", "chore: base");
  git(repo, "tag", "-a", "v0.1.0", "-m", "v0.1.0");
  git(repo, "remote", "add", "origin", remoto);
  git(repo, "checkout", "-qb", "main"); git(repo, "checkout", "-q", "develop");
  writeFileSync(join(repo, "app.js"), "dos\n");
  git(repo, "add", "-A"); git(repo, "commit", "-qm", "feat: algo nuevo");

  // El corte, hecho con el propio CLI.
  spawnSync(process.execPath, [CLI, "release", "cut", "0.2.0", "--yes"], { cwd: repo, encoding: "utf8" });
  git(repo, "push", "-q", "-u", "origin", "develop", "main", "release/0.2.0");
  git(repo, "checkout", "-q", "main");
  git(repo, "merge", "-q", "--no-ff", "-m", "Merge PR release/0.2.0", "release/0.2.0");
  git(repo, "push", "-q", "origin", "main");
  git(repo, "checkout", "-q", "develop");
  // El forge borra la rama al mergear. Se borra DIRECTO en el remoto, no con `push
  // --delete`, porque eso es lo que hace la diferencia: nuestra ref local `origin/<branch>`
  // sobrevive desactualizada hasta el próximo prune, y es la que engañaba a dai.
  if (borrarRemota) execFileSync("git", ["--git-dir", remoto, "branch", "-D", "release/0.2.0"], { stdio: "ignore" });
  return { raiz, repo };
}

const run = (repo) => spawnSync(process.execPath,
  [CLI, "release", "done", "0.2.0", "--yes", "--no-release"], { cwd: repo, encoding: "utf8" });

test("release done: tag + back-merge + borra la rama de release", () => {
  const { raiz, repo } = seed();
  try {
    const r = run(repo);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.match(r.stdout, /tag v0\.2\.0 creado y publicado/);
    assert.match(r.stdout, /back-merge main → develop/);
    assert.match(r.stdout, /borrada la branch local release\/0\.2\.0/);
    assert.match(r.stdout, /borrada la branch remota/);
    // el tag existe y apunta a main
    assert.equal(git(repo, "tag", "-l", "v0.2.0").trim(), "v0.2.0");
    // develop quedó al día: es el paso que más se olvida a mano
    assert.equal(git(repo, "show", "develop:VERSION").trim(), "0.2.0");
    // y no quedó ninguna rama de release, ni local ni remota
    assert.equal(git(repo, "branch", "--list", "release/*").trim(), "");
    assert.equal(git(repo, "ls-remote", "--heads", "origin", "release/0.2.0").trim(), "");
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

// La regresión: con la rama ya borrada por el forge, dai no tiene que avisar de nada.
// Un ⚠ sobre un estado correcto enseña a ignorar los avisos.
test("release done: si el forge ya borró la rama remota, no reporta un problema", () => {
  const { raiz, repo } = seed({ borrarRemota: true });
  try {
    const r = run(repo);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.match(r.stdout, /borrada la branch local release\/0\.2\.0/);
    assert.doesNotMatch(r.stdout, /no borré/);
    assert.doesNotMatch(r.stdout, /remote ref does not exist/);
    assert.match(r.stdout, /ya no estaba \(la borró el forge al mergear\)/);
    assert.match(r.stdout, /versión 0\.2\.0 cerrada/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test("release done: se niega a re-taguear una versión que ya existe", () => {
  const { raiz, repo } = seed();
  try {
    assert.equal(run(repo).status, 0);
    const otra = run(repo);
    assert.notEqual(otra.status, 0);
    assert.match(otra.stderr, /el tag v0\.2\.0 ya existe/);
    assert.match(otra.stderr, /Una versión no se re-taguea/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

// El tag tiene que apuntar al commit FINAL, así que si producción no declara esa versión
// es que la PR de release no se mergeó: taguear ahí sería etiquetar cualquier cosa.
test("release done: no taguea si producción no declara esa versión", () => {
  const { raiz, repo } = seed();
  try {
    const r = spawnSync(process.execPath,
      [CLI, "release", "done", "0.9.9", "--yes", "--no-release"], { cwd: repo, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /declara la versión 0\.2\.0, no 0\.9\.9/);
    assert.equal(git(repo, "tag", "-l", "v0.9.9").trim(), "");
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
