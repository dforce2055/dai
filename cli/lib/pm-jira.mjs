// dai · backend Jira del adaptador de PM (REST v3 / Jira Cloud, cara CLI).
// Auth: Basic (email + api_token) — token scopeado, no contraseña (ADR-0007).
// Config: DAI_JIRA_BASE_URL, DAI_JIRA_EMAIL, DAI_JIRA_TOKEN.
//
// Jira Cloud usa ADF (Atlassian Document Format, JSON) para descripción y comentarios,
// no markdown ni string. Así que: al LEER convertimos ADF → markdown (para que el
// hasher encuentre "## Criterios de aceptación"); al ESCRIBIR el stamp, componemos ADF.

import { parseUS } from "./us.mjs";
import { daiFetch } from "./http.mjs";

const trim = (b) => String(b || "").replace(/\/+$/, "");

// La clave del PROYECTO (PROJ), no la de un ticket (PROJ-42). Confundirlas es el
// error de config más común: `dai init` deja DAI_JIRA_PROJECT vacío y quien lo completa
// suele pegar la épica que tiene a mano. Jira responde un 400 que no lo explica.
export function assertProjectKey(key) {
  if (!key) throw new Error("falta DAI_JIRA_PROJECT en el .env (la clave del proyecto donde crear el issue).");
  const k = String(key).trim();
  const m = k.match(/^([A-Za-z][A-Za-z0-9_]*)-\d+$/);
  if (m) {
    throw new Error(
      `DAI_JIRA_PROJECT='${k}' es la clave de un ticket, no la del proyecto.\n` +
      `  Usá solo la parte de adelante:  DAI_JIRA_PROJECT=${m[1]}\n` +
      `  Si lo que querías era colgar la US de esa épica:  dai publish <us.md> --parent ${k}`,
    );
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(k)) {
    throw new Error(`DAI_JIRA_PROJECT='${k}' no parece una clave de proyecto (letras y números, empezando por letra — p. ej. PROJ).`);
  }
  return k;
}

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

// ── markdown → ADF (para CREAR el issue: la descripción va en ADF) ────────────
// Parser de bloques: headings, párrafos y bullets. Suficiente para el formato de US.
export function markdownToAdf(md) {
  const clean = (s) => s.replace(/[*_`]+/g, "").trim();
  const content = [];
  let para = [], bullets = null;
  const flushPara = () => { if (para.length) { const t = clean(para.join(" ")); if (t) content.push({ type: "paragraph", content: [{ type: "text", text: t }] }); para = []; } };
  const flushBullets = () => { if (bullets) { if (bullets.length) content.push({ type: "bulletList", content: bullets }); bullets = null; } };
  for (const raw of String(md || "").split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const b = line.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (h) { flushPara(); flushBullets(); const t = clean(h[2]); if (t) content.push({ type: "heading", attrs: { level: h[1].length }, content: [{ type: "text", text: t }] }); }
    else if (b) { flushPara(); if (!bullets) bullets = []; const t = clean(b[1]); if (t) bullets.push({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] }); }
    else if (line.trim() === "") { flushPara(); flushBullets(); }
    else { flushBullets(); para.push(line.trim()); }
  }
  flushPara(); flushBullets();
  if (content.length === 0) content.push({ type: "paragraph", content: [{ type: "text", text: " " }] });
  return { type: "doc", version: 1, content };
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

// Un 400 al crear casi siempre es un campo obligatorio del proyecto que no mandamos.
// El cuerpo de Jira nombra el customfield_NNNNN pero no dice qué hacer: lo decimos acá.
function createHint(status) {
  if (status !== 400) return "";
  return "\n\n  Si el error nombra un 'customfield_NNNNN', tu proyecto exige un campo propio.\n" +
         "  Declaralo en .dai/jira-fields.json y volvé a publicar — no hace falta improvisar\n" +
         "  una llamada a mano:\n" +
         '    { "Story": { "clasificacion": { "field": "customfield_NNNNN",\n' +
         '                                    "options": ["Mejora", "Corrección"] } } }\n' +
         "    dai publish <us.md> --field clasificacion=Corrección";
}

export function jiraAdapter(env) {
  const base = env.DAI_JIRA_BASE_URL;
  if (!base) throw new Error("falta DAI_JIRA_BASE_URL en el .env (backend jira).");
  return {
    kind: "jira",
    async fetchUS(id) {
      const res = await daiFetch(jiraIssueUrl(base, id), { headers: jiraAuthHeaders(env) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return { id, ...parseUS(jiraIssueToText(await res.json())) };
    },
    async stamp(id, record) {
      const res = await daiFetch(jiraCommentUrl(base, id), {
        method: "POST", headers: jiraAuthHeaders(env),
        body: JSON.stringify({ body: renderCoverageAdf(id, record) }),
      });
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return `${trim(base)}/browse/${id}`;
    },
    // `fields` son los campos propios del proyecto ya resueltos (ver jira-fields.mjs);
    // `parent` cuelga la US de su épica. Ambos son opcionales: un Jira sin campos
    // obligatorios sigue publicando igual que antes.
    async createUS({ title, descriptionMarkdown, parent, issuetype, project, fields }) {
      const key = assertProjectKey(project || env.DAI_JIRA_PROJECT);
      const type = issuetype || env.DAI_JIRA_ISSUETYPE || "Story";
      const payload = {
        project: { key },
        issuetype: { name: type },
        summary: title,
        description: markdownToAdf(descriptionMarkdown),
        ...(fields || {}),
      };
      if (parent) payload.parent = { key: String(parent).trim() };
      const res = await daiFetch(`${trim(base)}/rest/api/3/issue`, {
        method: "POST", headers: jiraAuthHeaders(env),
        body: JSON.stringify({ fields: payload }),
      });
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}${createHint(res.status)}`);
      const j = await res.json();
      return { id: j.key, url: `${trim(base)}/browse/${j.key}` };
    },
  };
}
