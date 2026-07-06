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
  // Bloque de enlaces (lo agrega dai; el humano completa el resto del template).
  const links = ["", "<!-- Enlaces precargados por `dai pr` -->"];
  if (d.usUrl) links.push(`- US: ${d.usUrl}`);
  if (d.branchUrl) links.push(`- branch \`${d.branch}\`: ${d.branchUrl}`);
  if (d.commitUrl) links.push(`- commit \`${(d.commit || "").slice(0, 8)}\`: ${d.commitUrl}`);
  return b.replace(/(##\s*Enlaces relacionados\s*\n)(<!--[\s\S]*?-->)?/i,
    (m, h) => `${h}${links.join("\n")}\n`) === b
    ? b + "\n" + links.join("\n") + "\n"   // si no había sección Enlaces, apéndela
    : b.replace(/(##\s*Enlaces relacionados\s*\n)(<!--[\s\S]*?-->)?/i, (m, h) => `${h}${links.join("\n")}\n`);
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
