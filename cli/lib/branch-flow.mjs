// dai · el mapa de ramas de vida larga del repo, y de ahí la base de cada PR (issue #46).
//
// El default `main` hardcodeado miente en cualquier repo cuyo flujo no sea el de GitHub:
// con ramas de ambiente (`testing` integra, `main` DESPLIEGA A PRODUCCIÓN), `dai pr`
// proponía mergear a producción y el preview no lo destacaba de ninguna forma. Había que
// acordarse de `--base testing` en cada invocación; el día que alguien se olvida, la MR
// queda apuntando a PRO y nada avisa.
//
// La primera versión pedía configurar "la base", y ese era el error de modelado: la base
// NO es una constante, es una consecuencia del TIPO de branch —
//
//   feature/ · fix/ · lo que sea   → rama de integración   (DAI_BRANCH_DEV)
//   release/ · hotfix/             → rama de producción    (DAI_BRANCH_PROD)
//
// Por eso no se configura una base: se declaran las DOS ramas de vida larga del repo, que
// son dos hechos que dai no puede deducir de ningún lado, y la base sale del mapa.
// Lo que dai NO hace es adivinar: sin `DAI_BRANCH_PROD` declarada no marca nada como
// producción — inventar un gate sobre una suposición es peor que no tenerlo.

import { branchType } from "./branch-scope.mjs";

export const DEFAULT_BASE = "main";

// Ramas de vida larga declaradas por el repo. `null` = no declarada (≠ vacía).
export function branchFlow(env = {}) {
  const val = (k) => String(env[k] ?? "").trim() || null;
  return { dev: val("DAI_BRANCH_DEV"), prod: val("DAI_BRANCH_PROD") };
}

// Los tipos de branch que van contra producción: una release que se corta y un hotfix
// que sale del tag que está en PRO. El resto integra.
const PROD_BOUND_TYPES = new Set(["release", "hotfix"]);

// Resuelve la base de una PR y —tan importante como el valor— POR QUÉ es esa.
//   --base > el mapa de ramas según el tipo de branch > rama default del remoto > main
export function resolveBase({ flag, branch = null, env = {}, originHead = null } = {}) {
  const explicit = typeof flag === "string" ? flag.trim() : "";
  if (explicit) return { base: explicit, source: "--base", reason: null };

  const flow = branchFlow(env);
  const branchKind = branchType(branch);
  if (PROD_BOUND_TYPES.has(branchKind) && flow.prod) {
    return { base: flow.prod, source: "DAI_BRANCH_PROD (.env.dai)", reason: `la branch es ${branchKind}/` };
  }
  if (flow.dev) {
    return { base: flow.dev, source: "DAI_BRANCH_DEV (.env.dai)", reason: null };
  }
  // Un repo puede declarar solo la de producción (flujo de una sola rama). Ahí la base es
  // esa, y el gate de producción se dispara — que es exactamente lo que quiso quien la declaró.
  if (flow.prod) return { base: flow.prod, source: "DAI_BRANCH_PROD (.env.dai)", reason: "es la única rama declarada" };

  const head = String(originHead ?? "").trim();
  if (head) return { base: head, source: "rama default de origin", reason: null };
  return { base: DEFAULT_BASE, source: "default de dai", reason: null };
}

// ¿Esta base es la rama que despliega a producción? Solo si el repo lo declaró.
export function isProdBranch(base, env = {}) {
  const b = String(base ?? "").trim();
  return b !== "" && b === branchFlow(env).prod;
}

// Las fuentes que YA son una decisión de alguien: no hay nada que avisar.
const DECIDED_SOURCES = new Set(["--base", "DAI_BRANCH_DEV (.env.dai)", "DAI_BRANCH_PROD (.env.dai)", "lo respondiste vos"]);

// El aviso que va debajo del preview cuando la base salió de un default. Desaparece en
// cuanto el repo declara su mapa de ramas, que es justo lo que se le pide.
export function baseHint(source, base) {
  if (DECIDED_SOURCES.has(source)) return null;
  return `la base '${base}' salió de ${source} — dai no sabe cuáles son las ramas de vida larga de este repo. Declaralas una vez en el .env.dai:\n` +
         `    DAI_BRANCH_DEV=<rama-que-integra>   ·   DAI_BRANCH_PROD=<rama-que-despliega-a-PRO>\n` +
         `    Con eso: feature/ y fix/ van contra DEV; release/ y hotfix/ contra PROD (con confirmación).`;
}

