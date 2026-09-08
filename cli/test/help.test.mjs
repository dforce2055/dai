// La convención de ayuda del CLI. Mitad unitario (lib/help.mjs), mitad integración:
// que `dai <cmd> --help` IMPRIMA y no EJECUTE solo se puede comprobar corriendo el CLI.
//
// Regresión que motiva el archivo: el `--help` caía en `opts` y el comando corría igual.
// Con comandos que hablan hacia afuera eso no es cosmético — `dai stamp --help` dejaba un
// comentario en el tracker y `dai pr --help` publicaba una branch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { isHelpToken, wantsHelp, helpTopic, helpFor, COMMAND_HELP, HELP_ALIAS, globalUsage } from "../lib/help.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "..", "dai.mjs");
// cwd neutro: si por un bug el comando llegara a ejecutarse, no tiene un repo donde actuar.
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: tmpdir() });

test("isHelpToken cubre las formas que tipean humanos y agentes", () => {
  for (const t of ["help", "--help", "-h", "-help", "ayuda", "?", "HELP"]) assert.ok(isHelpToken(t), t);
  for (const t of ["pr", "", null, undefined, "helper"]) assert.ok(!isHelpToken(t), String(t));
});

test("wantsHelp detecta el flag y el positional", () => {
  assert.ok(wantsHelp({ opts: { help: true }, pos: [] }));
  assert.ok(wantsHelp({ opts: { h: true }, pos: [] }));
  assert.ok(wantsHelp({ opts: {}, pos: ["-h"] }));          // `-h` entra como positional
  assert.ok(wantsHelp({ opts: {}, pos: ["help"] }));
  assert.ok(!wantsHelp({ opts: { yes: true }, pos: ["ABC-1"] }));
});

test("helpTopic resuelve alias y `dai help <cmd>`", () => {
  assert.equal(helpTopic("pr", []), "pr");
  assert.equal(helpTopic("mr", []), "pr");            // alias
  assert.equal(helpTopic("update", []), "upgrade");
  assert.equal(helpTopic(null, ["check"]), "check");  // dai help check
  assert.equal(helpTopic(null, []), null);            // ayuda global
});

test("cada comando del dispatcher tiene ayuda propia", () => {
  const src = readFileSync(CLI, "utf8");
  const dispatcher = src.slice(src.indexOf("switch (cmd) {"));   // hay otros switch en el archivo
  const dispatched = [...dispatcher.matchAll(/^\s*case "([\w-]+)":/gm)].map((m) => m[1]);
  assert.ok(dispatched.length > 10, "no encontré los case del dispatcher");
  const sinAyuda = dispatched.filter((c) => !(HELP_ALIAS[c] || c in COMMAND_HELP));
  assert.deepEqual(sinAyuda, [], `sin ayuda: ${sinAyuda.join(", ")}`);
});

test("la ayuda global nombra todos los comandos con ayuda propia", () => {
  const u = globalUsage();
  for (const cmd of Object.keys(COMMAND_HELP)) {
    if (cmd === "skills") continue;                    // aparece como `skills install`
    assert.ok(u.includes(cmd), `la ayuda global no menciona '${cmd}'`);
  }
});

test("helpFor marca el tema desconocido en vez de mentir", () => {
  assert.equal(helpFor("pr").known, true);
  assert.equal(helpFor("noexiste").known, false);
  assert.equal(helpFor(null).known, true);
});

// ── integración: pedir ayuda no ejecuta nada y sale 0 por stdout ──────────────
for (const args of [["pr", "--help"], ["stamp", "--help"], ["done", "-h"], ["pr", "help"],
                    ["help", "pr"], ["mr", "--help"], ["check", "--help"], ["link-us", "--help"]]) {
  test(`dai ${args.join(" ")} imprime ayuda, no ejecuta, y sale 0`, () => {
    const r = run(...args);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.equal(r.stderr.trim(), "");
    assert.match(r.stdout, /^dai [\w-]+ —/);
    assert.match(r.stdout, /\nUso:\n/);
  });
}

test("dai sin argumentos imprime la ayuda global por stdout y sale 0", () => {
  const r = run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^Uso: dai <comando>/);
});

test("dai --help y dai help dan la misma ayuda global", () => {
  assert.equal(run("--help").stdout, run("help").stdout);
  assert.equal(run("-h").stdout, run("help").stdout);
});

test("un comando desconocido sale ≠ 0 y la ayuda va por stderr (no se confunde con la pedida)", () => {
  const r = run("noexiste");
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /no conozco el comando 'noexiste'/);
});
