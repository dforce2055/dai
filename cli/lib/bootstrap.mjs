// dai · bootstrap de un repo: genera los adaptadores de asistente (ADR-0002, capa 3).
// Una sola fuente (los SKILL.md) alimenta a Claude y a Copilot. Los archivos de
// Copilot se GENERAN, no se mantienen a mano (si no, driftean).

const REPO_URL = "https://github.com/dforce2055/dai";

// Parsea el frontmatter YAML de un SKILL.md → { name, description, body }.
export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { name: null, description: null, body: md.trim() };
  const fm = m[1];
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim() || null;
  const description = (fm.match(/^description:\s*(.+)$/m) || [])[1]?.trim() || null;
  return { name, description, body: m[2].trim() };
}

// Valida el contrato MÍNIMO de un SKILL.md para que dai lo ingiera y lo convierta a
// los 3 asistentes (y para que Claude/Cursor/Copilot lo carguen): frontmatter con
// `name` y `description`. Devuelve null si está OK, o un string con el motivo.
// NO valida el contenido de la skill — eso es criterio del equipo (ADR-0013).
export function validateSkill(md) {
  const { name, description } = parseFrontmatter(md);
  if (!name && !description) return "sin frontmatter (falta name y description)";
  if (!name) return "falta 'name' en el frontmatter";
  if (!description) return "falta 'description' en el frontmatter";
  return null;
}

// Transforma un SKILL.md (Claude) en un prompt file de Copilot (.prompt.md).
// Cambia el frontmatter; el cuerpo (la lógica) es el mismo.
export function skillToPrompt(md) {
  const { description, body } = parseFrontmatter(md);
  const fm = [
    "---",
    "mode: agent",
    description ? `description: ${JSON.stringify(description)}` : null,
    "---",
  ].filter((x) => x !== null).join("\n");
  return `${fm}\n\n${body}\n`;
}

