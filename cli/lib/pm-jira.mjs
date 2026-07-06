// dai · backend Jira del adaptador de PM (REST v3 / Jira Cloud, cara CLI).
// Auth: Basic (email + api_token) — token scopeado, no contraseña (ADR-0007).
// Config: DAI_JIRA_BASE_URL, DAI_JIRA_EMAIL, DAI_JIRA_TOKEN.
//
// Jira Cloud usa ADF (Atlassian Document Format, JSON) para descripción y comentarios,
// no markdown ni string. Así que: al LEER convertimos ADF → markdown (para que el
// hasher encuentre "## Criterios de aceptación"); al ESCRIBIR el stamp, componemos ADF.

import { parseUS } from "./us.mjs";

const trim = (b) => String(b || "").replace(/\/+$/, "");

export function jiraIssueUrl(base, id) {
  return `${trim(base)}/rest/api/3/issue/${encodeURIComponent(id)}?fields=summary,description`;
}
export function jiraCommentUrl(base, id) {
  return `${trim(base)}/rest/api/3/issue/${encodeURIComponent(id)}/comment`;
}
export function jiraAuthHeaders(env) {
  const cred = Buffer.from(`${env.DAI_JIRA_EMAIL || ""}:${env.DAI_JIRA_TOKEN || ""}`).toString("base64");
  return { Authorization: `Basic ${cred}`, Accept: "application/json", "Content-Type": "application/json" };
}

// ── ADF → markdown (para leer la descripción) ────────────────────────────────
export function adfToMarkdown(node) {
  if (node == null) return "";
  if (Array.isArray(node)) return node.map(adfToMarkdown).join("");
  switch (node.type) {
    case "doc":         return (node.content || []).map(adfToMarkdown).join("\n");
    case "heading":     return "#".repeat(node.attrs?.level || 1) + " " + (node.content || []).map(adfToMarkdown).join("") + "\n";
    case "paragraph":   return (node.content || []).map(adfToMarkdown).join("").trim() + "\n";
    case "bulletList":
    case "orderedList": return (node.content || []).map(adfToMarkdown).join("");
    case "listItem":    return "- " + (node.content || []).map(adfToMarkdown).join("").trim() + "\n";
    case "text":        return node.text || "";
    case "hardBreak":   return "\n";
    default:            return (node.content || []).map(adfToMarkdown).join("");
  }
}

// Arma el texto de la US: summary (campo) + descripción (ADF→md o string).
export function jiraIssueToText(json) {
  const f = json.fields || {};
  const desc = typeof f.description === "string" ? f.description
    : f.description ? adfToMarkdown(f.description) : "";
  return `# ${f.summary || json.key || ""}\n\n${desc}`;
}

// ── cobertura → ADF (para escribir el comentario del stamp) ───────────────────
const STATUS = { "al-dia": "✅ al día", atrasado: "⚠️ atrasado", "sin-us": "❓ sin US" };
const txt = (s) => ({ type: "text", text: String(s) });
const link = (s, href) => ({ type: "text", text: String(s), marks: [{ type: "link", attrs: { href } }] });

export function renderCoverageAdf(id, r) {
  const content = [
    { type: "heading", attrs: { level: 4 }, content: [txt(`Cobertura de ${id} — generado por dai stamp`)] },
    { type: "paragraph", content: [txt(`${r.repo} / ${r.change} @ ${r.version} (${r.ac_hash}) — ${STATUS[r.status] || r.status}`)] },
  ];
  const items = [];
  if (r.branchUrl) items.push({ type: "listItem", content: [{ type: "paragraph", content: [txt("branch: "), link(r.branch, r.branchUrl)] }] });
  if (r.commitUrl) items.push({ type: "listItem", content: [{ type: "paragraph", content: [txt("commit: "), link((r.commit || "").slice(0, 8), r.commitUrl), txt(" (ancla durable)")] }] });
  if (items.length) content.push({ type: "bulletList", content: items });
  return { type: "doc", version: 1, content };
}

export function jiraAdapter(env) {
  const base = env.DAI_JIRA_BASE_URL;
  if (!base) throw new Error("falta DAI_JIRA_BASE_URL en el .env (backend jira).");
  return {
    kind: "jira",
    async fetchUS(id) {
      const res = await fetch(jiraIssueUrl(base, id), { headers: jiraAuthHeaders(env) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return { id, ...parseUS(jiraIssueToText(await res.json())) };
    },
    async stamp(id, record) {
      const res = await fetch(jiraCommentUrl(base, id), {
        method: "POST", headers: jiraAuthHeaders(env),
        body: JSON.stringify({ body: renderCoverageAdf(id, record) }),
      });
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return `${trim(base)}/browse/${id}`;
    },
  };
}
