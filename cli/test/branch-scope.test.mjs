import test from "node:test";
import assert from "node:assert/strict";
import {
  branchType, branchIdCandidates, requiresLink,
  flattenImplements, matchBranchToImplements, stampScope, prScope,
} from "../lib/branch-scope.mjs";

// ── branchType ───────────────────────────────────────────────────────────────
test("branchType: lo que hay antes de la primera barra, en minúsculas", () => {
  assert.equal(branchType("feature/ABC-482-x"), "feature");
  assert.equal(branchType("Chore/deps"), "chore");
  assert.equal(branchType("feature/sub/ABC-1-x"), "feature");
  assert.equal(branchType("main"), "");
  assert.equal(branchType(null), "");
});

// ── branchIdCandidates ───────────────────────────────────────────────────────
test("branchIdCandidates: saca los ids posibles del nombre, en orden", () => {
  assert.deepEqual(branchIdCandidates("feature/ABC-482-finalizar-compra"),
    ["ABC-482", "finalizar", "compra"]);
  // ClickUp: id alfanumérico sin guion — es ambiguo con las palabras del slug, y por eso
  // devolvemos TODOS los candidatos: quien desambigua es matchBranchToImplements.
  assert.deepEqual(branchIdCandidates("feature/86acme482-historia-motor"),
    ["86acme482", "historia", "motor"]);
  assert.deepEqual(branchIdCandidates("main"), ["main"]);
});

// ── requiresLink (el gate de CI, issue #26) ──────────────────────────────────
test("requiresLink: feature/ siempre exige US", () => {
  assert.equal(requiresLink("feature/ABC-482-x").required, true);
  assert.equal(requiresLink("feat/ABC-482-x").required, true);
  // Incluso sin ID en el nombre: una feature es trabajo de producto por definición.
  assert.equal(requiresLink("feature/lo-que-sea").required, true);
});

test("requiresLink: los prefijos de trabajo sin US quedan exentos", () => {
  for (const b of ["chore/deps", "docs/readme", "ci/cache", "build/rollup",
                   "test/flaky", "refactor/x", "style/lint", "release/1.2.0",
                   "hotfix/caida", "revert/abc123"]) {
    assert.equal(requiresLink(b).required, false, `${b} debería estar exenta`);
  }
});

test("requiresLink: fix/ exige US solo si el nombre trae un key de tracker", () => {
  assert.equal(requiresLink("fix/ABC-482-doble-cobro").required, true);
  assert.equal(requiresLink("fix/typo-en-el-footer").required, false);
});

test("requiresLink: main/develop y branches sin prefijo no son trabajo de producto", () => {
  assert.equal(requiresLink("main").required, false);
  assert.equal(requiresLink("develop").required, false);
  assert.equal(requiresLink(null).required, false);
});

test("requiresLink: siempre explica por qué (el mensaje es la mitad del gate)", () => {
  for (const b of ["feature/ABC-1-x", "chore/deps", "fix/typo", "main"]) {
    assert.ok(requiresLink(b).reason.length > 10, `${b} sin explicación`);
  }
});

// ── flattenImplements ────────────────────────────────────────────────────────
const found = (rows) => rows.map((r) => ({
  path: r.path, change: r.change, repo: r.repo || "api",
  implements: [{ id: r.id, version: r.version || "v1", ac_hash: r.ac_hash || "h" }],
}));

