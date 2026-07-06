// dai · cálculo del ac_hash — contrato en docs/adr/0001-contrato-ac-hash.md
//
// El ac_hash es lo que hace que un cambio del QUÉ marque solo a los CÓMO
// atrasados (Art. 11). DEBE calcularse idéntico acá y en el CI.
//
// Algoritmo (ADR-0001):
//   1. Extraer el bloque "Criterios de aceptación" de la US.
//   2. Normalizar: quitar marcado editorial (checkboxes, viñetas, énfasis,
//      numeración AC-N, headings) y colapsar todo el whitespace.
//   3. SHA-256 del texto normalizado, truncado a 8 hex.
//
// El ORDEN de los criterios es significativo: reordenar cambia el hash
// (por eso el formato de US pide orden estable). No se ordena acá.

import { createHash } from "node:crypto";

// Encuentra el heading de criterios de aceptación y devuelve el texto hasta
// el próximo heading de igual o menor nivel. Tolera el emoji 🔗 y variantes.
export function extractAcBlock(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headingRe = /^(#{1,6})\s+(.*)$/;
  const isAcHeading = (t) =>
    /criterios\s+de\s+aceptaci[oó]n/i.test(t.replace(/[🔗*_`#]/g, "").trim());

  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m && isAcHeading(m[2])) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return null; // sin bloque de criterios

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

// Normaliza el bloque a texto canónico según el contrato.
export function normalizeAcBlock(block) {
  return block
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*>\s?/, "")            // blockquotes
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "") // checkbox list items
        .replace(/^\s*[-*+]\s+/, "")        // viñetas
        .replace(/^\s*\d+[.)]\s+/, "")      // numeración de lista
        .replace(/[*_`]+/g, "")             // énfasis / código inline (antes de AC-N)
        .replace(/\bAC[-\s]?\d+\b\s*[—:\-]?\s*/gi, "") // etiquetas AC-N + separador
        .replace(/^#{1,6}\s+/, "")          // headings sueltos
    )
    .join(" ")
    .replace(/\s+/g, " ")                   // colapsar todo el whitespace
    .trim();
}

// Devuelve el ac_hash (8 hex) de una US en markdown, o null si no hay criterios.
export function acHash(markdown) {
  const block = extractAcBlock(markdown);
  if (block == null) return null;
  const normalized = normalizeAcBlock(block);
  if (normalized === "") return null;
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 8);
}
