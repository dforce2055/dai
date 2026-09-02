// dai · componer el cuerpo de una Pull/Merge Request desde el template (ADR-0005).
// Parte pura y testeable: rellena el template con los datos del link + git + check.
// Los efectos (git push, gh/glab create) viven en dai.mjs.

const EMOJI = { "al-dia": "✅ al día", atrasado: "⚠️ atrasado", "sin-us": "❓ sin US" };

// Las secciones que dai se compromete a entregar llenas. Si alguna sale con el molde
// del template, la PR se publica vacía y el review no tiene qué mirar (era el bug:
// "Descripción" con el comentario HTML y "Cambios realizados" con `Cambio 1/Cambio 2`).
// `dai pr` las verifica con bodyGaps() antes de publicar.
export const OWNED_SECTIONS = ["Descripción", "Cambios realizados"];

// ── Secciones ────────────────────────────────────────────────────────────────
// Normaliza un heading para compararlo: sin acentos, sin emoji ni puntuación, minúscula.
// Un repo puede traer su propio template ("## 📝 Descripción del cambio") y dai igual
// tiene que reconocer la sección: con el match exacto de antes no la encontraba y
// devolvía el body intacto EN SILENCIO, que es la forma más cara de fallar.
const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

// Ubica una sección markdown (## Heading … hasta el próximo heading de igual o menor
// nivel). Ignora lo que esté dentro de un bloque de código: un `## ` en un fence es
// texto, no estructura. Devuelve null si no está.
function findSection(lines, heading) {
  const want = norm(heading);
  let start = -1, level = 0, fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    const m = /^(#{2,6})[ \t]+(.+?)[ \t]*$/.exec(lines[i]);
    if (!m) continue;
    if (start === -1) { if (norm(m[2]).startsWith(want)) { start = i; level = m[1].length; } }
    else if (m[1].length <= level) return { start, end: i, level };
  }
  return start === -1 ? null : { start, end: lines.length, level };
}

// El cuerpo crudo de una sección, o null si la sección no existe.
export function sectionBody(body, heading) {
  const lines = body.split("\n");
  const at = findSection(lines, heading);
  return at ? lines.slice(at.start + 1, at.end).join("\n") : null;
}

// Reemplaza el cuerpo de una sección por content. Tolerante: si no encuentra la
// sección, devuelve el body igual (para eso está upsertSection).
export function replaceSection(body, heading, content) {
  const lines = body.split("\n");
  const at = findSection(lines, heading);
  if (!at) return body;
  return [...lines.slice(0, at.start + 1), "", content, "", ...lines.slice(at.end)].join("\n");
}

// Como replaceSection, pero si la sección no está la agrega al final con su heading.
// Misma disciplina que el bloque de enlaces: dai siempre entrega el dato, nunca lo
// pierde porque el template del repo no tenía dónde ponerlo. content null = no sé
// nada → no toco (y bodyGaps lo va a reportar; dai no inventa contenido).
export function upsertSection(body, heading, content) {
  if (content == null || !String(content).trim()) return body;
  if (findSection(body.split("\n"), heading)) return replaceSection(body, heading, content);
  return `${body.replace(/\s*$/, "")}\n\n## ${heading}\n\n${content}\n`;
}

// ── Detección del molde sin llenar ───────────────────────────────────────────
// Moldes conocidos del template: líneas que no dicen nada sobre ESTE cambio.
const MOCK_LINES = [/^-?\s*\[[ x]\]\s*cambio\s*\d+\s*$/i, /^cambio\s*\d+\s*$/i, /^-?\s*\[[ x]\]\s*$/];