test("flattenImplements: aplana y saltea los placeholders de plantilla", () => {
  const rows = flattenImplements([
    { path: "a/implements.yaml", change: "c1", repo: "api", implements: [{ id: "ABC-1", version: "v1", ac_hash: "h1" }] },
    { path: "b/implements.yaml", change: "c2", repo: "api", implements: [{ id: "ABC-###", version: "v1", ac_hash: "x" }] },
    { path: "c/implements.yaml", change: "c3", repo: "api", implements: [] },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["ABC-1"]);
  assert.equal(rows[0].change, "c1");
});

// ── matchBranchToImplements ──────────────────────────────────────────────────
test("matchBranchToImplements: matchea sin distinguir mayúsculas", () => {
  const rows = flattenImplements(found([{ path: "p", change: "c", id: "ABC-482" }]));
  assert.deepEqual(matchBranchToImplements("feature/abc-482-compra", rows).map((r) => r.id), ["ABC-482"]);
});

test("matchBranchToImplements: un id de ClickUp en el slug también matchea", () => {
  const rows = flattenImplements(found([{ path: "p", change: "c", id: "86acme482" }]));
  assert.deepEqual(matchBranchToImplements("feature/86acme482-historia", rows).map((r) => r.id), ["86acme482"]);
});

test("matchBranchToImplements: una palabra del slug NO se confunde con una US", () => {
  const rows = flattenImplements(found([{ path: "p", change: "c", id: "86acme482" }]));
  assert.deepEqual(matchBranchToImplements("feature/331qtr-historia-motor", rows), []);
});

// ── stampScope (issue #22) ───────────────────────────────────────────────────
const R = (id, change = "c-" + id) => ({ path: `openspec/changes/${change}/implements.yaml`, change, repo: "api", id, version: "v1", ac_hash: "h" });

test("stampScope: la branch nombra la US → estampa SOLO esa", () => {
  const rows = [R("ABC-1"), R("ABC-2"), R("ABC-3")];
  const s = stampScope({ branch: "feature/ABC-2-algo", rows });
  assert.equal(s.mode, "branch");
  assert.deepEqual(s.targets.map((t) => t.id), ["ABC-2"]);
});

test("stampScope: una sola US viva → esa, sin preguntar", () => {
  const s = stampScope({ branch: "feature/lo-que-sea", rows: [R("ABC-1")] });
  assert.equal(s.mode, "only");
  assert.deepEqual(s.targets.map((t) => t.id), ["ABC-1"]);
});

// El bug de #22: 4 US vivas, la branch no dice cuál, y estampaba las 4.
test("stampScope: varias US y la branch no dice cuál → ambiguo, NO estampa nada", () => {
  const rows = [R("86acme482"), R("86acme483"), R("86acme484"), R("86acme485")];
  const s = stampScope({ branch: "feature/331qtr-historia-motor", rows });
  assert.equal(s.mode, "ambiguous");
  assert.deepEqual(s.targets, []);
  assert.equal(s.candidates.length, 4);
});

test("stampScope: las US de changes archivados NO entran por default", () => {
  const rows = [R("ABC-1")];                                  // vivas
  const allRows = [R("ABC-1"), R("ABC-9"), R("ABC-8")];       // + archivadas
  const s = stampScope({ branch: "feature/lo-que-sea", rows, allRows });
  assert.equal(s.mode, "only");
  assert.deepEqual(s.targets.map((t) => t.id), ["ABC-1"]);
});

test("stampScope: --all vuelve al comportamiento viejo (archivadas incluidas)", () => {
  const rows = [R("ABC-1")];
  const allRows = [R("ABC-1"), R("ABC-9")];
  const s = stampScope({ branch: "feature/x", rows, allRows, all: true });
  assert.equal(s.mode, "all");
  assert.deepEqual(s.targets.map((t) => t.id), ["ABC-1", "ABC-9"]);
});

test("stampScope: un ID explícito gana, aunque el change esté archivado", () => {
  const rows = [R("ABC-1")];
  const allRows = [R("ABC-1"), R("ABC-9")];
  const s = stampScope({ branch: "feature/ABC-1-x", rows, allRows, ids: ["ABC-9"] });
  assert.equal(s.mode, "explicit");
  assert.deepEqual(s.targets.map((t) => t.id), ["ABC-9"]);
  assert.deepEqual(s.missing, []);
});

test("stampScope: un ID que no existe se reporta, no se ignora en silencio", () => {
  const s = stampScope({ branch: "feature/x", rows: [R("ABC-1")], ids: ["ABC-404"] });
  assert.deepEqual(s.targets, []);
  assert.deepEqual(s.missing, ["ABC-404"], "devuelve la grafía que tipeó el usuario, no la normalizada");
});

test("stampScope: repo sin US vivas → none", () => {
  const s = stampScope({ branch: "chore/deps", rows: [] });
  assert.equal(s.mode, "none");
  assert.deepEqual(s.targets, []);
});

test("stampScope: si la branch nombra DOS US, no adivina — pregunta entre esas dos", () => {
  const rows = [R("ABC-1"), R("ABC-2"), R("ABC-3")];
  const s = stampScope({ branch: "feature/ABC-1-y-ABC-2-juntas", rows });
  assert.equal(s.mode, "ambiguous");
  assert.deepEqual(s.candidates.map((c) => c.id), ["ABC-1", "ABC-2"]);
});

// ── trackerKeysIn: el case es lo que separa un key de una palabra del slug ────
// Encontrado dogfoodeando: `feat/issues-22-26` hacía que el gate sugiriera
// `dai link-us issues-22`, o sea mandar al dev a crear un link inventado.
test("trackerKeysIn: 'issues-22' no es un key de tracker; 'ABC-482' sí", async () => {
  const { trackerKeysIn } = await import("../lib/branch-scope.mjs");
  assert.deepEqual(trackerKeysIn("feat/issues-22-26"), []);
  assert.deepEqual(trackerKeysIn("feature/ABC-482-compra"), ["ABC-482"]);
  assert.deepEqual(trackerKeysIn("feature/86acme482-historia"), [], "los ids de ClickUp no llevan guion");
});

test("requiresLink: fix/ con una palabra numerada no se confunde con una US", () => {
  assert.equal(requiresLink("fix/issues-22-26").required, false);
  assert.equal(requiresLink("fix/bug-123-en-el-form").required, false);
  assert.equal(requiresLink("fix/ABC-482-doble-cobro").required, true);
});

// ── prScope: con qué US titula `dai pr` (issues #31, #32, #33) ────────────────
// El bug original: `dai pr` recorría TODOS los implements.yaml del repo —archivados
// incluidos— y se quedaba con el último. La PR salía titulada con la historia de otro,
// con su link y su `dai check ✅`, y nadie se enteraba.
test("prScope: la branch manda, aunque haya otras US vivas", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const rows = [R("86acme002"), R("86acme001"), R("86acme003")];
  const s = prScope({ branch: "feature/86acme001-finalizar-la-compra", rows });
  assert.equal(s.mode, "branch");
  assert.equal(s.target.id, "86acme001", "el caso real del issue #32: ganaba 86acme003 por orden de directorio");
});

