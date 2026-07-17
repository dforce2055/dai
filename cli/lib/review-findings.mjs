// dai · hallazgos de un review inline: parseo, validación contra el diff, filtros y render.
// Puro y sin red (ADR-0002: lo mecánico en el CLI, el criterio en la skill).
//
// El contrato con la skill es un `review.json`. La skill lo escribe, el humano lo lee y
// lo edita, y el CLI lo valida y lo postea. Ese archivo ES la puerta humana: es
// diff-eable, editable a mano y auditable, y no ata el flujo a ningún asistente.

export const SEVERITIES = ["low", "medium", "high"];
const SEV = {
  low: { emoji: "🔵", label: "Low" },
  medium: { emoji: "🟡", label: "Medium" },
  high: { emoji: "🔴", label: "High" },
};
const rank = (s) => SEVERITIES.indexOf(s);

// ── Parseo del review.json ───────────────────────────────────────────────────
// Errores accionables: un LLM se equivoca, y "Unexpected token" no le dice dónde.

function fail(msg) {
  throw new Error(`review.json inválido: ${msg}`);
}

export function parseFindings(text) {
  let j;
  try {
    j = typeof text === "string" ? JSON.parse(text) : text;
  } catch (e) {
    fail(`no es JSON válido (${e.message}).`);
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) fail("la raíz tiene que ser un objeto.");
  if (!Array.isArray(j.findings)) fail("falta el array 'findings' (puede ir vacío, pero tiene que estar).");

  const findings = j.findings.map((f, i) => {
    const at = `findings[${i}]`;
    if (!f || typeof f !== "object") fail(`${at}: tiene que ser un objeto.`);
    if (typeof f.path !== "string" || !f.path.trim()) fail(`${at}: falta 'path' (ruta del archivo, relativa a la raíz del repo).`);
    if (!Number.isInteger(f.line) || f.line < 1) fail(`${at} (${f.path}): 'line' tiene que ser un entero ≥ 1, vino ${JSON.stringify(f.line)}.`);
    if (typeof f.body !== "string" || !f.body.trim()) fail(`${at} (${f.path}:${f.line}): falta 'body' (el hallazgo, en prosa).`);
    const side = f.side === undefined ? "RIGHT" : String(f.side).toUpperCase();
    if (side !== "RIGHT" && side !== "LEFT") fail(`${at} (${f.path}:${f.line}): 'side' tiene que ser RIGHT o LEFT, vino ${JSON.stringify(f.side)}.`);
    if (!SEVERITIES.includes(f.severity)) fail(`${at} (${f.path}:${f.line}): 'severity' tiene que ser ${SEVERITIES.join(" | ")}, vino ${JSON.stringify(f.severity)}.`);
    const confidence = f.confidence === undefined ? 1 : f.confidence;
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
      fail(`${at} (${f.path}:${f.line}): 'confidence' tiene que ser un número entre 0 y 1, vino ${JSON.stringify(f.confidence)}.`);
    }
    return { path: f.path.trim(), line: f.line, side, severity: f.severity, confidence, body: f.body.trim() };
  });

  return {
    us: j.us ?? null,
    version: j.version ?? null,
    checkStatus: j.checkStatus ?? null,
    dod: j.dod ?? null,
    summary: typeof j.summary === "string" ? j.summary.trim() : "",
    good: Array.isArray(j.good) ? j.good.filter((g) => typeof g === "string" && g.trim()) : [],
    findings,
  };
}

// ── Posiciones válidas según el diff ─────────────────────────────────────────
// El anti-alucinación. Un LLM inventa números de línea con una facilidad pasmosa, y el
// forge responde 422 sin decir cuál falló. Como el diff ya lo tenemos local, se verifica
// acá antes de salir a la red.
//
// Devuelve: Map<path, { right: Set<line>, left: Set<line> }>. Las líneas de contexto
// cuentan de los dos lados: el forge acepta comentarlas, son parte del hunk.

export function diffPositions(diff) {
  const files = new Map();
  let cur = null, newLine = 0, oldLine = 0;

  for (const raw of String(diff ?? "").split(/\r?\n/)) {
    // Ojo el orden: '+++ ' y '--- ' empiezan con '+' y '-'. Van ANTES que las de contenido.
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim().replace(/\t.*$/, "");
      if (p === "/dev/null") { cur = null; continue; }        // archivo borrado: no hay lado derecho
      cur = { right: new Set(), left: new Set() };
      files.set(stripDiffPrefix(p), cur);
      continue;
    }
    if (raw.startsWith("--- ")) continue;
    if (raw.startsWith("@@")) {
      const m = raw.match(/^@@+ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) { oldLine = Number(m[1]); newLine = Number(m[2]); }
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("+")) cur.right.add(newLine++);
    else if (raw.startsWith("-")) cur.left.add(oldLine++);
    else if (raw.startsWith(" ")) { cur.right.add(newLine++); cur.left.add(oldLine++); }
    // "\ No newline at end of file", "index …", "diff --git …", "similarity …": se ignoran
  }
  return files;
}

