import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCommitLog, classifySubject, mergedBranch, proposeBump, nextVersion,
  buildManifest, renderManifest, BUMP_CAVEAT,
} from "../lib/release-plan.mjs";

const log = (...outLines) => outLines.join("\n");
const c = (sha, subject) => `${sha}\x1f${subject}`;

// ── parseo del log ───────────────────────────────────────────────────────────
test("parseCommitLog separa por \\x1f: un subject puede tener pipes, tabs y dos puntos", () => {
  const out = parseCommitLog(log(
    c("aaa", "feat(cart): rechaza el carrito vacío | y avisa"),
    c("bbb", "fix: corrige\tel cálculo"),
  ));
  assert.equal(out.length, 2);
  assert.equal(out[0].subject, "feat(cart): rechaza el carrito vacío | y avisa");
  assert.equal(out[0].scope, "cart");
  assert.equal(out[1].subject, "fix: corrige\tel cálculo");
});

test("classifySubject reconoce tipo, scope, breaking y merge", () => {
  assert.deepEqual(classifySubject("feat(pr)!: cambia el contrato"), { type: "feat", scope: "pr", breaking: true, merge: false });
  assert.deepEqual(classifySubject("Merge pull request #47 from acme/fix/x"), { type: null, scope: null, breaking: false, merge: true });
});

// Un repo puede tener commits que no siguen la convención; ignorarlos sería mentir por omisión.
test("un subject sin Conventional Commits se cuenta igual, con type null", () => {
  const [x] = parseCommitLog(c("aaa", "arreglé lo del checkout"));
  assert.equal(x.type, null);
  assert.equal(x.merge, false);
});

test("mergedBranch saca la branch del merge commit, en las dos formas", () => {
  assert.equal(mergedBranch("Merge pull request #47 from dforce2055/fix/pr-base"), "fix/pr-base");
  assert.equal(mergedBranch("Merge branch 'feature/ACME-1-x' into develop"), "feature/ACME-1-x");
  assert.equal(mergedBranch("Merge remote-tracking branch 'origin/develop'"), "develop");
  assert.equal(mergedBranch("feat: algo"), null);
});

// ── bump propuesto ───────────────────────────────────────────────────────────
test("proposeBump: breaking gana, después feat, después patch", () => {
  assert.equal(proposeBump(parseCommitLog(c("a", "feat!: rompe"))).bump, "major");
  assert.equal(proposeBump(parseCommitLog(log(c("a", "fix: x"), c("b", "feat: y")))).bump, "minor");
  assert.equal(proposeBump(parseCommitLog(log(c("a", "fix: x"), c("b", "docs: y")))).bump, "patch");
  assert.equal(proposeBump([]).bump, "patch");
});

test("los merge commits no votan el bump", () => {
  const commits = parseCommitLog(log(c("a", "Merge pull request #1 from acme/feature/x"), c("b", "fix: x")));
  assert.equal(proposeBump(commits).bump, "patch");
});

// La 0.14.0 de dai salió con cuatro commits `fix:` y era minor, porque cambió un default
// observable. Este test fija que dai lo llame PROPUESTA y advierta, en vez de versionar solo.
test("el bump es un piso con advertencia, no un veredicto", () => {
  const p = proposeBump(parseCommitLog(log(c("a", "fix: uno"), c("b", "fix: dos"))));
  assert.equal(p.bump, "patch");
  assert.equal(p.floor, true);
  assert.match(BUMP_CAVEAT, /COMPORTAMIENTO/);
  assert.match(BUMP_CAVEAT, /minor aunque todo sea/);
});

test("nextVersion aplica el bump y no toca lo que no corresponde", () => {
  assert.equal(nextVersion("1.4.2", "patch"), "1.4.3");
  assert.equal(nextVersion("1.4.2", "minor"), "1.5.0");
  assert.equal(nextVersion("1.4.2", "major"), "2.0.0");
  assert.equal(nextVersion("no-es-version", "patch"), null);
});

// ── manifiesto ───────────────────────────────────────────────────────────────
const LINKED = [
  { id: "ACME-482", version: "v2", ac_hash: "aaaa1111", change: "checkout", order: 0 },
  { id: "ACME-491", version: "v1", ac_hash: "bbbb2222", change: "poliza", order: 1 },
];
const LIVE = {
  "ACME-482": { title: "Checkout sin duplicado", ac_hash: "aaaa1111", spec_version: "v2" },
  "ACME-491": { title: "Alta de póliza", ac_hash: "cccc3333", spec_version: "v2" },
};

test("el manifiesto marca atrasada la US cuyo QUÉ se movió después de implementarla", () => {
  const m = buildManifest({ commits: [], linked: LINKED, live: LIVE });
  assert.equal(m.stories.find((s) => s.id === "ACME-482").status, "al-dia");
  assert.equal(m.stories.find((s) => s.id === "ACME-491").status, "atrasado");
  assert.equal(m.counts.stale, 1);
});