test("prScope: los archivados no compiten con el change activo", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const rows = [R("ABC-1")];                                  // vivo
  const allRows = [R("ABC-1"), R("ABC-9"), R("ABC-99")];      // + archivados
  const s = prScope({ branch: "feature/sin-id-en-el-nombre", rows, allRows });
  assert.equal(s.mode, "only");
  assert.equal(s.target.id, "ABC-1");
});

test("prScope: una chore/ NO hereda la US viva del repo — sale sin US", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  // El caso 2 del issue #31: `chore/archive-specs` salió titulada con la historia ajena.
  const s = prScope({ branch: "chore/archive-specs", rows: [R("ABC-1")] });
  assert.equal(s.mode, "exempt");
  assert.equal(s.target, null);
});

test("prScope: una chore/ que SÍ nombra una US viva la usa igual", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const s = prScope({ branch: "chore/ABC-1-limpieza", rows: [R("ABC-1"), R("ABC-2")] });
  assert.equal(s.mode, "branch");
  assert.equal(s.target.id, "ABC-1");
});

test("prScope: varias US vivas y la branch no dice cuál → no elige, pregunta", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const rows = [R("ABC-1"), R("ABC-2")];
  const s = prScope({ branch: "feature/sin-id", rows });
  assert.equal(s.mode, "ambiguous");
  assert.equal(s.target, null);
  assert.deepEqual(s.candidates.map((c) => c.id), ["ABC-1", "ABC-2"]);
});

