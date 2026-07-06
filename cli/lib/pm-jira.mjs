// dai · backend Jira del adaptador de PM (REST v2, cara CLI).
// Auth: Basic (email + api_token) — token scopeado, no contraseña (ADR-0007).
// Config: DAI_JIRA_BASE_URL, DAI_JIRA_EMAIL, DAI_JIRA_TOKEN.

import { parseUS, renderCoverage } from "./us.mjs";

const trim = (b) => String(b || "").replace(/\/+$/, "");

export function jiraIssueUrl(base, id) {
  return `${trim(base)}/rest/api/2/issue/${encodeURIComponent(id)}?fields=summary,description`;
}
export function jiraCommentUrl(base, id) {
  return `${trim(base)}/rest/api/2/issue/${encodeURIComponent(id)}/comment`;
}
export function jiraAuthHeaders(env) {
  const cred = Buffer.from(`${env.DAI_JIRA_EMAIL || ""}:${env.DAI_JIRA_TOKEN || ""}`).toString("base64");
  return { Authorization: `Basic ${cred}`, Accept: "application/json", "Content-Type": "application/json" };
}
// Arma el texto de la US desde la respuesta de Jira (summary + description).
export function jiraIssueToText(json) {
  const f = json.fields || {};
  const desc = typeof f.description === "string" ? f.description : "";
  return `# ${f.summary || json.key || ""}\n\n${desc}`;
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
        body: JSON.stringify({ body: renderCoverage(id, record) }),
      });
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return `${trim(base)}/browse/${id}`;
    },
  };
}
