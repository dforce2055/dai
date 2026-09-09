// dai · qué US toca esta branch (governance/branch-naming.md, ADR-0004).
//
// Dos preguntas que el CLI se hacía a ojo y respondía mal:
//   1. `dai stamp` — ¿cuál de las US del repo estoy cerrando? (issue #22: estampaba TODAS,
//      archivadas incluidas, así que un sprint entero recibía un comentario por PR).
//   2. `dai check --ci` — ¿esta branch está OBLIGADA a tener implements.yaml? Una `chore/`
//      o una `fix/` sin US no lo está, y bloquearla sería mentirle al equipo.
//
// Todo acá es puro: entra el nombre de la branch y la lista de implements, sale la
// decisión. La red, git y los prompts viven en dai.mjs.

import { isPlaceholderId } from "./implements.mjs";

// Prefijos que NO son trabajo de producto: no exigen link (branch-naming.md).
// `fix/` es "corrección sobre una US ya implementada": puede llevar ID o no, y muchas
// veces es un hotfix sin ticket. Se exige link solo si el nombre trae el ID.
const EXEMPT = new Set(["chore", "docs", "ci", "build", "test", "refactor", "style", "release", "hotfix", "revert"]);
const ALWAYS = new Set(["feature", "feat"]);

// El tipo de branch = lo que hay antes de la primera `/`. Sin `/` → "" (main, develop…).
export function branchType(branch) {
  const s = String(branch ?? "").trim();
  const i = s.indexOf("/");
  return i === -1 ? "" : s.slice(0, i).toLowerCase();
}

// Los ids candidatos que aparecen en el nombre de la branch, en orden de aparición.
// Cubre las dos formas que emite `link-us` (ver slugify/branchName en link-us.mjs):
//   feature/ABC-482-titulo   → Jira-like (LETRAS-números)
//   feature/86acme482-titulo → ClickUp-like (alfanumérico, sin guion)
// Devuelve TODOS los candidatos porque el segmento alfanumérico es ambiguo: `historia`
// también matchea. Quién decide es matchBranchToImplements, comparando contra las US reales.
export function branchIdCandidates(branch) {
  const s = String(branch ?? "").trim();
  const tail = s.includes("/") ? s.slice(s.indexOf("/") + 1) : s;
  const out = [];
  for (const m of tail.matchAll(/[A-Za-z][A-Za-z0-9_]*-\d+|[A-Za-z0-9]+/g)) out.push(m[0]);
  return out;
}

// Un key de tracker con pinta de tal: MAYÚSCULAS + guion + números (ABC-482). El case
// importa — es lo único que separa un key real de una palabra del slug con un número
// pegado: `feat/issues-22-26` no implementa la US "issues-22", y sugerírsela al dev es
// mandarlo a crear un link inventado. Los ids de ClickUp (`86acme482`) no matchean acá:
// no llevan guion, y para esos el nombre de la branch no alcanza — se resuelve comparando
// contra las US que el repo declara (matchBranchToImplements).
const KEYISH = /^[A-Z][A-Z0-9_]*-\d+$/;

// Los keys de tracker que nombra la branch (0, 1 o varios).
export function trackerKeysIn(branch) {
  return branchIdCandidates(branch).filter((c) => KEYISH.test(c));
}

// ¿Esta branch tiene que declarar una US? (gate de CI, issue #26)
//   feature/ → siempre sí
//   chore/, docs/, ci/…  → nunca
//   fix/ y el resto → solo si el nombre trae un ID con pinta de key de tracker
// `main`/`develop`/sin branch → no (no es una branch de trabajo).
//
// `kind` distingue POR QUÉ no se exige, que no es lo mismo para todos los comandos:
// una `chore/` está exenta POR TIPO (el repo declara que ahí no hay producto), mientras
// que `mi-branch` simplemente no dice nada. `dai pr` usa esa diferencia para no colgarle
// la US viva del repo a una PR de archivado (issue #31).
export function requiresLink(branch) {
  const t = branchType(branch);
  if (ALWAYS.has(t)) return { required: true, kind: "always", reason: `'${t}/' es trabajo de producto: requiere US` };
  if (EXEMPT.has(t)) return { required: false, kind: "exempt", reason: `'${t}/' está exenta de US (governance/branch-naming.md)` };
  if (t === "") return { required: false, kind: "untyped", reason: "sin prefijo tipo/, no es una branch de trabajo: sin gate de link" };
  // Tipo desconocido (fix/, spike/, lo que el repo use): si nombró un ID, lo tomamos
  // como intención de implementar una US y se lo exigimos. Si no, no inventamos.
  const keyish = trackerKeysIn(branch).length > 0;
  return keyish
    ? { required: true, kind: "always", reason: `'${t}/' con un ID en el nombre: se toma como trabajo de producto` }
    : { required: false, kind: "untyped", reason: `'${t}/' sin ID en el nombre: no exige US (governance/branch-naming.md)` };
}

