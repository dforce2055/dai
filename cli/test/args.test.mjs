import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlags, camel, isAssistantToken, asList } from "../lib/args.mjs";

test("flags con valor", () => {
  const { opts, pos } = parseFlags(["link-us", "ABC-1", "--us", "u.md", "--autor", "Dev"]);
  assert.deepEqual(pos, ["link-us", "ABC-1"]);
  assert.equal(opts.us, "u.md");
  assert.equal(opts.autor, "Dev");
});

test("flags booleanos NO consumen el flag siguiente (el bug)", () => {
  const { opts } = parseFlags(["install", "--global", "--dry-run"]);
  assert.equal(opts.global, true);
  assert.equal(opts.dryRun, true); // antes quedaba undefined → dry-run ignorado
});

test("--force y --json booleanos", () => {
  const { opts } = parseFlags(["install", "--force"]);
  assert.equal(opts.force, true);
  assert.equal(parseFlags(["ls", "--json"]).opts.json, true);
});

test("--local con y sin valor", () => {
  assert.equal(parseFlags(["install", "--local", "./repo"]).opts.local, "./repo");
  assert.equal(parseFlags(["install", "--local"]).opts.local, true);
  assert.equal(parseFlags(["install", "--local", "--force"]).opts.local, true); // no consume el flag
});

test("camel convierte kebab a camelCase", () => {
  assert.equal(camel("dry-run"), "dryRun");
  assert.equal(camel("body-file"), "bodyFile");
  assert.equal(camel("json"), "json");
});

import { parseAssistants } from "../lib/args.mjs";

test("parseAssistants: valores simples", () => {
  assert.deepEqual(parseAssistants("claude"), { claude: true, copilot: false, cursor: false });
  assert.deepEqual(parseAssistants("cursor"), { claude: false, copilot: false, cursor: true });
});
test("parseAssistants: all / both / default", () => {
  assert.deepEqual(parseAssistants("all"), { claude: true, copilot: true, cursor: true });
  assert.deepEqual(parseAssistants("both"), { claude: true, copilot: true, cursor: false });
  assert.deepEqual(parseAssistants(undefined), { claude: true, copilot: true, cursor: true });
});
test("parseAssistants: combinaciones (coma y espacio)", () => {
  assert.deepEqual(parseAssistants("claude,cursor"), { claude: true, copilot: false, cursor: true });
  assert.deepEqual(parseAssistants("copilot claude"), { claude: true, copilot: true, cursor: false });
  assert.deepEqual(parseAssistants("both,cursor"), { claude: true, copilot: true, cursor: true });
});
test("parseAssistants: token inválido lanza", () => {
  assert.throws(() => parseAssistants("claude,vscode"), /inválido: 'vscode'/);
});

test("isAssistantToken detecta tokens de --for (hint del espacio)", () => {
  assert.ok(isAssistantToken("cursor"));
  assert.ok(isAssistantToken("CLAUDE"));   // case-insensitive
  assert.ok(isAssistantToken("both"));
  assert.ok(isAssistantToken("all"));
  assert.equal(isAssistantToken("mi-repo"), false);
  assert.equal(isAssistantToken(undefined), false);
  assert.equal(isAssistantToken(""), false);
});

// ── flags repetibles (--field alias=valor, para los campos propios de Jira) ────
// Antes el último ganaba en silencio: `--field a=1 --field b=2` perdía 'a' sin avisar.

test("un flag repetido acumula en lista", () => {
  const { opts } = parseFlags(["publish", "us.md", "--field", "a=1", "--field", "b=2"]);
  assert.deepEqual(opts.field, ["a=1", "b=2"]);
});

test("un flag que viene una sola vez sigue siendo string (no rompe lo de antes)", () => {
  const { opts } = parseFlags(["publish", "us.md", "--field", "a=1"]);
  assert.equal(opts.field, "a=1");
  assert.equal(parseFlags(["init", "--for", "claude"]).opts.for, "claude");
});

test("asList normaliza 0, 1 o N ocurrencias", () => {
  assert.deepEqual(asList(undefined), []);
  assert.deepEqual(asList("a=1"), ["a=1"]);
  assert.deepEqual(asList(["a=1", "b=2"]), ["a=1", "b=2"]);
});
