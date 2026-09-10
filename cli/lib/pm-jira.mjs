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
  if (!key) throw new Error("falta DAI_JIRA_PROJECT en el .env.dai (la clave del proyecto donde crear el issue).");
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

// Una celda puede tener varios párrafos, y una fila de markdown no sobrevive un salto de
// línea en el medio: se aplana a UNA línea y se escapan los `|` que traiga el texto.
const inlineCell = (cell) => adfToMarkdown(cell).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
const mdRow = (cells) => `| ${cells.join(" | ")} |`;

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
    // Jira Cloud tiene tablas de verdad, y el molde de US pone la metadata —`spec_version`
    // incluido— en una. Sin estos casos caían al `default`, que aplana cada celda a su
    // propia línea: `spec_version` quedaba en una y `v1` en la siguiente, y SPEC_VERSION_RE
    // —que no cruza saltos de línea a propósito— no encontraba nada. La US declaraba `v1`
    // en el tracker y dai estampaba `version: pendiente` sin que nada explicara por qué.
    case "table": {
      const rows = (node.content || []).filter((r) => r?.type === "tableRow");
      if (rows.length === 0) return "";
      const out = rows.map((r) => mdRow((r.content || []).map(inlineCell)));
      // El separador va solo si la primera fila es de encabezados: es lo que hace que esto
      // se RENDERICE como tabla donde el markdown importa (el cuerpo de una PR, el .md que
      // baja `dai edit-us`). Para el parseo no cambia nada.
      const head = rows[0].content || [];
      if (head.length && head.every((c) => c?.type === "tableHeader")) {
        out.splice(1, 0, mdRow(head.map(() => "---")));
      }
      return out.join("\n") + "\n";
    }
    case "tableRow":    return mdRow((node.content || []).map(inlineCell)) + "\n";
    case "text":        return node.text || "";
    case "hardBreak":   return "\n";
    default:            return (node.content || []).map(adfToMarkdown).join("");
  }
}

// ── markdown → ADF (para CREAR el issue: la descripción va en ADF) ────────────
// Parser de bloques: headings, párrafos, bullets y tablas. Suficiente para el formato de US.

// Una fila de markdown: `| a | b |`. El separador (`|---|---|`) marca que la fila de
// arriba era el encabezado; no es una fila de datos.
const MD_ROW_RE = /^\s*\|.*\|\s*$/;
const MD_SEP_RE = /^\s*\|[\s:|-]+\|\s*$/;
const splitCells = (line) =>
  line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|"));