// ¿El cuerpo de una sección es puro molde? Los comentarios HTML no cuentan como
// contenido: no se renderizan, así que en la PR publicada la sección se ve VACÍA
// (por eso el bug pasaba desapercibido hasta que alguien abría la PR).
export function isPlaceholder(text) {
  const lines = String(text ?? "").replace(/<!--[\s\S]*?-->/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return true;
  return lines.every((l) => MOCK_LINES.some((re) => re.test(l)));
}

// Qué le falta al body para ser revisable. Vacío = la PR se puede publicar.
// `dai pr` lo usa como gate: sin TTY (el camino del agente) falla en vez de publicar
// una PR que nadie puede revisar.
export function bodyGaps(body) {
  const gaps = OWNED_SECTIONS.filter((h) => {
    const s = sectionBody(body, h);
    return s === null || isPlaceholder(s);
  });
  // Placeholders de la cabecera: la PR saldría diciendo `ABC-###` (issues #31/#33).
  if (/ABC-###|`<hash>`|@ `vX`/.test(body)) gaps.push("🔗 Implementa");
  return gaps;
}

// ── Composición ──────────────────────────────────────────────────────────────
// Descripción: lo que escribió quien crea la PR (agente o dev) gana; si no, se deriva
// de la US. Si dai no sabe nada, devuelve null: no inventa el propósito de un cambio.
export function descriptionFor(d) {
  const explicit = String(d.description ?? "").trim();
  if (explicit) return explicit;
  if (d.usTitle) return `Implementa la US **${d.usTitle}** (\`${d.id}\`). Ver los criterios de aceptación en el tracker.`;
  return null;
}

// Cambios realizados: el detalle explícito gana; si no, los commits de la branch
// (como `gh pr create --fill`). Sin ninguno de los dos, null.
export function changesFor(d) {
  const explicit = String(d.changes ?? "").trim();
  if (explicit) return explicit;
  if (d.commits && d.commits.length) return d.commits.map((c) => `- [x] ${c}`).join("\n");
  return null;
}

// Rellena el template del PR con los datos precargados. Tolerante con el resto del
// template (checklists, secciones propias del repo): dai suma, no borra.
export function composePrBody(template, d) {
  let b = d.id ? fillUsHeader(template, d) : fillNoUsHeader(template, d);
  b = upsertSection(b, "Descripción", descriptionFor(d));
  b = upsertSection(b, "Cambios realizados", changesFor(d));
  return upsertLinksBlock(b, d);
}

function fillUsHeader(template, d) {
  let b = template;
  b = b.replace(/`ABC-###`/g, `\`${d.id}\``);
  b = b.replace(/@ `vX`/g, `@ \`${d.version}\``);
  b = b.replace(/`<hash>`/g, `\`${d.ac_hash}\``);
  return b.replace(/verificado con `dai check` ✅/g, `verificado con \`dai check\`: ${EMOJI[d.status] || d.status}`);
}

// PR de una branch exenta (chore/, docs/, release/…): no implementa una US y no se le
// exige link. Lo que NO puede pasar es que salga con la US de otro ni con el placeholder
// `ABC-###` del template — las dos cosas pasaron en repos reales (issues #31, #33).
// Se dice explícitamente que no hay US, y por qué.
function fillNoUsHeader(template, d) {
  return replaceSection(template, "🔗 Implementa",
    `- **Sin US:** esta PR no implementa una User Story.\n` +
    (d.noUsReason ? `- **Motivo:** ${d.noUsReason}.\n` : "") +
    `- No se le exige link (\`governance/branch-naming.md\`).`);
}

// ── Bloque de enlaces ────────────────────────────────────────────────────────
// Delimitado y regenerable a propósito. Con el comentario suelto de antes, cualquier
// agente que reescribiera "Enlaces relacionados" se lo llevaba puesto sin dejar rastro
// (pasó en PRs reales). Con marcadores, el bloque se detecta, se preserva y se
// regenera — y quien edite el body ve que es de dai y que se pisa solo.
export const LINKS_START = "<!-- dai:links:start · generado por `dai pr` — no editar a mano -->";
export const LINKS_END = "<!-- dai:links:end -->";

// Los links que dai sabe. Sin URL no inventa la línea: prefiere no decir nada.
export function renderLinks(d) {
  const links = [LINKS_START];
  if (d.usUrl) links.push(`- US \`${d.id}\`: ${d.usUrl}`);
  if (d.branchUrl) links.push(`- branch \`${d.branch}\`: ${d.branchUrl}`);
  if (d.commitUrl) links.push(`- commit \`${(d.commit || "").slice(0, 8)}\`: ${d.commitUrl}`);
  links.push(LINKS_END);
  return links.join("\n");
}

// Inserta o reemplaza el bloque de dai. Idempotente: correrlo N veces da lo mismo.
export function upsertLinksBlock(body, d) {
  const block = renderLinks(d);
  // 1. ¿Ya está el bloque delimitado? Se reemplaza entero (regenerar, no duplicar).
  const delimited = /<!--\s*dai:links:start[\s\S]*?dai:links:end\s*-->/i;
  if (delimited.test(body)) return body.replace(delimited, block);
  // 2. ¿Está la sección del template? El bloque va debajo del heading, PRESERVANDO el
  //    hint HTML si lo hay: es la guía para quien edite (y es invisible al renderizar).
  //    dai suma, no borra — borrar el texto de otro es justo lo que estamos arreglando.
  //    (el `\s*` tolera la línea en blanco entre el heading y el hint; como solo matchea
  //     espacios, no puede saltar a la sección siguiente para buscarse un comentario)
  const heading = /(^|\n)(##[^\n]*Enlaces relacionados[^\n]*\n)(\s*<!--[\s\S]*?-->[ \t]*\n)?/i;
  if (heading.test(body)) {
    return body.replace(heading, (m, pre, h, hint) => `${pre}${h}${hint || ""}\n${block}\n`);
  }
  // 3. Ni bloque ni sección: se apéndea con su propio heading.
  return `${body.replace(/\s*$/, "")}\n\n## Enlaces relacionados\n\n${block}\n`;
}

// Título del PR: el pasado a mano, o "<ID>: <título de la US>", o solo el ID.
// Sin US (branch exenta) cae al `fallback` — el subject del último commit: describe
// lo que hay adentro. Inventar un título con la US de otro es el bug de los issues
// #31/#33, y el título es lo ÚNICO que se ve en la lista de PRs.
export function prTitle(opts, id, usTitle, fallback = "") {
  if (opts.title) return opts.title;
  if (!id) return fallback;
  if (usTitle) return `${id}: ${usTitle}`;
  return id;
}

// Herramienta de CLI del forge según el host del remoto.
export function forgeTool(forge) {
  return forge === "gitlab" ? "glab" : "gh";
}
