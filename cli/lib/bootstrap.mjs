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

// La constitución del repo: se inyecta como CLAUDE.md (Claude) o
// copilot-instructions.md (Copilot). Mismo núcleo, distinto encabezado.
export function constitution(kind) {
  const head = kind === "copilot"
    ? "# Instrucciones de Copilot para este repo\n\nEste repo sigue la metodología **dai**. Aplicá estas reglas en todo lo que generes.\n\n> **Superficie:** los prompts de dai (`.github/prompts/`) se invocan solo en VS Code /\n> JetBrains, o como custom agents en el Copilot CLI — no en la app standalone ni en\n> github.com. El CLI `dai` corre en cualquier terminal."
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
- **Secretos:** en \`.env\` (nunca commiteados). git por **SSH**, APIs por **token scopeado**.
- Separá el QUÉ (funcional) del CÓMO (técnico); no mezcles.

## Herramientas

- **Skills (el QUÉ):** \`doc-to-backlog\` (un doc → backlog) · \`grill-intent\` (Gate 0) · \`grill-epic\` (épicas) · \`grill-user-story\` (la US)
- **Skills (el CÓMO):** \`link-us\`, \`tdd\`, \`dai-review\`
- **CLI:** \`dai link-us <ID>\` · \`dai check\` · \`dai stamp\` · \`dai pr\` · \`dai ls\`
- **Formatos:** \`.dai/templates/\` · **Governance:** \`.dai/governance/\`

Detalle completo de la metodología: ${REPO_URL}
`;
}
