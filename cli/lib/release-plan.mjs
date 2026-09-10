// dai · el manifiesto de una release: qué entra entre el último tag y la integración.
//
// Es la pieza de la que dependen los otros comandos de `dai release`, y la que contesta la
// pregunta que a un equipo sin versiones no le contesta nadie: **¿qué User Stories tiene
// esta versión?** El resto —el tag, el CHANGELOG, el comentario en cada ticket, el aviso al
// canal— son formas distintas de publicar ESTE dato.
//
// Todo acá es puro: entran las salidas de git ya crudas y sale la decisión. Los efectos
// (correr git, consultar el tracker) viven en dai.mjs.

import { parseVersion } from "./semver.mjs";
import { branchType, trackerKeysIn } from "./branch-scope.mjs";

// ── Commits ──────────────────────────────────────────────────────────────────
// Formato pedido a git: `%H%x1f%s` por línea (sha, US, subject) — el separador es \x1f
// (unit separator) y no un pipe o un tab porque un subject puede contener cualquiera de
// esos, y partir mal el log es empezar el manifiesto con datos corridos.
export function parseCommitLog(raw) {
  const out = [];
  for (const line of String(raw ?? "").split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf("\x1f");
    if (i === -1) continue;
    const sha = line.slice(0, i).trim();
    const subject = line.slice(i + 1);
    out.push({ sha, subject, ...classifySubject(subject) });
  }
  return out;
}

// Conventional Commits, con la tolerancia justa: el repo puede tener commits que no lo
// sigan, y un manifiesto que los ignora miente por omisión. Los que no matchean quedan
// con type null y se cuentan igual.
const CC = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?:\s*(?<rest>.+)$/i;

export function classifySubject(subject) {
  const s = String(subject ?? "");
  const merge = /^Merge (pull request|branch|remote-tracking)/i.test(s);
  const m = s.match(CC);
  if (!m) return { type: null, scope: null, breaking: false, merge };
  return {
    type: m.groups.type.toLowerCase(),
    scope: m.groups.scope || null,
    breaking: Boolean(m.groups.bang),
    merge,
  };
}