// Transforma un SKILL.md (Claude) en un SKILL.md de Cursor.
// Conserva name/description/body y ajusta solo el frontmatter.
export function skillToCursor(md) {
  const { name, description, body } = parseFrontmatter(md);
  if (!name) return md.trim() + "\n";
  const fm = [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(description || "")}`,
    "---",
  ].join("\n");
  return `${fm}\n\n${body}\n`;
}

// Contenido del .env según el backend de PM elegido (tokens vacíos, a completar).
export function envFor(pm) {
  const head = "# Config de dai — completá lo que falte. NUNCA commitees tokens (.env está gitignored).\n";
  if (pm === "clickup") {
    return head + "DAI_PM=clickup\nDAI_CLICKUP_TOKEN=\nDAI_CLICKUP_LIST_ID=\nDAI_TRACKER_URL_TEMPLATE=https://app.clickup.com/t/{id}\n";
  }
  if (pm === "jira") {
    return head + "DAI_PM=jira\nDAI_JIRA_BASE_URL=\nDAI_JIRA_EMAIL=\nDAI_JIRA_TOKEN=\nDAI_JIRA_PROJECT=\nDAI_JIRA_ISSUETYPE=Story\nDAI_TRACKER_URL_TEMPLATE=\n";
  }
  return head + "DAI_PM=md\nDAI_MD_US_DIR=.dai/us\n";
}

// ── Helpers aditivos para `dai init` — no destruir la config de un repo vivo ──

// Une aditivamente variables de entorno: agrega solo las claves KEY= que NO estén
// ya definidas en `existing`. Idempotente; no toca lo demás. Ignora comentarios.
export function mergeEnv(existing, block) {
  const keyOf = (line) => {
    const m = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=/);
    return m ? m[1] : null;
  };
  const have = new Set(existing.split(/\r?\n/).map(keyOf).filter(Boolean));
  const toAdd = block.split(/\r?\n/).filter((line) => { const k = keyOf(line); return k && !have.has(k); });
  if (toAdd.length === 0) return existing;
  const sep = existing && !existing.endsWith("\n") ? "\n" : "";
  return existing + sep + "\n# ── dai ──\n" + toAdd.join("\n") + "\n";
}

// Inserta o actualiza un bloque delimitado (marcadores HTML) en una constitución,
// sin pisar el resto del archivo. Idempotente: re-correr actualiza el bloque, no duplica.
export function upsertBlock(existing, block, marker = "dai") {
  const start = `<!-- ${marker}:start -->`, end = `<!-- ${marker}:end -->`;
  const wrapped = `${start}\n${block.trim()}\n${end}`;
  const i = existing.indexOf(start), j = existing.indexOf(end);
  if (i !== -1 && j > i) {
    return existing.slice(0, i) + wrapped + existing.slice(j + end.length);
  }
  const base = existing.trimEnd();
  return base ? `${base}\n\n${wrapped}\n` : `${wrapped}\n`;
}

// Ajusta el texto de un .gitignore para que los artefactos de dai (según --for)
// queden versionados, dejando fuera SOLO lo personal (settings.local.json). Quita
// los ignores "broad" (.claude, CLAUDE.md, .cursor) que los esconderían. Aditivo e
// idempotente. Devuelve { text, changed }.
export function reconcileGitignore(text, want) {
  const norm = (s) => { let t = s.trim(); while (t.startsWith("/")) { t = t.slice(1); } while (t.endsWith("/")) { t = t.slice(0, -1); } return t; };
  const broad = new Set();
  const ensure = [".env"];
  if (want.claude) { broad.add("CLAUDE.md"); broad.add(".claude"); ensure.push(".claude/settings.local.json"); }
  if (want.cursor) { broad.add(".cursor"); }
  let changed = false;
  let lines = text.split(/\r?\n/).filter((line) => {
    if (line.trim().startsWith("#")) return true;
    if (broad.has(norm(line))) { changed = true; return false; }
    return true;
  });
  const have = new Set(lines.map((l) => l.trim()));
  const add = ensure.filter((e) => !have.has(e));
  if (add.length) {
    changed = true;
    if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    lines.push("# dai — solo lo personal fuera del control de versiones", ...add);
  }
  return { text: lines.join("\n"), changed };
}

// La constitución del repo: se inyecta como CLAUDE.md (Claude) o
// copilot-instructions.md (Copilot). Mismo núcleo, distinto encabezado.
export function constitution(kind) {
  const head = kind === "copilot"
    ? "# Instrucciones de Copilot para este repo\n\nEste repo sigue la metodología **dai**. Aplica estas reglas en todo lo que generes.\n\n> **Superficie:** los prompts de dai (`.github/prompts/`) se invocan solo en VS Code /\n> JetBrains, o como custom agents en el Copilot CLI — no en la app standalone ni en\n> github.com. El CLI `dai` corre en cualquier terminal."
    : kind === "cursor"
      ? "# Constitución del proyecto (dai)\n\nEste repo sigue la metodología **dai**. Estas reglas gobiernan todo el trabajo.\n\n> **Superficie:** las skills de dai (`.cursor/skills/`) se invocan con `/nombre-skill`\n> o cuando el agente las detecta por descripción. El CLI `dai` corre en cualquier terminal."
    : "# Constitución del proyecto (dai)\n\nEste repo sigue la metodología **dai**. Estas reglas gobiernan todo el trabajo.";
  return `${head}

## Valores

1. El QUÉ y el CÓMO son cosas distintas, con dueños distintos.
2. La IA asiste; la persona decide y firma.
3. Nada existe si no se puede testear ni trazar.
4. La ceremonia se agrega cuando duele, no antes.

## Reglas

- **No vibe coding:** toda implementación arranca de una US con criterios testeables.
- **TDD:** test primero, por la interfaz pública; sobrevive a un refactor.
- **El link se autora una vez** (\`implements.yaml\`); la cobertura se **deriva** (nunca a mano).
- **Verifica el comportamiento, no solo que compile:** que pase el chequeo estático o el build no prueba que funcione; ejercita el flujo real antes de darlo por hecho.
- **La IA confirma antes de construir:** el asistente declara que entendió esta constitución y la va a obedecer antes de generar código.
- **Secretos:** en \`.env\` (nunca commiteados). git por **SSH**, APIs por **token scopeado**.
- **Docs vivas:** una constitución o arquitectura desactualizada es un defecto, no documentación.
- Separa el QUÉ (funcional) del CÓMO (técnico); no mezcles.

## Buenas prácticas (agnósticas)

- **Confía en el borde, no en el input:** valida y autoriza en el límite de confianza; no aceptes identidad, permisos ni datos externos sin verificar.
- **"No existe" > "no autorizado":** si un recurso no pertenece a quien pregunta, responde "no encontrado" en vez de revelar que existe.
- **Aísla la E/S externa:** toda llamada a un servicio externo vive detrás de un borde dedicado; la capa de presentación no llama afuera directo.
- **Estático en rojo = no está hecho:** los errores de tipos/lint son bloqueantes, no deuda diferible.
- **Lo que cambia junto, vive junto:** coloca junto la lógica, la interfaz y los tests de una misma unidad.

## Herramientas

- **Skills (el QUÉ):** \`doc-to-backlog\` (un doc → backlog) · \`grill-intent\` (Gate 0) · \`grill-epic\` (épicas) · \`grill-user-story\` (la US)
- **Skills (el CÓMO):** \`link-us\`, \`tdd\`, \`dai-review\`
- **CLI:** \`dai link-us <ID>\` · \`dai check\` · \`dai stamp\` · \`dai pr\` · \`dai ls\`
- **Formatos:** \`.dai/templates/\` · **Governance:** \`.dai/governance/\`

Detalle completo de la metodología: ${REPO_URL}
`;
}

// Regla de Cursor always-on con el contenido de la constitución (sin título H1).
export function constitutionCursorRule() {
  const content = constitution("cursor").replace(/^# .+\n\n/, "");
  return `---
description: Metodología dai — constitución del proyecto (valores, reglas, herramientas)
alwaysApply: true
---

${content}`;
}