test("prScope: si la branch nombra DOS US vivas, las candidatas son esas dos", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const rows = [R("ABC-1"), R("ABC-2"), R("ABC-3")];
  const s = prScope({ branch: "feature/ABC-1-y-ABC-2-juntas", rows });
  assert.equal(s.mode, "ambiguous");
  assert.deepEqual(s.candidates.map((c) => c.id), ["ABC-1", "ABC-2"]);
});

test("prScope: --us gana, y puede apuntar a un change ya archivado", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const rows = [R("ABC-1")];
  const allRows = [R("ABC-1"), R("ABC-9")];
  const s = prScope({ branch: "feature/ABC-1-x", rows, allRows, ids: ["abc-9"] });
  assert.equal(s.mode, "explicit");
  assert.equal(s.target.id, "ABC-9");
  assert.deepEqual(s.missing, []);
});

test("prScope: un --us que no existe se reporta con la grafía del usuario", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const s = prScope({ branch: "feature/ABC-1-x", rows: [R("ABC-1")], ids: ["ABC-404"] });
  assert.equal(s.target, null);
  assert.deepEqual(s.missing, ["ABC-404"]);
});

test("prScope: feature/ sin ninguna US viva → none (hay que linkear primero)", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  const s = prScope({ branch: "feature/algo", rows: [], allRows: [R("ABC-9")] });
  assert.equal(s.mode, "none");
  assert.equal(s.target, null);
});

test("prScope: cada modo explica de dónde salió la US (para el preview)", async () => {
  const { prScope } = await import("../lib/branch-scope.mjs");
  for (const s of [
    prScope({ branch: "feature/ABC-1-x", rows: [R("ABC-1"), R("ABC-2")] }),
    prScope({ branch: "feature/x", rows: [R("ABC-1")] }),
    prScope({ branch: "chore/deps", rows: [R("ABC-1")] }),
  ]) assert.match(s.reason, /\S/);
});

// Un repo de tooling (el de dai, sin ir más lejos) no se trackea a sí mismo con US. Ahí
// `dai pr` desde una `fix/` sin ID moría pidiendo un link que no puede existir — y encima
// aconsejaba renombrar la branch a `chore/`, que para un fix es el consejo equivocado.
test("prScope: sin US en el repo, una branch que no exige link sale SIN US, no falla", () => {
  const s = prScope({ branch: "fix/pr-base-y-ayuda", rows: [], allRows: [] });
  assert.equal(s.mode, "exempt");
  assert.equal(s.target, null);
  assert.match(s.reason, /no exige US/);
});

// Lo que distingue un olvido de un repo sin US es si la branch NOMBRA UN TICKET.
test("prScope: sin US en el repo, una feature/ que NOMBRA un ticket sigue fallando", () => {
  const s = prScope({ branch: "feature/ABC-482-checkout", rows: [], allRows: [] });
  assert.equal(s.mode, "none");   // alguien quiso implementar una US y no corrió link-us
});

// Un repo con US archivadas SÍ trabaja con User Stories: ahí una feature/ sin link es un
// olvido, no un repo de tooling. Por eso se mira allRows y no solo las vivas.
test("prScope: con US archivadas, una feature/ sin link sigue siendo un olvido", () => {
  const s = prScope({ branch: "feature/algo", rows: [], allRows: [{ id: "ABC-9", path: "p", change: "c" }] });
  assert.equal(s.mode, "none");
});

test("prScope: sin US en el repo, una feature/ que no nombra ticket sale SIN US", () => {
  const s = prScope({ branch: "feature/release-flow", rows: [], allRows: [] });
  assert.equal(s.mode, "exempt");
  assert.match(s.reason, /no nombra ninguna US y el repo no declara ninguna/);
});

// El gate de CI no se afloja: sigue mirando requiresLink, no esto.
test("requiresLink no cambió: feature/ sigue exigiendo US aunque prScope la deje pasar", () => {
  assert.equal(requiresLink("feature/release-flow").required, true);
});
