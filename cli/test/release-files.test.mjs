import test from "node:test";
import assert from "node:assert/strict";
import {
  bumpPackageJson, bumpVersionFile, changelogEntry, insertChangelogEntry,
  changelogSection, changelogGaps, releaseBranch, tagName, normalizeVersion, CHANGELOG_MARK,
} from "../lib/release-files.mjs";

// ── el número en los archivos que lo espejan ─────────────────────────────────
// Reserializar el JSON reformatea los objetos compactos y ensucia el diff de la release
// con ruido que nadie pidió. El diff de un chore(release) tiene que ser tres líneas.
test("bumpPackageJson cambia SOLO la línea de la versión", () => {
  const pkg = '{\n  "name": "acme",\n  "version": "0.4.2",\n  "repository": { "type": "git", "url": "x" }\n}\n';
  const r = bumpPackageJson(pkg, "0.5.0");
  assert.equal(r.changed, true);
  assert.equal(r.from, "0.4.2");
  assert.match(r.text, /"version": "0\.5\.0"/);
  assert.match(r.text, /"repository": \{ "type": "git", "url": "x" \}/);   // el objeto compacto intacto
  assert.equal(r.text.split("\n").length, pkg.split("\n").length);
});

test("bumpPackageJson es idempotente y no rompe si no hay campo version", () => {
  assert.equal(bumpPackageJson('{"version":"1.0.0"}', "1.0.0").changed, false);
  assert.equal(bumpPackageJson('{"name":"x"}', "1.0.0").changed, false);
});

test("bumpVersionFile: el archivo entero es el número", () => {
  const r = bumpVersionFile("0.4.2\n", "0.5.0");
  assert.equal(r.text, "0.5.0");
  assert.equal(r.from, "0.4.2");
  assert.equal(bumpVersionFile("0.5.0", "0.5.0").changed, false);
});

// ── CHANGELOG ────────────────────────────────────────────────────────────────
const MANIFEST = {
  stories: [
    { id: "ACME-482", title: "Checkout sin duplicado", status: "al-dia" },
    { id: "ACME-491", title: "Alta de póliza", status: "atrasado" },
  ],
  chores: ["chore/deps"],
  orphans: ["arreglo-rapido"],
};

// dai sabe QUÉ entró, no POR QUÉ importa. Un changelog autogenerado desde los commits es
// una lista que nadie lee; el andamio invita a escribir el porqué.
test("la entrada trae el material en un comentario y las secciones vacías", () => {
  const e = changelogEntry({ version: "0.5.0", date: "2026-09-09", manifest: MANIFEST });
  assert.match(e, /^## \[0\.5\.0\] — 2026-09-09/);
  assert.match(e, /ACME-482 {2}Checkout sin duplicado/);
  assert.match(e, /ACME-491.*⚠️ ATRASADA/);
  assert.match(e, /\(sin US\) chore\/deps/);
  assert.match(e, /\(sin US, sin prefijo exento\) arreglo-rapido/);
  assert.match(e, /### Agregado/);
  // el material va en comentario HTML: se ve al editar, desaparece al renderizar
  assert.ok(e.indexOf(CHANGELOG_MARK) < e.indexOf("-->"));
});

test("changelogGaps avisa mientras el andamio siga sin repartir", () => {
  const e = changelogEntry({ version: "0.5.0", date: "2026-09-09", manifest: MANIFEST });
  assert.deepEqual(changelogGaps(e), ["el manifiesto de dai sigue sin repartir", "no hay ni un ítem en las secciones"]);
  const repartida = e.replace(CHANGELOG_MARK, "<!-- listo").replace("### Agregado\n", "### Agregado\n- **ACME-482** deja de duplicar la orden.\n");
  assert.deepEqual(changelogGaps(repartida), []);
});

test("insertChangelogEntry la pone arriba y agrega el link al pie", () => {
  const previo = "# Changelog\n\n## [0.4.2] — 2026-08-01\n\nvieja\n\n[0.4.2]: https://github.com/acme/b/releases/tag/v0.4.2\n";
  const r = insertChangelogEntry(previo, "## [0.5.0] — 2026-09-09\n\nnueva\n", { version: "0.5.0", repoUrl: "https://github.com/acme/b" });
  assert.equal(r.changed, true);
  assert.ok(r.text.indexOf("[0.5.0] — 2026-09-09") < r.text.indexOf("[0.4.2] — 2026-08-01"));
  assert.match(r.text, /\[0\.5\.0\]: https:\/\/github\.com\/acme\/b\/releases\/tag\/v0\.5\.0/);
  assert.ok(r.text.indexOf("[0.5.0]: https") < r.text.indexOf("[0.4.2]: https"));
});

test("insertChangelogEntry no duplica una versión que ya está", () => {
  const previo = "# Changelog\n\n## [0.5.0] — 2026-09-09\n\nya estaba\n";
  const r = insertChangelogEntry(previo, "## [0.5.0] — 2026-09-09\n\notra\n", { version: "0.5.0" });
  assert.equal(r.changed, false);
  assert.match(r.reason, /ya tiene una entrada/);
});

test("insertChangelogEntry funciona en un CHANGELOG que todavía no tiene entradas", () => {
  const r = insertChangelogEntry("# Changelog\n", "## [0.1.0] — 2026-09-09\n\nprimera\n", { version: "0.1.0" });
  assert.equal(r.changed, true);
  assert.match(r.text, /# Changelog\n\n## \[0\.1\.0\]/);
});

// El cuerpo de la versión se reusa como release note del forge: sin el andamio de dai.
test("changelogSection devuelve el cuerpo de una versión, sin los comentarios", () => {
  const ch = "# Changelog\n\n## [0.5.0] — 2026-09-09\n\n<!-- dai:manifiesto x -->\n\n### Agregado\n- algo\n\n## [0.4.2] — 2026-08-01\n\nvieja\n";
  assert.equal(changelogSection(ch, "0.5.0"), "### Agregado\n- algo");
  assert.equal(changelogSection(ch, "9.9.9"), null);
});

// ── nombres ──────────────────────────────────────────────────────────────────
test("normalizeVersion acepta con y sin v, y rechaza lo que no es semver", () => {
  assert.equal(normalizeVersion("v1.2.0"), "1.2.0");
  assert.equal(normalizeVersion(" 1.2.0 "), "1.2.0");
  assert.equal(normalizeVersion("1.2.0-rc.1"), "1.2.0-rc.1");
  for (const malo of ["1.2", "ultima", "", "v", "1.2.0.0"]) {
    assert.throws(() => normalizeVersion(malo), /no es una versión semver/, String(malo));
  }
});

test("releaseBranch y tagName no dejan la v duplicada", () => {
  assert.equal(releaseBranch("1.2.0"), "release/1.2.0");
  assert.equal(tagName("1.2.0"), "v1.2.0");
  assert.equal(tagName("v1.2.0"), "v1.2.0");
});