// "b/src/x.ts" → "src/x.ts". git usa a//b/ como prefijos del diff.
function stripDiffPrefix(p) {
  return p.replace(/^[ab]\//, "");
}

// ── Validación ───────────────────────────────────────────────────────────────
// Un hallazgo que no apunta al diff NO se postea. Se reporta, no se descarta en silencio.

export function validateFindings(findings, positions) {
  const valid = [], rejected = [];
  for (const f of findings) {
    const pos = positions.get(f.path);
    if (!pos) {
      rejected.push({ finding: f, reason: "el archivo no aparece en el diff" });
      continue;
    }
    const lines = f.side === "LEFT" ? pos.left : pos.right;
    if (!lines.has(f.line)) {
      rejected.push({ finding: f, reason: `la línea ${f.line} no es parte del diff (lado ${f.side})` });
      continue;
    }
    valid.push(f);
  }
  return { valid, rejected };
}

// ── Filtros ──────────────────────────────────────────────────────────────────
// Lo que habilita el modo desatendido con red: por debajo del umbral, el hallazgo no se
// postea pero se lista en el resumen. Nada se cae en silencio.

export function filterFindings(findings, { minSeverity = "low", minConfidence = 0, maxComments = Infinity } = {}) {
  if (!SEVERITIES.includes(minSeverity)) throw new Error(`--min-severity: valores ${SEVERITIES.join(" | ")}, vino '${minSeverity}'.`);
  const kept = [], suppressed = [];
  // Ordenado por severidad y después por confianza: si hay tope, se cortan los menos graves.
  const sorted = [...findings].sort((a, b) => rank(b.severity) - rank(a.severity) || b.confidence - a.confidence);
  for (const f of sorted) {
    if (rank(f.severity) < rank(minSeverity)) { suppressed.push({ finding: f, reason: `severidad ${f.severity} < ${minSeverity}` }); continue; }
    if (f.confidence < minConfidence) { suppressed.push({ finding: f, reason: `confianza ${f.confidence} < ${minConfidence}` }); continue; }
    if (kept.length >= maxComments) { suppressed.push({ finding: f, reason: `tope de --max-comments (${maxComments})` }); continue; }
    kept.push(f);
  }
  return { kept, suppressed };
}

// ── Render ───────────────────────────────────────────────────────────────────

// El cuerpo de un comentario inline. Lleva marca de dai a propósito: el comentario se
// postea con el token del humano, así que el forge lo atribuye a él SIN badge de bot. Sin
// esta línea, el compañero ve un juicio sobre su código firmado por una persona, sin
// forma de saber que lo escribió una máquina.
export function renderFindingBody(f) {
  const { emoji, label } = SEV[f.severity];
  return `${emoji} **${label}** — ${f.body}\n\n<sub>🤖 <code>dai-review</code> · revisión asistida por IA, revisada y firmada por un humano</sub>`;
}

const bullets = (arr) => (arr.length ? arr.map((x) => `- ${x}`).join("\n") : "- — ninguno —");

function detailsList(title, items) {
  if (!items.length) return null;
  const rows = items.map(({ finding: f, reason }) => `- \`${f.path}:${f.line}\` (${f.severity}) — ${reason}\n  > ${f.body.split("\n")[0]}`);
  return `<details>\n<summary>${title} (${items.length})</summary>\n\n${rows.join("\n")}\n\n</details>`;
}

// El cuerpo del review (el "Pull request overview"). Mismo encabezado de metodología que
// renderReviewComment — los reviews del equipo se siguen leyendo igual.
export function renderReviewSummary(r, { kept = [], suppressed = [], rejected = [] } = {}) {
  const head = r.us
    ? `**US:** \`${r.us}\`${r.version ? ` @ ${r.version}` : ""} · \`dai check\`: ${r.checkStatus || "?"}`
    : "**US:** _(este PR no declara implementar una US)_";

  const counts = SEVERITIES.slice().reverse()
    .map((s) => ({ s, n: kept.filter((f) => f.severity === s).length }))
    .filter(({ n }) => n > 0)
    .map(({ s, n }) => `${n} ${SEV[s].emoji} ${SEV[s].label}`);

  const hallazgos = kept.length
    ? `Dejé **${kept.length}** ${kept.length === 1 ? "comentario" : "comentarios"} en línea: ${counts.join(" · ")}.`
    : "Sin comentarios en línea: no encontré nada concreto que marcar.";

  return [
    "## 🤖 dai-review",
    "",
    head,
    r.dod ? `**Definition of Done:** ${r.dod}` : null,
    "",
    r.summary || null,
    r.summary ? "" : null,
    "### Hallazgos",
    hallazgos,
    "",
    "### ✅ Lo que está bien",
    bullets(r.good),
    "",
    detailsList("Suprimidos por el filtro", suppressed),
    detailsList("Descartados: no apuntan al diff", rejected),
    "",
    "---",
    "_Revisión asistida por dai. La aprobación la firma un humano (Art. 5 del manifiesto)._",
  ].filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}