// La branch que trajo un merge commit, cuando el forge la nombra en el subject:
//   "Merge pull request #47 from dforce2055/fix/pr-base"  → "fix/pr-base"
//   "Merge branch 'feature/ABC-1-x' into develop"          → "feature/ABC-1-x"
// Sirve para detectar trabajo que ENTRÓ sin declarar US. Si el equipo hace squash o
// rebase no hay merge commits y esta señal no existe: por eso es un aviso, no un gate.
export function mergedBranch(subject) {
  const s = String(subject ?? "");
  const pr = s.match(/^Merge pull request #\d+ from [^/\s]+\/(.+?)\s*$/i);
  if (pr) return pr[1];
  const br = s.match(/^Merge (?:remote-tracking )?branch '([^']+)'/i);
  if (br) return br[1].replace(/^origin\//, "");
  return null;
}

// ── Bump propuesto ───────────────────────────────────────────────────────────
// PROPUESTO, no decidido. dai mira los tipos de commit, que es lo único que puede leer
// sin criterio; la regla del repo mira el COMPORTAMIENTO, y esa diferencia no es teórica:
// la 0.14.0 salió con cuatro commits `fix:` y era minor, porque cambió un default
// observable. Cualquier derivación automática habría cortado un patch equivocado.
// Por eso esto devuelve un PISO y su justificación, y quien firma es una persona.
export function proposeBump(commits = []) {
  const realCommits = commits.filter((c) => !c.merge);
  if (realCommits.some((c) => c.breaking)) {
    const offender = realCommits.find((c) => c.breaking);
    return { bump: "major", floor: true, reason: `hay un commit marcado como breaking (${offender.subject})` };
  }
  if (realCommits.some((c) => c.type === "feat")) {
    const n = realCommits.filter((c) => c.type === "feat").length;
    return { bump: "minor", floor: true, reason: `${n} commit(s) feat: agregan funcionalidad` };
  }
  return {
    bump: "patch",
    floor: true,
    reason: realCommits.length
      ? `solo hay ${[...new Set(realCommits.map((c) => c.type || "sin-tipo"))].sort().join(", ")}: ningún feat ni breaking`
      : "no hay commits nuevos",
  };
}

// El aviso que acompaña SIEMPRE a la propuesta. No es decoración: es la diferencia entre
// una sugerencia y una automatización que se equivoca en silencio.
export const BUMP_CAVEAT =
  "propuesta a partir de los TIPOS de commit — la regla del repo mira el COMPORTAMIENTO.\n" +
  "  Si algo mueve un default, agrega un flag o cambia lo que ve quien no configura nada,\n" +
  "  es minor aunque todo sea `fix:`. Decidilo vos: dai propone, no versiona por su cuenta.";

export function nextVersion(current, bump) {
  const v = parseVersion(current);
  if (!v) return null;
  if (bump === "major") return `${v.major + 1}.0.0`;
  if (bump === "minor") return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

// ── Manifiesto ───────────────────────────────────────────────────────────────
// `linked` son las filas de implements.yaml que aparecieron en el rango (las arma dai.mjs
// leyendo el árbol de cada commit: el link viaja CON el código, así que no depende de que
// la branch siga existiendo ni de que el change no se haya archivado).
// `live` es lo que contestó el tracker por id: { [id]: { title, ac_hash, spec_version } }.
export function buildManifest({ commits = [], linked = [], live = {}, unreachable = false, repoUsesStories = true } = {}) {
  // Una US puede aparecer en varios commits (se creó el link, después se resincronizó) y
  // en dos paths (el change y su copia archivada). El manifiesto la nombra UNA vez.
  const porId = new Map();
  for (const r of linked) {
    if (!r?.id) continue;
    const prev = porId.get(r.id);
    // Gana la última aparición: es el estado con el que la US entró al release.
    if (!prev || (r.order ?? 0) >= (prev.order ?? 0)) porId.set(r.id, r);
  }

  const stories = [...porId.values()].map((r) => {
    const l = live[r.id];
    const storyStatus = unreachable || !l ? (unreachable ? "sin-respuesta" : "sin-us")
      : l.ac_hash === r.ac_hash ? "al-dia" : "atrasado";
    return {
      id: r.id,
      title: l?.title ?? null,
      version: r.version ?? null,
      ac_hash: r.ac_hash ?? null,
      spec_version: l?.spec_version ?? null,
      change: r.change ?? null,
      status: storyStatus,
    };
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Las branches que se mergearon en el rango, separadas en las que declaran US y las que
  // están exentas por tipo. Las que NO son ninguna de las dos son el hallazgo: entró
  // trabajo de producto sin link, y esta es la última oportunidad de verlo.
  const ids = new Set(stories.map((s) => String(s.id).toLowerCase()));
  const branches = commits.map((c) => mergedBranch(c.subject)).filter(Boolean);
  const EXEMPT_TYPES = new Set(["chore", "docs", "ci", "build", "test", "refactor", "style", "release", "hotfix", "revert"]);
  const chores = [], orphans = [];
  for (const b of branches) {
    if (namesAnyStory(b, ids)) continue;                 // ya está contada como US
    if (EXEMPT_TYPES.has(branchType(b))) { chores.push(b); continue; }
    // "Entró trabajo sin link" solo es un hallazgo si el repo trabaja con User Stories. En
    // un repo de tooling —el de dai, sin ir más lejos— NINGUNA branch va a declarar una, y
    // marcarlas todas convierte el aviso en ruido que se aprende a ignorar. La excepción es
    // una branch que NOMBRA un ticket: ahí alguien quiso linkear una US y no lo hizo, y eso
    // vale como hallazgo aunque el repo no declare ninguna.
    if (repoUsesStories || trackerKeysIn(b).length > 0) orphans.push(b);
    else chores.push(b);
  }

  return {
    stories,
    chores,
    orphans,
    counts: {
      commits: commits.filter((c) => !c.merge).length,
      merges: commits.filter((c) => c.merge).length,
      stories: stories.length,
      stale: stories.filter((s) => s.status === "atrasado").length,
    },
  };
}

// ¿El nombre de la branch nombra alguna de las US del manifiesto? Comparación en
// minúsculas: el slug de la branch va en minúscula y el key del tracker en mayúscula.
function namesAnyStory(branch, ids) {
  const b = String(branch).toLowerCase();
  for (const id of ids) if (b.includes(id)) return true;
  return false;
}

// ── Render ───────────────────────────────────────────────────────────────────
const ICON = { "al-dia": "✅", atrasado: "⚠️ ", "sin-us": "❓", "sin-respuesta": "⚠️ " };
const LABEL = {
  "al-dia": "al día", atrasado: "ATRASADA", "sin-us": "no está en el tracker",
  "sin-respuesta": "no verificada",
};

export function renderManifest(m, ctx = {}) {
  const { from, to, current, proposed, bump, reason } = ctx;
  const L = [];
  L.push(`  ── Release a preparar ────────────────────────────────`);
  L.push(`  desde:    ${from || "(el principio del repo)"}`);
  L.push(`  hasta:    ${to}`);
  L.push(`  cambios:  ${m.counts.commits} commit(s) · ${m.counts.merges} merge(s)`);
  L.push(`  versión:  ${current} → ${proposed || "(sin propuesta)"}  (${bump})`);
  L.push(`  ─────────────────────────────────────────────────────`);

  if (m.stories.length === 0) {
    L.push(`  Ninguna US declarada en este rango.`);
  } else {
    L.push(`  User Stories que entran (${m.stories.length}):`);
    const w = Math.max(...m.stories.map((s) => String(s.id).length), 4);
    for (const s of m.stories) {
      const t = s.title ? `  ${s.title}` : "";
      L.push(`    ${ICON[s.status] || " "} ${String(s.id).padEnd(w)}  ${s.version || "?"}${t}`);
      if (s.status !== "al-dia") L.push(`       ${" ".repeat(w)}   ${LABEL[s.status]}`);
    }
  }
  if (m.counts.stale > 0) {
    L.push(``);
    L.push(`  ⚠ ${m.counts.stale} US ATRASADA(S): el QUÉ cambió después de implementarlo.`);
    L.push(`    Esta release las llevaría sin cubrir el criterio nuevo. Revisalas antes de cortar.`);
  }
  if (m.chores.length) {
    L.push(``);
    L.push(`  Sin US (${m.chores.length}): ${m.chores.slice(0, 6).join(", ")}${m.chores.length > 6 ? "…" : ""}`);
  }
  if (m.orphans.length) {
    L.push(``);
    L.push(`  ⚠ ${m.orphans.length} branch(es) sin US y sin prefijo exento:`);
    for (const b of m.orphans) L.push(`      ${b}`);
    L.push(`    Entró trabajo que nadie va a poder rastrear a una historia. Es la última`);
    L.push(`    oportunidad de verlo antes de que quede adentro de una versión.`);
  }
  L.push(`  ─────────────────────────────────────────────────────`);
  if (reason) L.push(`  ${bump}: ${reason}`);
  return L.join("\n");
}