// Normaliza lo que devuelve `git symbolic-ref refs/remotes/origin/HEAD` → nombre de rama.
//   "origin/main" → "main" · "refs/remotes/origin/main" → "main" · basura → null
export function parseOriginHead(out) {
  const s = String(out ?? "").trim();
  if (!s) return null;
  const m = s.match(/(?:^|\/)origin\/(.+)$/);
  return m ? m[1].trim() || null : null;
}

// ── Ramas protegidas y "no hay commits" ─────────────────────────────────────
// Las ramas de vida larga: pushear directo a cualquiera de estas saltea la PR y el review,
// y en muchos repos DESPLIEGA. dai no sugiere nunca un comando que empuje a una de ellas
// (issue #62: el consejo `git push origin develop` terminó en un deploy a TEST sin PR).
const PROTECTED_DEFAULTS = ["main", "master", "develop", "stage", "staging", "qa", "test", "testing"];

export function isProtectedBranch(name, env = {}) {
  const b = String(name ?? "").trim();
  if (!b) return false;
  const flow = branchFlow(env);
  return PROTECTED_DEFAULTS.includes(b) || b === flow.dev || b === flow.prod;
}

// Qué decir cuando la branch no tiene commits propios respecto de origin/<base>.
// "No commits between" casi nunca es que las historias no se conozcan: es que la branch
// está vacía. Dos causas, y ninguna se arregla empujando la base:
//   · localUnpushed > 0 → el dev commiteó en la base LOCAL y no en su branch: se mueven.
//   · si no → no commiteó todavía, o el trabajo ya entró a la base por fuera de una PR.
// Devuelve { warn, lines }: el aviso y los pasos, para que dai.mjs solo los imprima.
export function emptyBranchAdvice({ base, branch, localUnpushed = 0 }) {
  if (localUnpushed > 0) {
    return {
      warn: `tu branch '${branch}' no tiene commits propios respecto de origin/${base}.`,
      lines: [
        `Tus commits parecen estar en '${base}' LOCAL (${localUnpushed} sin publicar). No empujes ${base}: saltearía la PR.`,
        `Movelos a tu branch y dejá '${base}' como en el remoto:`,
        `  git checkout ${base}`,
        `  git branch -f ${branch} ${base}`,
        `  git reset --hard origin/${base}`,
        `  git checkout ${branch}`,
        `y vuelve a correr:  dai pr`,
      ],
    };
  }
  return {
    warn: `tu branch '${branch}' no tiene commits propios respecto de origin/${base}: no hay nada que proponer.`,
    lines: [
      `O todavía no commiteaste (git commit), o tu trabajo ya entró a '${base}' por fuera de una PR.`,
      `Revisalo con:  git log --oneline origin/${base} -5`,
    ],
  };
}

// La base no existe en el remoto. Recién acá tiene sentido hablar de publicarla, y aun
// así NUNCA si es una rama protegida: lo más probable es un typo en --base o un remoto
// equivocado, y crear `develop` a mano en el remoto de otro tampoco lo pidió nadie.
export function missingBaseAdvice({ base, env = {} }) {
  const warn = `la branch base '${base}' no existe en origin.`;
  if (isProtectedBranch(base, env)) {
    return { warn, lines: [
      `Revisá el nombre (--base) y que 'origin' sea el remoto correcto:  git ls-remote --heads origin`,
      `'${base}' es una rama de vida larga: dai no la publica ni te sugiere hacerlo — pedíselo a quien mantiene el repo.`,
    ] };
  }
  return { warn, lines: [
    `Revisá el nombre (--base). Si la base es nueva y te toca crearla:  git push origin ${base}`,
    `y vuelve a correr:  dai pr`,
  ] };
}

// Historias sin relación: la branch no sale de la base. Ningún push lo arregla.
export function unrelatedHistoryAdvice({ base, branch }) {
  return {
    warn: `'${branch}' y '${base}' no comparten historia en el remoto.`,
    lines: [
      `Suele pasar cuando la branch salió de otro repo o de otra raíz. Partí de la base y traé tus commits:`,
      `  git fetch origin ${base}`,
      `  git checkout -b ${branch}-rebased origin/${base}`,
      `  git cherry-pick <tus-commits>`,
    ],
  };
}
