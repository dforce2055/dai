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
//
// `sin-us` y `sin-respuesta` NO son lo mismo, y confundirlos es caro: el primero es una
// RESPUESTA del tracker (preguntamos y la US no está), el segundo es la AUSENCIA de
// respuesta (sin red, sin token, 5xx, certificado corporativo). Colapsados en un mismo
// `null`, dai terminaba AFIRMANDO que no había US cuando lo único cierto era que no había
// podido preguntar — y eso se publicaba en el cuerpo de una PR, al lado del id de la US.
export function coverageStatus(stampedHash, liveHash, { unreachable = false } = {}) {
  if (unreachable) return "sin-respuesta";
  if (liveHash == null) return "sin-us";
  return stampedHash === liveHash ? "al-dia" : "atrasado";
}

const STATUS_LABEL = {
  "al-dia": "✅ al día", atrasado: "⚠️ atrasado",
  "sin-us": "❓ sin US", "sin-respuesta": "⚠️ no verificado",
};
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

// `fetch failed` es TODO lo que dice undici cuando no hay red, el host no resuelve, el DNS
// se cayó o el certificado no valida. Sin contexto es indistinguible de un bug de dai: el
// dev lee "dai: fetch failed" y no sabe ni qué se estaba consultando. Es el mismo modo de
// falla que el push por SSH de la 0.13.1 — el dato que resuelve el problema existe, y no
// llega. Acá se le pone alrededor qué, contra qué, y qué mirar.
export function explainFetchError(err, { kind, endpoint, id } = {}) {
  const raw = String(err?.message ?? err ?? "").split("\n")[0] || "error desconocido";
  const donde = [kind, endpoint].filter(Boolean).join(" · ");
  const cabeza = `no pude consultar ${id ? `la US ${id}` : "el tracker"}${donde ? ` en ${donde}` : ""}: ${raw}`;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|ECONNRESET|certificate|self.signed/i.test(raw)) {
    return `${cabeza}\n  No llegó a haber respuesta. Revisá la red y el host del backend; si estás detrás de un\n` +
           `  proxy corporativo, declará la CA con NODE_EXTRA_CA_CERTS (nunca NODE_TLS_REJECT_UNAUTHORIZED=0).\n` +
           `  Diagnóstico:  dai doctor`;
  }
  if (/\b40[13]\b|unauthorized|forbidden/i.test(raw)) {
    return `${cabeza}\n  El tracker rechazó las credenciales: revisá el token del .env.dai (¿venció?) y sus permisos.\n` +
           `  Diagnóstico:  dai doctor`;
  }
  if (/\b5\d\d\b/.test(raw)) return `${cabeza}\n  El error es del tracker, no tuyo: probá de nuevo en un rato.`;
  return cabeza;
}