// Aplana los implements descubiertos a filas { path, change, repo, id, version, ac_hash },
// salteando los placeholders de plantilla (ABC-###).
export function flattenImplements(found) {
  const rows = [];
  for (const f of found || []) {
    for (const im of f.implements || []) {
      if (isPlaceholderId(im.id)) continue;
      rows.push({ path: f.path, change: f.change, repo: f.repo, id: im.id, version: im.version, ac_hash: im.ac_hash });
    }
  }
  return rows;
}

// ¿Cuál de estas US es la de la branch? Compara sin distinguir mayúsculas, porque el
// slug de la branch va en minúsculas y el key de Jira en mayúsculas (ABC-482 → abc-482).
export function matchBranchToImplements(branch, rows) {
  const cands = branchIdCandidates(branch).map((c) => c.toLowerCase());
  if (cands.length === 0) return [];
  const seen = new Set();
  const hit = [];
  for (const c of cands) {
    for (const r of rows) {
      if (String(r.id).toLowerCase() === c && !seen.has(r.path + " " + r.id)) {
        seen.add(r.path + " " + r.id);
        hit.push(r);
      }
    }
  }
  return hit;
}

// La decisión completa de `dai stamp`: qué estampar y por qué.
//
//   { mode, targets, candidates, reason }
//
//   mode "explicit" → los ids que pidió el usuario (dai stamp ABC-482)
//   mode "all"      → --all: todo, archivadas incluidas (el comportamiento viejo)
//   mode "branch"   → la branch nombra una US del repo: esa
//   mode "only"     → hay una sola US viva: esa
//   mode "ambiguous"→ varias y ninguna pista: NO estampa, pide confirmación
//   mode "none"     → no hay nada que estampar
//
// `rows` viene de flattenImplements sobre el discover SIN archivados; `allRows` incluye
// los archivados y solo se usa para --all y para resolver un id explícito de un change
// ya archivado (estampar después del merge es exactamente ese caso).
export function stampScope({ branch, rows, allRows = rows, ids = [], all = false }) {
  if (all) {
    return { mode: "all", targets: allRows, candidates: allRows, reason: "--all: todas las US del repo (archivadas incluidas)" };
  }
  if (ids.length) {
    const want = ids.map((i) => String(i).toLowerCase());
    const targets = allRows.filter((r) => want.includes(String(r.id).toLowerCase()));
    // `missing` conserva la grafía que tipeó el usuario: si le devolvemos su ABC-404 en
    // minúsculas, lo primero que hace es dudar de si el problema era el case.
    const missing = ids.filter((i) => !allRows.some((r) => String(r.id).toLowerCase() === String(i).toLowerCase()));
    return { mode: "explicit", targets, candidates: allRows, missing, reason: `ids pedidos: ${ids.join(", ")}` };
  }
  if (rows.length === 0) return { mode: "none", targets: [], candidates: [], reason: "no hay implements.yaml vivos para estampar" };

  const hit = matchBranchToImplements(branch, rows);
  if (hit.length === 1) {
    return { mode: "branch", targets: hit, candidates: rows, reason: `la branch '${branch}' nombra ${hit[0].id}` };
  }
  if (rows.length === 1) {
    return { mode: "only", targets: rows, candidates: rows, reason: "es la única US viva del repo" };
  }
  return {
    mode: "ambiguous",
    targets: [],
    candidates: hit.length > 1 ? hit : rows,
    reason: `hay ${hit.length > 1 ? hit.length : rows.length} US vivas y la branch '${branch}' no dice cuál`,
  };
}

