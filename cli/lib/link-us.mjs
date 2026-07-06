// dai · helpers puros de link-us (crear el link QUÉ↔CÓMO por construcción).
// La parte con efectos (git, escribir archivos) vive en dai.mjs; acá solo la
// lógica pura y testeable: slug, nombre de branch, título, render del yaml.

// Key del tracker, agnóstico de herramienta: Jira (`ABC-482`), ClickUp (`86cxyz`),
// custom, etc. Solo exige un identificador sano para una branch/URL: sin espacios,
// sin barras, no vacío.
export const US_KEY_RE = /^[\w.-]+$/;

export function isValidKey(key) {
  return US_KEY_RE.test((key || "").trim());
}

// slug: minúsculas, sin acentos/ñ, no-alfanumérico → guion, recortado.
export function slugify(s) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function branchName(key, title) {
  return `feature/${key}-${slugify(title)}`;
}

// Título de la US: primer H1 que NO sea la cabecera de metadata.
export function extractTitle(md) {
  for (const line of (md || "").split(/\r?\n/)) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (!m) continue;
    const text = m[1].replace(/[🔗*_`#]/g, "").trim();
    if (/metadata/i.test(text)) continue;   // saltea "# 🔗 Metadata de trazabilidad"
    if (text === "") continue;
    return text;
  }
  return null;
}

// Render del implements.yaml (schema ADR-0004).
export function renderImplementsYaml({ change, repo, id, version = "v1", ac_hash, autor }) {
  return `# Link QUÉ↔CÓMO · scaffoldeado por dai link-us. El ÚNICO link autorado a mano.
# Schema: docs/adr/0004-ubicacion-y-schema-implements.md
change: ${change}
repo:   ${repo}

implements:
  - id: ${id}
    version: ${version}
    ac_hash: ${ac_hash}

introduces:
  - <capacidad-tecnica>   # completar: specs técnicas nuevas de este change

autor: ${autor}
`;
}