// El link se crea al empezar y se resincroniza después; y al archivar el change, el mismo
// yaml aparece en dos paths. La US se nombra UNA vez, con su último estado.
test("una US que aparece en varios commits o paths se lista una sola vez, con el último estado", () => {
  const linked = [
    { id: "ACME-482", version: "v1", ac_hash: "viejo", change: "checkout", order: 0 },
    { id: "ACME-482", version: "v2", ac_hash: "aaaa1111", change: "checkout", order: 5 },
    { id: "ACME-482", version: "v2", ac_hash: "aaaa1111", change: "checkout", order: 3 },
  ];
  const m = buildManifest({ commits: [], linked, live: LIVE });
  assert.equal(m.stories.length, 1);
  assert.equal(m.stories[0].ac_hash, "aaaa1111");
  assert.equal(m.stories[0].status, "al-dia");
});

test("sin respuesta del tracker el manifiesto sale igual, diciendo que no verificó", () => {
  const m = buildManifest({ commits: [], linked: LINKED, live: {}, unreachable: true });
  assert.equal(m.stories.length, 2);
  assert.ok(m.stories.every((s) => s.status === "sin-respuesta"));
});

test("una US linkeada que el tracker no tiene no se confunde con una que no se pudo consultar", () => {
  const m = buildManifest({ commits: [], linked: LINKED, live: {}, unreachable: false });
  assert.ok(m.stories.every((s) => s.status === "sin-us"));
});

// El hallazgo del manifiesto: trabajo de producto que entró sin link.
test("separa las branches exentas por tipo de las huérfanas", () => {
  const commits = parseCommitLog(log(
    c("a", "Merge pull request #1 from acme/feature/ACME-482-checkout"),
    c("b", "Merge pull request #2 from acme/chore/deps"),
    c("d", "Merge pull request #3 from acme/arreglo-rapido"),
  ));
  const m = buildManifest({ commits, linked: LINKED, live: LIVE });
  assert.deepEqual(m.chores, ["chore/deps"]);
  assert.deepEqual(m.orphans, ["arreglo-rapido"]);       // sin US y sin prefijo exento
  assert.equal(m.counts.merges, 3);
});

test("la branch que nombra una US del manifiesto no se cuenta dos veces", () => {
  const commits = parseCommitLog(c("a", "Merge pull request #1 from acme/feature/ACME-491-poliza"));
  const m = buildManifest({ commits, linked: LINKED, live: LIVE });
  assert.deepEqual(m.orphans, []);
  assert.deepEqual(m.chores, []);
});

// ── render ───────────────────────────────────────────────────────────────────
test("el render nombra las US, la atrasada y las huérfanas", () => {
  const commits = parseCommitLog(c("a", "Merge pull request #3 from acme/arreglo-rapido"));
  const m = buildManifest({ commits, linked: LINKED, live: LIVE });
  const out = renderManifest(m, { from: "v0.4.2", to: "develop", current: "0.4.2", proposed: "0.5.0", bump: "minor", reason: "hay feat" });
  assert.match(out, /ACME-482/);
  assert.match(out, /ATRASADA/);
  assert.match(out, /arreglo-rapido/);
  assert.match(out, /0\.4\.2 → 0\.5\.0/);
});

test("sin US en el rango lo dice, en vez de mostrar una tabla vacía", () => {
  const m = buildManifest({ commits: [], linked: [], live: {} });
  assert.match(renderManifest(m, { to: "develop", current: "1.0.0", proposed: "1.0.1", bump: "patch" }), /Ninguna US declarada/);
});

// En un repo de tooling —el de dai, sin ir más lejos— NINGUNA branch declara una US, así
// que marcarlas todas como "entró trabajo sin link" convierte el aviso en ruido.
test("sin US en el repo, una branch sin link no es un hallazgo", () => {
  const commits = parseCommitLog(c("a", "Merge pull request #49 from acme/feature/release-flow"));
  const m = buildManifest({ commits, linked: [], live: {}, repoUsesStories: false });
  assert.deepEqual(m.orphans, []);
  assert.deepEqual(m.chores, ["feature/release-flow"]);
});

test("aunque el repo no use US, una branch que NOMBRA un ticket sí es un hallazgo", () => {
  const commits = parseCommitLog(c("a", "Merge pull request #1 from acme/feature/ACME-482-checkout"));
  const m = buildManifest({ commits, linked: [], live: {}, repoUsesStories: false });
  assert.deepEqual(m.orphans, ["feature/ACME-482-checkout"]);
});

test("en un repo que sí usa US, una branch sin link sigue siendo un hallazgo", () => {
  const commits = parseCommitLog(c("a", "Merge pull request #3 from acme/arreglo-rapido"));
  const m = buildManifest({ commits, linked: LINKED, live: LIVE, repoUsesStories: true });
  assert.deepEqual(m.orphans, ["arreglo-rapido"]);
});
