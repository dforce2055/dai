// dai · los archivos que toca cortar una versión: dónde vive el número y qué se escribe
// en el CHANGELOG. Parte pura; los efectos (escribir, commitear, taguear) viven en dai.mjs.
//
// Premisa que vale para todo el módulo: **el tag es la fuente de verdad de la versión; los
// archivos son espejos opcionales.** Un repo Node tiene package.json, dai tiene además un
// VERSION, y un repo .NET o un frontend corporativo puede no tener ninguno de los dos y
// versionar igual. Por eso dai actualiza los espejos que RECONOCE, dice cuáles tocó, y no
// se planta si no encuentra ninguno.

// ── El número, en los archivos que lo espejan ────────────────────────────────

// package.json: se cambia SOLO la línea de la versión.
//
// Reserializar el JSON (`JSON.stringify(pkg, null, 2)`) parece más limpio y es peor: te
// reformatea los objetos compactos (`"repository": { ... }` en una línea) a multi-línea y
// ensucia el diff de la release con ruido que nadie pidió. El diff de un `chore(release)`
// tiene que ser tres líneas.
export function bumpPackageJson(text, version) {
  const re = /("version"\s*:\s*")([^"]*)(")/;
  const m = String(text ?? "").match(re);
  if (!m) return { text, changed: false, from: null };
  if (m[2] === version) return { text, changed: false, from: m[2] };
  return { text: text.replace(re, `$1${version}$3`), changed: true, from: m[2] };
}

// VERSION: el archivo entero es el número. Sin salto final, como lo escribe dai.
export function bumpVersionFile(text, version) {
  const from = String(text ?? "").trim().split("\n")[0] || null;
  if (from === version) return { text, changed: false, from };
  return { text: version, changed: true, from };
}

// ── CHANGELOG ────────────────────────────────────────────────────────────────
// Keep a Changelog. dai escribe el ANDAMIO y el material; la prosa la escribe una persona
// (o la skill), y esa división no es pereza: dai sabe QUÉ entró, no POR QUÉ importa. Un
// changelog autogenerado desde los commits es una lista que nadie lee — el de este repo se
// lee justamente porque cada entrada cuenta qué estaba mal.
//
// El material va en un comentario HTML: se ve al editar y desaparece al renderizar, así
// que si alguien no lo reparte, el archivo publicado no queda con andamio a la vista.
export const CHANGELOG_MARK = "<!-- dai:manifiesto";

export function changelogEntry({ version, date, manifest = {}, secciones = ["Agregado", "Cambiado", "Corregido", "Interno"] }) {
  const L = [`## [${version}] — ${date}`, ""];
  L.push(`${CHANGELOG_MARK} · el material de esta versión. Repartilo abajo y contá el porqué:`);
  L.push(`     dai sabe qué entró; por qué importa lo sabés vos.`);
  for (const s of manifest.stories || []) {
    L.push(`     ${s.id}${s.title ? `  ${s.title}` : ""}${s.status === "atrasado" ? "   ⚠️ ATRASADA" : ""}`);
  }
  for (const b of manifest.chores || []) L.push(`     (sin US) ${b}`);
  for (const b of manifest.orphans || []) L.push(`     (sin US, sin prefijo exento) ${b}`);
  if (!(manifest.stories || []).length && !(manifest.chores || []).length && !(manifest.orphans || []).length) {
    L.push(`     (el manifiesto no encontró US ni branches en el rango)`);
  }
  L.push(`-->`);
  L.push("");
  for (const s of secciones) { L.push(`### ${s}`); L.push(""); }
  return L.join("\n");
}

// ¿La entrada quedó con el andamio sin repartir? Mismo espíritu que `bodyGaps` en `dai pr`:
// publicar el molde es peor que no publicar nada, porque parece que alguien lo escribió.
// Acá es un AVISO, no un bloqueo: cortar la versión no debe frenarse por la redacción.
export function changelogGaps(entry) {
  const gaps = [];
  const body = String(entry ?? "").replace(/<!--[\s\S]*?-->/g, "");
  if (String(entry ?? "").includes(CHANGELOG_MARK)) gaps.push("el manifiesto de dai sigue sin repartir");
  const hasItems = body.split("\n").some((l) => /^\s*[-*]\s+\S/.test(l));
  if (!hasItems) gaps.push("no hay ni un ítem en las secciones");
  return gaps;
}

// Inserta la entrada arriba de la primera que ya exista, y agrega el link al pie.
// Idempotente en lo que importa: si la versión YA está, no la duplica.
export function insertChangelogEntry(text, entry, { version, repoUrl } = {}) {
  const s = String(text ?? "");
  if (version && new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m").test(s)) {
    return { text: s, changed: false, reason: `el CHANGELOG ya tiene una entrada para ${version}` };
  }
  const i = s.search(/^## \[/m);
  let out = i === -1
    ? `${s.replace(/\s*$/, "")}\n\n${entry}\n`
    : `${s.slice(0, i)}${entry}\n${s.slice(i)}`;
  if (version && repoUrl) {
    const link = `[${version}]: ${repoUrl.replace(/\/+$/, "")}/releases/tag/v${version}`;
    if (!out.includes(link)) {
      // Junto a los otros links del pie si los hay; si no, al final.
      const j = out.search(/^\[\d+\.\d+\.\d+\]: /m);
      out = j === -1 ? `${out.replace(/\s*$/, "")}\n\n${link}\n` : `${out.slice(0, j)}${link}\n${out.slice(j)}`;
    }
  }
  return { text: out, changed: true, reason: null };
}

// El cuerpo de una versión, para reusarlo como release note del forge.
export function changelogSection(text, version) {
  const s = String(text ?? "");
  const re = new RegExp(`^## \\[${String(version).replace(/\./g, "\\.")}\\][^\\n]*\\n`, "m");
  const m = s.match(re);
  if (!m) return null;
  const ini = m.index + m[0].length;
  const rest = s.slice(ini);
  const j = rest.search(/^## \[/m);
  return (j === -1 ? rest : rest.slice(0, j)).replace(/<!--[\s\S]*?-->/g, "").trim() || null;
}

// ── Nombres ──────────────────────────────────────────────────────────────────
export const releaseBranch = (version) => `release/${version}`;
export const tagName = (version) => `v${String(version).replace(/^v/, "")}`;

// Normaliza y valida lo que tipeó quien corta la versión. Un tag mal escrito se arrastra a
// npm, al CHANGELOG y a todos los avisos, y renombrarlo después no existe.
export function normalizeVersion(input) {
  const v = String(input ?? "").trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.\-+]+)?$/.test(v)) {
    throw new Error(`'${input}' no es una versión semver (X.Y.Z, opcionalmente -rc.1).`);
  }
  return v;
}
