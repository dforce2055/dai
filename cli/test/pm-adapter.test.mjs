import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseUS, coverageStatus, getAdapter, renderCoverage } from "../lib/pm-adapter.mjs";
import { loadEnv } from "../lib/env.mjs";

const US = `# 🔗 Metadata
| spec_version | v2 |

# Finalizar la compra del carrito

## Criterios de aceptación
- **Dado** un carrito vacío
- **Cuando** se finaliza
- **Entonces** se rechaza
`;

test("parseUS extrae título, spec_version y ac_hash", () => {
  const p = parseUS(US);
  assert.equal(p.title, "Finalizar la compra del carrito");
  assert.equal(p.spec_version, "v2");
  assert.match(p.ac_hash, /^[0-9a-f]{8}$/);
});

test("coverageStatus compara hashes", () => {
  assert.equal(coverageStatus("aaa", "aaa"), "al-dia");
  assert.equal(coverageStatus("aaa", "bbb"), "atrasado");
  assert.equal(coverageStatus("aaa", null), "sin-us");
});

test("renderCoverage incluye estado y links", () => {
  const md = renderCoverage("ABC-482", {
    repo: "frontend", change: "finalizar-compra", version: "v1", ac_hash: "7f3a9c2e",
    status: "atrasado", branch: "feature/x", branchUrl: "http://b", commit: "abc", commitUrl: "http://c",
  });
  assert.match(md, /ABC-482/);
  assert.match(md, /⚠️ atrasado/);
  assert.match(md, /http:\/\/c/);
});

test("backend md: fetchUS y stamp roundtrip", () => {
  const dir = mkdtempSync(join(tmpdir(), "dai-us-"));
  writeFileSync(join(dir, "ABC-482.md"), US);
  const adapter = getAdapter({ DAI_PM: "md", DAI_MD_US_DIR: dir });

  const live = adapter.fetchUS("ABC-482");
  assert.equal(live.spec_version, "v2");
  assert.equal(adapter.fetchUS("NO-EXISTE"), null);

  const where = adapter.stamp("ABC-482", { repo: "frontend", change: "c", version: "v1", ac_hash: "x", status: "al-dia" });
  assert.ok(existsSync(where));
  assert.match(readFileSync(where, "utf8"), /Cobertura de ABC-482/);
});

test("getAdapter despacha por DAI_PM", () => {
  assert.equal(getAdapter({}).kind, "md");
  assert.equal(getAdapter({ DAI_PM: "jira", DAI_JIRA_BASE_URL: "https://j" }).kind, "jira");
  assert.equal(getAdapter({ DAI_PM: "clickup", DAI_CLICKUP_TOKEN: "t" }).kind, "clickup");
  assert.throws(() => getAdapter({ DAI_PM: "jira" }), /DAI_JIRA_BASE_URL/); // sin base
  assert.throws(() => getAdapter({ DAI_PM: "raro" }), /desconocido/);
});

test("loadEnv no pisa variables ya seteadas", () => {
  const dir = mkdtempSync(join(tmpdir(), "dai-env-"));
  const f = join(dir, ".env");
  writeFileSync(f, "# comentario\nDAI_PM=md\nDAI_JIRA_TOKEN=\"secreto\"\nYA=nuevo\n");
  const env = { YA: "viejo" };
  loadEnv(f, env);
  assert.equal(env.DAI_PM, "md");
  assert.equal(env.DAI_JIRA_TOKEN, "secreto");   // comillas removidas
  assert.equal(env.YA, "viejo");                 // no pisa lo ya seteado
});
