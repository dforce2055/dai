// dai · adaptador de PM (decisión abierta #3). Un contrato, varios backends.
//
// El adaptador tiene DOS caras (ADR-0002/0003): las skills publican la US por el
// MCP del asistente; el CLI (esto) lee/escribe por su cuenta. Backends CLI:
//   md      — local, offline (cero deps)
//   jira    — REST v2 (pm-jira.mjs)
//   clickup — REST v2 (pm-clickup.mjs)
//
// Interfaz (fetchUS/stamp pueden ser sync o async — el CLI siempre await-ea):
//   fetchUS(id)          → { id, title, spec_version, ac_hash, url } | null
//   stamp(id, record)    → destino donde quedó la cobertura
//   kind                 → nombre del backend
//
// `url` es la URL web canónica de la US según el tracker (opcional: null si el backend
// no la sabe, como md). El CLI la prefiere sobre la derivada — ver tracker-url.mjs.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parseUS, renderCoverage } from "./us.mjs";
import { slugify } from "./link-us.mjs";
import { jiraAdapter } from "./pm-jira.mjs";
import { clickupAdapter } from "./pm-clickup.mjs";

// Re-export para compatibilidad (tests y CLI importan estos desde acá).
export { parseUS, coverageStatus, statusLabel, renderCoverage } from "./us.mjs";

// ── backend md (local, offline) ───────────────────────────────────────────────
function mdAdapter(env) {
  const dir = env.DAI_MD_US_DIR || ".dai/us";
  return {
    kind: "md",
    fetchUS(id) {
      const p = join(dir, `${id}.md`);
      if (!existsSync(p)) return null;
      return { id, ...parseUS(readFileSync(p, "utf8")) };
    },
    stamp(id, record) {
      const p = join(dir, `${id}.coverage.md`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, renderCoverage(id, record));
      return p;
    },
    createUS({ title, descriptionMarkdown }) {
      const id = slugify(title);            // sin tracker, el "key" es el slug del título
      const p = join(dir, `${id}.md`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(p, descriptionMarkdown.startsWith("# ") ? descriptionMarkdown : `# ${title}\n\n${descriptionMarkdown}`);
      return { id, url: p };
    },
  };
}

export function getAdapter(env = process.env) {
  const kind = (env.DAI_PM || "md").toLowerCase();
  switch (kind) {
    case "md": return mdAdapter(env);
    case "jira": return jiraAdapter(env);
    case "clickup": return clickupAdapter(env);
    default:
      throw new Error(`DAI_PM desconocido: '${kind}'. Valores: md | jira | clickup.`);
  }
}
