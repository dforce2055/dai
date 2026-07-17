// dai · componer el cuerpo de una Pull/Merge Request desde el template (ADR-0005).
// Parte pura y testeable: rellena el template con los datos del link + git + check.
// Los efectos (git push, gh/glab create) viven en dai.mjs.

const EMOJI = { "al-dia": "✅ al día", atrasado: "⚠️ atrasado", "sin-us": "❓ sin US" };

// Reemplaza el cuerpo de una sección (## Heading … hasta el próximo ## o el final)
// por content. Tolerante: si no encuentra la sección, devuelve el body igual.
// Sin flag `m`: `$` = fin de string (no fin de línea), así no corta antes de tiempo.
export function replaceSection(body, heading, content) {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)(##[ \\t]*${esc}[ \\t]*\\n)([\\s\\S]*?)(\\n##\\s|$)`, "i");
  if (!re.test(body)) return body;
  return body.replace(re, (m, pre, h, _b, tail) => `${pre}${h}\n${content}\n${tail}`);
}

// Rellena el template del PR con los datos precargados. Tolerante: reemplaza los
// placeholders que encuentra y deja el resto para que el humano lo edite.
export function composePrBody(template, d) {
  let b = template;
  b = b.replace(/`ABC-###`/g, `\`${d.id}\``);
  b = b.replace(/@ `vX`/g, `@ \`${d.version}\``);
  b = b.replace(/`<hash>`/g, `\`${d.ac_hash}\``);
  b = b.replace(/verificado con `dai check` ✅/g, `verificado con \`dai check\`: ${EMOJI[d.status] || d.status}`);

  // Descripción: default desde la US (el humano lo pule).
  if (d.usTitle) b = replaceSection(b, "Descripción", `Implementa la US **${d.usTitle}** (\`${d.id}\`). Ver los criterios de aceptación en el tracker.`);
  // Cambios realizados: de los commits de la branch (como gh pr create --fill).
  if (d.commits && d.commits.length) {
    b = replaceSection(b, "Cambios realizados", d.commits.map((c) => `- [x] ${c}`).join("\n"));
  }
  return upsertLinksBlock(b, d);
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
export function prTitle(opts, id, usTitle) {
  if (opts.title) return opts.title;
  if (usTitle) return `${id}: ${usTitle}`;
  return id;
}

// Herramienta de CLI del forge según el host del remoto.
export function forgeTool(forge) {
  return forge === "gitlab" ? "glab" : "gh";
}