// La decisión de `dai pr`: ¿con qué US se titula y se linkea ESTA PR?
//
//   { mode, target, candidates, reason, missing }
//
//   mode "explicit"  → el id que pidió el usuario (dai pr --us ABC-482)
//   mode "branch"    → la branch nombra una US viva del repo: esa
//   mode "only"      → hay una sola US viva y la branch no está exenta: esa
//   mode "exempt"    → branch exenta por tipo (chore/, docs/…) que no nombra US: PR SIN US
//   mode "ambiguous" → varias candidatas y ninguna pista: NO elige, pregunta
//   mode "none"      → la branch pide US y el repo no tiene ninguna viva
//
// Es la misma pregunta que resuelve stampScope, con dos diferencias que importan
// (issues #31, #32, #33 — antes `dai pr` recorría TODOS los implements.yaml del repo,
// archivados incluidos, y se quedaba con el último):
//
//   1. Una PR implementa UNA US, no cuatro: no hay modo "all", y el resultado es un
//      único `target`.
//   2. Una branch exenta NO hereda la US viva del repo. Una PR de `chore/archive-specs`
//      titulada con la historia de un compañero es peor que una sin título lindo: la
//      lista de PRs es la única superficie donde el equipo lee la trazabilidad.
//
// `rows` viene del discover SIN archivados; `allRows` incluye los archivados y solo se
// usa para resolver un id explícito (reabrir la PR de un change ya archivado) y para
// listar qué US conoce el repo cuando el id pedido no está.
export function prScope({ branch, rows, allRows = rows, ids = [] }) {
  if (ids.length) {
    const want = String(ids[0]).toLowerCase();
    const target = allRows.find((r) => String(r.id).toLowerCase() === want) || null;
    // `missing` conserva la grafía del usuario: devolverle su ABC-404 en minúsculas lo
    // manda a dudar del case en vez de del id.
    return { mode: "explicit", target, candidates: allRows, missing: target ? [] : [ids[0]], reason: `pediste --us ${ids[0]}` };
  }

  const hit = matchBranchToImplements(branch, rows);
  if (hit.length === 1) {
    return { mode: "branch", target: hit[0], candidates: rows, reason: `la branch '${branch}' nombra ${hit[0].id}` };
  }
  if (hit.length > 1) {
    return { mode: "ambiguous", target: null, candidates: hit, reason: `la branch '${branch}' nombra ${hit.length} US vivas` };
  }

  // La branch no nombra ninguna US viva.
  const req = requiresLink(branch);
  if (req.kind === "exempt") {
    return { mode: "exempt", target: null, candidates: rows, reason: `${req.reason} y su nombre no nombra ninguna US` };
  }
  // El repo no tiene NINGUNA US viva. Exigir un link acá es pedir algo que no existe: le
  // pasa a cualquier repo de tooling —al de dai, sin ir más lejos, que no se trackea a sí
  // mismo con US— y el mensaje terminaba mandando a renombrar la branch a `chore/`, que
  // para un fix o una feature es el consejo equivocado.
  //
  // Lo que SÍ distingue un olvido de un repo sin US es si la branch NOMBRA UN TICKET: con
  // `feature/ABC-482-checkout` alguien quiso implementar una US y no corrió `link-us`, y
  // ahí el link falta de verdad. Sin key en el nombre no hay nada que reclamar.
  //
  // Esto no afloja ningún gate: el gate es `dai check --ci`, que sigue mirando requiresLink.
  // Acá solo se decide con qué titular una PR.
  // Se mira `allRows` (archivados incluidos), no `rows`: un repo con US archivadas SÍ
  // trabaja con User Stories, así que una `feature/` sin link ahí es un olvido, no un repo
  // de tooling. La exención es para el repo que nunca declaró una.
  if (allRows.length === 0 && trackerKeysIn(branch).length === 0) {
    return {
      mode: "exempt", target: null, candidates: [],
      // Si branch-naming ya tiene un motivo (chore/ exenta por tipo, fix/ sin ID), se usa
      // ese: es más específico y es el que el equipo puede ir a leer.
      reason: req.required
        ? "la branch no nombra ninguna US y el repo no declara ninguna"
        : `${req.reason}, y el repo no declara ninguna US`,
    };
  }
  if (rows.length === 0) return { mode: "none", target: null, candidates: [], reason: "no hay implements.yaml vivo en el repo" };
  if (rows.length === 1) return { mode: "only", target: rows[0], candidates: rows, reason: "es la única US viva del repo" };
  return { mode: "ambiguous", target: null, candidates: rows, reason: `hay ${rows.length} US vivas y la branch '${branch}' no dice cuál` };
}
