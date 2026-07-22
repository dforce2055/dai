// dai · validación del formato de una US y manejo de `spec_version`.
//
// El molde canónico vive en templates/formato-us.md. Acá está la parte MECÁNICA de ese
// molde: ¿tiene título? ¿tiene criterios? ¿los criterios son Gherkin completo?
//
// Lo que NO hace: juzgar si un criterio es *bueno*. Eso es criterio (ADR-0002) y vive en
// la skill /grill-user-story, que te interroga. Acá solo se verifica lo que una máquina
// puede verificar sin opinar — y por eso casi todo es WARNING, no error: dai es una
// herramienta, no un mandato. Bloquean únicamente las tres cosas sin las cuales el link
// QUÉ↔CÓMO no existe: título, sección de criterios, y al menos un criterio.

import { extractAcBlock } from "./ac-hash.mjs";
import { extractTitle } from "./link-us.mjs";

// Limpia el marcado editorial de una línea para poder mirarla (mismo espíritu que
// normalizeAcBlock, pero conservando las líneas: acá importa la ESTRUCTURA).
const strip = (line) => line
  .replace(/^\s*>\s?/, "")
  .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "")
  .replace(/^\s*[-*+]\s+/, "")
  .replace(/^\s*\d+[.)]\s+/, "")
  .replace(/[*_`]+/g, "")
  .trim();

const GHERKIN = { dado: /^dado\b/i, cuando: /^cuando\b/i, entonces: /^entonces\b/i };

// Parte el bloque de criterios en criterios individuales.
//
// Soporta las dos formas que se ven en la práctica:
//   a) etiquetadas   — `- [ ] **AC-1** —` seguida de las tres líneas Gherkin
//   b) sueltas       — una tanda de `- Dado … / - Cuando … / - Entonces …`
// En (b) cada `Dado` abre un criterio nuevo, que es como se leen naturalmente.
export function splitCriteria(block) {
  const lines = (block || "").split(/\r?\n/).map(strip).filter((l) => l !== "");
  const hasLabels = lines.some((l) => /^AC[-\s]?\d+\b/i.test(l));
  const out = [];
  let cur = null;
  const open = (label) => { cur = { label: label || null, lines: [] }; out.push(cur); };

  for (const l of lines) {
    const label = l.match(/^(AC[-\s]?\d+)\b\s*[—:\-]?\s*(.*)$/i);
    if (hasLabels && label) {
      open(label[1]);
      if (label[2]) cur.lines.push(label[2]);
      continue;
    }
    if (!hasLabels && GHERKIN.dado.test(l)) { open(null); }
    if (!cur) open(null);
    cur.lines.push(l);
  }
  return out.map((c, i) => {
    const text = c.lines.join(" ");
    return {
      label: c.label || `#${i + 1}`,
      text,
      dado: c.lines.some((l) => GHERKIN.dado.test(l)),
      cuando: c.lines.some((l) => GHERKIN.cuando.test(l)),
      entonces: c.lines.some((l) => GHERKIN.entonces.test(l)),
    };
  });
}

export const isGherkin = (c) => c.dado && c.cuando && c.entonces;

// Palabras que delatan que el criterio se metió en el CÓMO. El QUÉ es funcional: si un
// criterio habla de endpoints o de tablas, el PO está diseñando la solución y ya no
// describe el comportamiento observable (Art. 1). Es un aviso, no un bloqueo: a veces
// el dominio realmente usa esas palabras.
const TECNICAS = /\b(endpoint|API REST|base de datos|tabla SQL|migraci[oó]n|componente React|microservicio|query|schema|foreign key|índice|index)\b/i;

// ¿Esta US está lista para viajar al tracker?
//   → { ok, errors, warnings, criteria, title, acHashable }
// `ok` es false SOLO si hay errors. Los warnings se muestran y se siguen (salvo --strict).
export function validateUS(md) {
  const errors = [], warnings = [];
  const title = extractTitle(md);
  if (!title) errors.push("falta el título: la US tiene que empezar con un '# Título'.");
  else if (title.split(/\s+/).length > 10) {
    warnings.push(`el título tiene ${title.split(/\s+/).length} palabras — el molde pide 3 a 6 (de ahí sale el nombre de la branch).`);
  }

  const block = extractAcBlock(md);
  if (block == null) {
    errors.push("falta la sección '## Criterios de aceptación'. Sin criterios no hay ac_hash, y sin ac_hash no hay link QUÉ↔CÓMO.");
    return { ok: false, errors, warnings, criteria: [], title, acHashable: false };
  }

  const criteria = splitCriteria(block);
  if (criteria.length === 0) {
    errors.push("la sección 'Criterios de aceptación' está vacía.");
    return { ok: false, errors, warnings, criteria, title, acHashable: false };
  }

  for (const c of criteria) {
    if (!isGherkin(c)) {
      const falta = [!c.dado && "Dado", !c.cuando && "Cuando", !c.entonces && "Entonces"].filter(Boolean).join(" / ");
      warnings.push(`${c.label}: no es Gherkin completo — falta ${falta}. Un criterio sin las tres partes es difícil de volver un test.`);
    }
    if (TECNICAS.test(c.text)) {
      warnings.push(`${c.label}: menciona implementación (${c.text.match(TECNICAS)[0]}). El QUÉ describe comportamiento observable; el CÓMO lo decide el dev.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings, criteria, title, acHashable: true };
}

// ── spec_version ─────────────────────────────────────────────────────────────
// El número que COMUNICA el cambio del QUÉ; el ac_hash es el que lo DETECTA
// (METODOLOGIA §4). Sube cuando el cambio es material, y eso lo sabe el PO: dai
// mirando el hash no puede distinguir un criterio nuevo de un typo corregido.

export const parseSpecVersion = (md) => {
  const m = String(md || "").match(/spec[_ ]version[^\n]*?\b(v\d+)\b/i);
  return m ? m[1] : null;
};

export const bumpSpecVersion = (v) => {
  const n = Number(String(v || "v1").replace(/^v/i, "")) || 1;
  return `v${n + 1}`;
};

// Reescribe el spec_version en el markdown. Si la US no declara ninguno (típico de una
// traída de un tracker que nunca usó el molde), lo INSERTA justo debajo del título — no
// al final, donde nadie lo ve, ni en una tabla que no existe.
export function setSpecVersion(md, version) {
  const text = String(md || "");
  if (/spec[_ ]version[^\n]*?\bv\d+\b/i.test(text)) {
    return text.replace(/(spec[_ ]version[^\n]*?\b)v\d+\b/i, `$1${version}`);
  }
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => /^#\s+\S/.test(l));
  const stamp = `> **spec_version:** ${version}`;
  if (i === -1) return `${stamp}\n\n${text}`;
  lines.splice(i + 1, 0, "", stamp);
  return lines.join("\n");
}

// Render de los hallazgos para la terminal. Devuelve las líneas ya formateadas.
export function renderValidation({ errors, warnings, criteria }) {
  const out = [];
  for (const e of errors) out.push(`  ✗ ${e}`);
  for (const w of warnings) out.push(`  ⚠ ${w}`);
  if (errors.length === 0) {
    const g = criteria.filter(isGherkin).length;
    out.push(`  ✓ formato válido — ${criteria.length} criterio(s)${criteria.length ? `, ${g} en Gherkin completo` : ""}`);
  }
  return out;
}
