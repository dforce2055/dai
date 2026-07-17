// dai · backend ClickUp del adaptador de PM (REST v2, cara CLI).
// Auth: token personal en el header Authorization (ADR-0007).
// Config: DAI_CLICKUP_TOKEN.

import { parseUS, renderCoverage } from "./us.mjs";

const API = "https://api.clickup.com/api/v2";

// include_markdown_description=true → la API devuelve el markdown real (con los
// headings), necesario para encontrar el bloque "Criterios de aceptación".
export function clickupTaskUrl(id) {
  return `${API}/task/${encodeURIComponent(id)}?include_markdown_description=true`;
}
export function clickupCommentUrl(id) { return `${API}/task/${encodeURIComponent(id)}/comment`; }
export function clickupAuthHeaders(env) {
  return { Authorization: env.DAI_CLICKUP_TOKEN || "", "Content-Type": "application/json" };
}
// Arma el texto de la US desde la respuesta de ClickUp (name + description).
export function clickupTaskToText(json) {
  const desc = json.markdown_description || json.description || json.text_content || "";
  return `# ${json.name || json.id || ""}\n\n${desc}`;
}

export function clickupAdapter(env) {
  if (!env.DAI_CLICKUP_TOKEN) throw new Error("falta DAI_CLICKUP_TOKEN en el .env (backend clickup).");
  return {
    kind: "clickup",
    async fetchUS(id) {
      const res = await fetch(clickupTaskUrl(id), { headers: clickupAuthHeaders(env) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`clickup ${res.status}: ${await res.text()}`);
      const j = await res.json();
      // `url` es la canónica (/t/<team_id>/<id>): la sabe ClickUp, no la deducimos.
      return { id, ...parseUS(clickupTaskToText(j)), url: j.url || null };
    },
    async stamp(id, record) {
      const res = await fetch(clickupCommentUrl(id), {
        method: "POST", headers: clickupAuthHeaders(env),
        body: JSON.stringify({ comment_text: renderCoverage(id, record) }),
      });
      if (!res.ok) throw new Error(`clickup ${res.status}: ${await res.text()}`);
      return `task ${id} (comentario)`;
    },
    async createUS({ title, descriptionMarkdown }) {
      const list = env.DAI_CLICKUP_LIST_ID;
      if (!list) throw new Error("falta DAI_CLICKUP_LIST_ID en el .env (la lista donde crear la tarea).");
      const res = await fetch(`${API}/list/${encodeURIComponent(list)}/task`, {
        method: "POST", headers: clickupAuthHeaders(env),
        body: JSON.stringify({ name: title, markdown_content: descriptionMarkdown }),
      });
      if (!res.ok) throw new Error(`clickup ${res.status}: ${await res.text()}`);
      const j = await res.json();
      return { id: j.id, url: j.url || null };
    },
  };
}
