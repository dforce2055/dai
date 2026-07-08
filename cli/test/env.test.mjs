import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnv } from "../lib/env.mjs";

function withEnvFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "dai-env-"));
  const path = join(dir, ".env");
  writeFileSync(path, content);
  return loadEnv(path, {});
}

test("loadEnv recorta comentario inline en valores sin comillas (bug del token # ←)", () => {
  const env = withEnvFile("DAI_CLICKUP_TOKEN=pk_123        # ← SECRETO, no commitear\n");
  assert.equal(env.DAI_CLICKUP_TOKEN, "pk_123");   // sin el comentario ni el ←
});

test("loadEnv NO recorta un # sin espacio previo (parte legítima del valor)", () => {
  const env = withEnvFile("KEY=abc#123\n");
  assert.equal(env.KEY, "abc#123");
});

test("loadEnv respeta un # literal entre comillas", () => {
  const env = withEnvFile('KEY="a # b"\n');
  assert.equal(env.KEY, "a # b");
});

test("loadEnv parsea un valor normal sin tocarlo", () => {
  const env = withEnvFile("DAI_PM=clickup\n");
  assert.equal(env.DAI_PM, "clickup");
});

test("loadEnv no pisa una var ya presente en el entorno", () => {
  const dir = mkdtempSync(join(tmpdir(), "dai-env-"));
  const path = join(dir, ".env");
  writeFileSync(path, "DAI_PM=md\n");
  const env = loadEnv(path, { DAI_PM: "clickup" });
  assert.equal(env.DAI_PM, "clickup");
});
