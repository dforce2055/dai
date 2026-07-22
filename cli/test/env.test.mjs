import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnv, loadDaiEnv } from "../lib/env.mjs";

function withEnvFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "dai-env-"));
  const path = join(dir, ".env");
  writeFileSync(path, content);
  return loadEnv(path, {});
}

// loadDaiEnv lee `.env.dai` y `.env` con rutas fijas desde el CWD: para testear la
// precedencia, creamos un dir temporal con esos archivos y corremos ahí adentro.
function inDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "dai-envdai-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  const prev = process.cwd();
  process.chdir(dir);
  try { return fn(); } finally { process.chdir(prev); }
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

// ── loadDaiEnv: precedencia shell > .env.dai > .env (equipos que versionan el .env) ──

test("loadDaiEnv: .env.dai gana sobre .env (override local del dev)", () => {
  const env = inDir({ ".env": "DAI_PM=md\n", ".env.dai": "DAI_PM=jira\n" }, () => loadDaiEnv({}));
  assert.equal(env.DAI_PM, "jira");
});

test("loadDaiEnv: sigue leyendo el .env (compat con repos que tienen DAI_* ahí)", () => {
  const env = inDir({ ".env": "DAI_JIRA_PROJECT=PROJ\n" }, () => loadDaiEnv({}));
  assert.equal(env.DAI_JIRA_PROJECT, "PROJ");
});

// `.env.dai` es una OPCIÓN, no una migración obligatoria: hay equipos con toda la config
// en el `.env` de siempre y tienen que seguir funcionando sin tocar nada. Si esto se
// rompe, esos repos ven "no hay tracker configurado" y el fallo parece del tracker.
test("loadDaiEnv: un repo SIN .env.dai levanta toda su config del .env", () => {
  const env = inDir({ ".env": "DAI_PM=clickup\nDAI_CLICKUP_TOKEN=pk_1\nDAI_CLICKUP_LIST_ID=901\n" },
    () => loadDaiEnv({}));
  assert.deepEqual(
    { pm: env.DAI_PM, token: env.DAI_CLICKUP_TOKEN, list: env.DAI_CLICKUP_LIST_ID },
    { pm: "clickup", token: "pk_1", list: "901" },
  );
});

// Los dos archivos se COMPLEMENTAN, no se reemplazan: `.env.dai` gana clave por clave,
// pero lo que solo existe en `.env` se sigue leyendo. Si el loader cortara al encontrar
// `.env.dai`, un repo a medio migrar perdería en silencio las claves que quedaron atrás.
test("loadDaiEnv: los dos archivos se fusionan por clave, no se excluyen", () => {
  const env = inDir({
    ".env": "DAI_PM=md\nDAI_TRACKER_URL_TEMPLATE=https://viejo/{id}\n",
    ".env.dai": "DAI_PM=jira\nDAI_JIRA_TOKEN=tk\n",
  }, () => loadDaiEnv({}));
  assert.equal(env.DAI_PM, "jira", "la clave repetida la gana .env.dai");
  assert.equal(env.DAI_JIRA_TOKEN, "tk", "lo que solo está en .env.dai");
  assert.equal(env.DAI_TRACKER_URL_TEMPLATE, "https://viejo/{id}", "lo que solo está en .env NO se pierde");
});

test("loadDaiEnv: el entorno (shell/CI) gana sobre ambos archivos", () => {
  const env = inDir({ ".env": "DAI_PM=md\n", ".env.dai": "DAI_PM=jira\n" }, () => loadDaiEnv({ DAI_PM: "clickup" }));
  assert.equal(env.DAI_PM, "clickup");
});

test("loadDaiEnv: sin ningún archivo no explota", () => {
  const env = inDir({}, () => loadDaiEnv({}));
  assert.deepEqual(env, {});
});