export function markdownToAdf(md) {
  // El `_` se saca solo cuando hace de énfasis (_así_), no cuando vive DENTRO de una
  // palabra: sacarlo siempre publicaba la fila del molde como `specversion`, un nombre de
  // campo que nadie escribió y que del otro lado hubo que aprender a leer (issue #46).
  const clean = (s) => s.replace(/[*`]+/g, "").replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, "").trim();
  const content = [];
  let para = [], bullets = null, rows = null;
  const flushPara = () => { if (para.length) { const t = clean(para.join(" ")); if (t) content.push({ type: "paragraph", content: [{ type: "text", text: t }] }); para = []; } };
  const flushBullets = () => { if (bullets) { if (bullets.length) content.push({ type: "bulletList", content: bullets }); bullets = null; } };
  // La metadata de trazabilidad del molde de US es una TABLA, y el comentario de cobertura
  // también. Sin este caso viajaban a Jira como párrafos con pipes adentro: ilegibles, y
  // encima invitaban a rehacerlos como tabla de Jira a mano — que es justo lo que del otro
  // lado dai no sabía leer.
  const flushTable = () => {
    if (!rows) return;
    const data = rows.filter((r) => !r.sep);
    if (data.length) {
      const headed = rows.length > 1 && rows[1].sep;
      const cell = (raw, header) => {
        const text = clean(raw);
        return {
          type: header ? "tableHeader" : "tableCell",
          attrs: {},
          content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
        };
      };
      content.push({
        type: "table",
        attrs: { isNumberColumnEnabled: false, layout: "default" },
        content: data.map((r, i) => ({ type: "tableRow", content: r.cells.map((c) => cell(c, headed && i === 0)) })),
      });
    }
    rows = null;
  };
  for (const raw of String(md || "").split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const b = line.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (h) { flushPara(); flushBullets(); flushTable(); const t = clean(h[2]); if (t) content.push({ type: "heading", attrs: { level: h[1].length }, content: [{ type: "text", text: t }] }); }
    // Una fila se reconoce por abrir Y cerrar con `|`; el separador entra acá también,
    // marcado, porque es lo único que distingue un encabezado de una fila más.
    else if (MD_ROW_RE.test(line)) { flushPara(); flushBullets(); if (!rows) rows = []; rows.push({ sep: MD_SEP_RE.test(line), cells: splitCells(line) }); }
    else if (b) { flushPara(); flushTable(); if (!bullets) bullets = []; const t = clean(b[1]); if (t) bullets.push({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] }); }
    else if (line.trim() === "") { flushPara(); flushBullets(); flushTable(); }
    else { flushBullets(); flushTable(); para.push(line.trim()); }
  }
  flushPara(); flushBullets(); flushTable();
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

// Un 400 al crear puede ser (a) un campo propio obligatorio que no mandamos, (b) una regla
// del proyecto —p. ej. exigir una épica padre— o (c) otra cosa. Jira dice cuál en el cuerpo,
// pero no dice qué hacer: elegimos la ayuda según lo que dice el error, no una fija. Antes
// mandábamos SIEMPRE a declarar un campo, aunque el 400 fuera "falta la épica" (confuso).
export function createHint(status, body = "") {
  if (status !== 400) return "";
  const b = String(body);
  // Regla de workflow: la historia tiene que colgar de una épica (no es un campo propio).
  if (/[ée]pica|epic|parent/i.test(b)) {
    return "\n\n  Tu proyecto pide que esta historia cuelgue de una épica. Pasá la key de la\n" +
           "  épica padre con --parent (es la épica, no el proyecto):\n" +
           "    dai publish <us.md> --parent PROJ-123 --field clasificacion=<valor>";
  }
  // Campo propio obligatorio que no mandamos (el customfield_NNNNN del error).
  if (/customfield_/i.test(b)) {
    return "\n\n  Tu proyecto exige un campo propio (el 'customfield_NNNNN' del error).\n" +
           "  Declaralo en .dai/jira-fields.json y volvé a publicar — no hace falta improvisar\n" +
           "  una llamada a mano:\n" +
           '    { "Story": { "clasificacion": { "field": "customfield_NNNNN",\n' +
           '                                    "options": ["Mejora", "Corrección"] } } }\n' +
           "    dai publish <us.md> --field clasificacion=Corrección";
  }
  // 400 genérico: no adivinamos. Nombramos las dos causas típicas sin empujar una.
  return "\n\n  Jira rechazó la creación (400) — el mensaje de arriba dice por qué. Las dos causas\n" +
         "  típicas: un campo propio obligatorio (declaralo en .dai/jira-fields.json) o una regla\n" +
         "  del proyecto como exigir una épica padre (--parent PROJ-123).";
}

export function jiraAdapter(env) {
  const base = env.DAI_JIRA_BASE_URL;
  if (!base) throw new Error("falta DAI_JIRA_BASE_URL en el .env.dai (backend jira).");
  return {
    kind: "jira",
    endpoint: trim(base),
    async fetchUS(id) {
      const res = await daiFetch(jiraIssueUrl(base, id), { headers: jiraAuthHeaders(env) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      const raw = jiraIssueToText(await res.json());
      return { id, ...parseUS(raw), url: `${trim(base)}/browse/${id}`, raw };
    },
    // Comentario libre en markdown (lo usa `dai release stamp`). Jira Cloud pide ADF, así
    // que se convierte con el mismo parser que ya usa la descripción de la US.
    async comment(id, markdown) {
      const res = await daiFetch(jiraCommentUrl(base, id), {
        method: "POST", headers: jiraAuthHeaders(env),
        body: JSON.stringify({ body: markdownToAdf(markdown) }),
      });
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return `${trim(base)}/browse/${id}`;
    },
    // Los comentarios como texto plano, para que dai reconozca los suyos por la marca y no
    // vuelva a estampar lo mismo. Los más nuevos primero: la marca que buscamos, si está,
    // es reciente. 100 alcanza de sobra y evita paginar un ticket con años de historia.
    async listComments(id) {
      const res = await daiFetch(`${jiraCommentUrl(base, id)}?maxResults=100&orderBy=-created`, { headers: jiraAuthHeaders(env) });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      const j = await res.json();
      return (j.comments || []).map((c) => (typeof c.body === "string" ? c.body : adfToMarkdown(c.body)));
    },
    async stamp(id, record) {
      const res = await daiFetch(jiraCommentUrl(base, id), {
        method: "POST", headers: jiraAuthHeaders(env),
        body: JSON.stringify({ body: renderCoverageAdf(id, record) }),
      });
      if (!res.ok) throw new Error(`jira ${res.status}: ${await res.text()}`);
      return `${trim(base)}/browse/${id}`;
    },
    // PUT /issue/<id>: Jira responde 204 SIN cuerpo, así que la URL la componemos
    // nosotros. Solo se mandan los campos que cambian — un PUT con summary vacío
    // borraría el título de la US.
    async updateUS(id, { title, descriptionMarkdown, fields }) {
      const payload = { ...(fields || {}) };
      if (title) payload.summary = title;
      if (descriptionMarkdown != null) payload.description = markdownToAdf(descriptionMarkdown);
      if (Object.keys(payload).length === 0) throw new Error("nada que actualizar (ni título, ni descripción, ni campos).");
      const res = await daiFetch(`${trim(base)}/rest/api/3/issue/${encodeURIComponent(id)}`, {
        method: "PUT", headers: jiraAuthHeaders(env), body: JSON.stringify({ fields: payload }),
      });
      if (res.status === 404) throw new Error(`jira: no existe el issue '${id}' (404), o tu usuario no lo ve.`);
      if (res.status === 403) throw new Error(`jira: sin permiso para editar '${id}' (403). ¿Tu usuario puede editar issues en ese proyecto?`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`jira ${res.status}: ${body}${createHint(res.status, body)}`);
      }
      return { id, url: `${trim(base)}/browse/${id}` };
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
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`jira ${res.status}: ${body}${createHint(res.status, body)}`);
      }
      const j = await res.json();
      return { id: j.key, url: `${trim(base)}/browse/${j.key}` };
    },
  };
}
