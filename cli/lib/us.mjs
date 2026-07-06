// dai · primitivos de US y cobertura, compartidos por todos los backends de PM.
// Vive aparte de pm-adapter.mjs para que jira/clickup lo importen sin ciclos.

import { acHash } from "./ac-hash.mjs";
import { extractTitle } from "./link-us.mjs";

// Parseo puro de una US (markdown o texto) → identidad + hash vivo.
export function parseUS(raw) {
  const title = extractTitle(raw);
  const m = raw.match(/spec[_ ]version[^\n]*?\b(v\d+)\b/i);
  return { title, spec_version: m ? m[1] : null, ac_hash: acHash(raw) };
}

// Compara el hash estampado (implements.yaml) con el hash vivo de la US.
export function coverageStatus(stampedHash, liveHash) {
  if (liveHash == null) return "sin-us";
  return stampedHash === liveHash ? "al-dia" : "atrasado";
}

const STATUS_LABEL = { "al-dia": "✅ al día", atrasado: "⚠️ atrasado", "sin-us": "❓ sin US" };
export const statusLabel = (s) => STATUS_LABEL[s] || s;

// Render de la cobertura como markdown (lo que un backend "estampa").
export function renderCoverage(id, r) {
  const lines = [
    `# Cobertura de ${id}  ·  generado por dai stamp`,
    "",
    "| repo | change | versión | ac_hash | estado |",
    "|------|--------|---------|---------|--------|",
    `| ${r.repo} | ${r.change} | ${r.version} | ${r.ac_hash} | ${statusLabel(r.status)} |`,
    "",
  ];
  if (r.branchUrl) lines.push(`- branch: ${r.branch} → ${r.branchUrl}`);
  if (r.commitUrl) lines.push(`- commit: ${r.commit} → ${r.commitUrl}  (ancla durable)`);
  return lines.join("\n") + "\n";
}
