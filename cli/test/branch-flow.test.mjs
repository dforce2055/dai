import test from "node:test";
import assert from "node:assert/strict";
import { resolveBase, branchFlow, isProdBranch, baseHint, parseOriginHead, DEFAULT_BASE,
  isProtectedBranch, emptyBranchAdvice, missingBaseAdvice, unrelatedHistoryAdvice } from "../lib/branch-flow.mjs";

// ── issue #62: dai nunca sugiere empujar a una rama protegida ──────────────────
const pushesTo = (advice, b) => advice.lines.some((l) => new RegExp(`git push\\b.*\\b${b}\\b`).test(l));

test("isProtectedBranch: las de vida larga por default y las declaradas en el .env.dai", () => {
  for (const b of ["main", "master", "develop", "stage", "qa"]) assert.ok(isProtectedBranch(b), b);
  assert.ok(isProtectedBranch("integracion", { DAI_BRANCH_DEV: "integracion" }));
  assert.ok(isProtectedBranch("pro", { DAI_BRANCH_PROD: "pro" }));
  assert.ok(!isProtectedBranch("feature/ABC-1-x"));
  assert.ok(!isProtectedBranch(""));
});

test("emptyBranchAdvice: commits en la base local → moverlos a la branch, sin pushear la base", () => {
  const a = emptyBranchAdvice({ base: "develop", branch: "feature/ABC-1-x", localUnpushed: 3 });
  assert.match(a.warn, /no tiene commits propios respecto de origin\/develop/);
  assert.ok(a.lines.some((l) => /3 sin publicar/.test(l)));
  assert.ok(a.lines.some((l) => /git branch -f feature\/ABC-1-x develop/.test(l)));
  assert.ok(!pushesTo(a, "develop"));
});

test("emptyBranchAdvice: branch == origin/base → nada que proponer, sin ningún push", () => {
  const a = emptyBranchAdvice({ base: "develop", branch: "feature/ABC-1-x", localUnpushed: 0 });
  assert.match(a.warn, /no hay nada que proponer/);
  assert.ok(!a.lines.some((l) => /git push/.test(l)));
});

test("missingBaseAdvice: solo sugiere publicar la base si NO es protegida", () => {
  assert.ok(!pushesTo(missingBaseAdvice({ base: "develop" }), "develop"));
  assert.ok(!pushesTo(missingBaseAdvice({ base: "integ", env: { DAI_BRANCH_DEV: "integ" } }), "integ"));
  assert.ok(pushesTo(missingBaseAdvice({ base: "epic/pagos" }), "epic/pagos"));
});

test("unrelatedHistoryAdvice: no sugiere ningún push", () => {
  assert.ok(!unrelatedHistoryAdvice({ base: "main", branch: "feature/x" }).lines.some((l) => /git push/.test(l)));
});

const FLUJO = { DAI_BRANCH_DEV: "testing", DAI_BRANCH_PROD: "main" };

test("branchFlow: no declarada ≠ vacía", () => {
  assert.deepEqual(branchFlow(FLUJO), { dev: "testing", prod: "main" });
  assert.deepEqual(branchFlow({ DAI_BRANCH_DEV: "  " }), { dev: null, prod: null });
  assert.deepEqual(branchFlow({}), { dev: null, prod: null });
});

test("resolveBase: --base gana sobre todo, y dice que salió del flag", () => {
  const r = resolveBase({ flag: "otra", branch: "feature/ABC-1-x", env: FLUJO, originHead: "main" });
  assert.equal(r.base, "otra");
  assert.equal(r.source, "--base");
});

// El corazón del modelo: la base es consecuencia del TIPO de branch, no una constante.
test("resolveBase: feature/ y fix/ integran contra DAI_BRANCH_DEV", () => {
  for (const b of ["feature/ABC-1-x", "fix/ABC-2-y", "spike/lo-que-sea", "sin-prefijo"]) {
    const r = resolveBase({ branch: b, env: FLUJO, originHead: "main" });
    assert.equal(r.base, "testing", b);
    assert.match(r.source, /DAI_BRANCH_DEV/);
  }
});

test("resolveBase: release/ y hotfix/ van contra DAI_BRANCH_PROD, y dice por qué", () => {
  for (const [b, tipo] of [["release/2026.09", "release/"], ["hotfix/ABC-9", "hotfix/"]]) {
    const r = resolveBase({ branch: b, env: FLUJO, originHead: "develop" });
    assert.equal(r.base, "main", b);
    assert.match(r.source, /DAI_BRANCH_PROD/);
    assert.equal(r.reason, `la branch es ${tipo}`);
  }
});

test("resolveBase: un repo de una sola rama declara solo PROD y todo va ahí", () => {
  const r = resolveBase({ branch: "feature/ABC-1-x", env: { DAI_BRANCH_PROD: "main" }, originHead: "otra" });
  assert.equal(r.base, "main");
  assert.match(r.source, /DAI_BRANCH_PROD/);
  assert.match(r.reason, /única rama declarada/);
});

test("resolveBase: sin mapa declarado cae a la rama default del remoto, no a un 'main' fijo", () => {
  const r = resolveBase({ branch: "feature/ABC-1-x", env: {}, originHead: "develop" });
  assert.equal(r.base, "develop");
  assert.equal(r.source, "rama default de origin");
});

test("resolveBase: sin nada, main — pero declarando que es un default de dai", () => {
  const r = resolveBase({ branch: "feature/ABC-1-x", env: {}, originHead: null });
  assert.equal(r.base, DEFAULT_BASE);
  assert.equal(r.source, "default de dai");
});

test("resolveBase: una release en un repo que no declaró PROD no inventa la base", () => {
  const r = resolveBase({ branch: "release/2026.09", env: { DAI_BRANCH_DEV: "testing" }, originHead: "main" });
  assert.equal(r.base, "testing");            // cae al mapa que SÍ existe
  assert.match(r.source, /DAI_BRANCH_DEV/);
});

test("isProdBranch solo es cierto si el repo lo declaró (dai no adivina cuál es PRO)", () => {
  assert.equal(isProdBranch("main", FLUJO), true);
  assert.equal(isProdBranch("main", {}), false);            // sin declarar: sin gate
  assert.equal(isProdBranch("testing", FLUJO), false);
  assert.equal(isProdBranch("", FLUJO), false);
});

test("baseHint: calla cuando alguien decidió la base, avisa cuando fue un default", () => {
  assert.equal(baseHint("--base", "testing"), null);
  assert.equal(baseHint("DAI_BRANCH_DEV (.env.dai)", "testing"), null);
  assert.equal(baseHint("DAI_BRANCH_PROD (.env.dai)", "main"), null);
  assert.equal(baseHint("lo respondiste vos", "testing"), null);
  const h = baseHint("default de dai", "main");
  assert.match(h, /DAI_BRANCH_DEV/);
  assert.match(h, /DAI_BRANCH_PROD/);
});

test("parseOriginHead normaliza lo que devuelve git", () => {
  assert.equal(parseOriginHead("origin/main"), "main");
  assert.equal(parseOriginHead("refs/remotes/origin/develop"), "develop");
  assert.equal(parseOriginHead("origin/release/2.0"), "release/2.0");
  assert.equal(parseOriginHead(""), null);
  assert.equal(parseOriginHead(null), null);
  assert.equal(parseOriginHead("cualquier-cosa"), null);
});
