import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlags, camel } from "../lib/args.mjs";

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
