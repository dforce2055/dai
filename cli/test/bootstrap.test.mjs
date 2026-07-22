import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, validateSkill, yamlScalarIssue, stalePromptFiles, skillToCursor, constitution, constitutionCursorRule, envFor, mergeEnv, upsertBlock, reconcileGitignore } from "../lib/bootstrap.mjs";

test("validateSkill exige name y description en el frontmatter (ADR-0013)", () => {
  assert.equal(validateSkill("---\nname: x\ndescription: y\n---\n\nbody"), null);
  assert.match(validateSkill("---\ndescription: y\n---\nb"), /name/);
  assert.match(validateSkill("---\nname: x\n---\nb"), /description/);
  assert.match(validateSkill("sin frontmatter"), /frontmatter/);
});

test("envFor genera el .env por backend", () => {
  assert.match(envFor("md"), /DAI_PM=md/);
  assert.match(envFor("md"), /DAI_MD_US_DIR=\.dai\/us/);
  assert.match(envFor("clickup"), /DAI_PM=clickup\nDAI_CLICKUP_TOKEN=/);
  assert.match(envFor("jira"), /DAI_JIRA_BASE_URL=/);
  assert.doesNotMatch(envFor("clickup"), /pk_/); // sin secretos hardcodeados
});

const SKILL = `---
name: grill-user-story
description: Interroga a un PO para producir una US testeable. Invocar como /grill-user-story.
---

# grill-user-story

El cuerpo con la lógica de la skill.
`;

test("parseFrontmatter extrae name, description y body", () => {
  const p = parseFrontmatter(SKILL);
  assert.equal(p.name, "grill-user-story");
  assert.match(p.description, /Interroga a un PO/);
  assert.match(p.body, /^# grill-user-story/);
  assert.doesNotMatch(p.body, /^---/);
});

test("parseFrontmatter sin frontmatter → body crudo", () => {
  const p = parseFrontmatter("# Solo cuerpo\n\ntexto");
  assert.equal(p.name, null);
  assert.match(p.body, /Solo cuerpo/);
});

// Copilot dejó de necesitar conversión: lee el SKILL.md tal cual (ADR-0014). Lo que
// queda es limpiar los .prompt.md que dai generaba antes, para que no dupliquen cada
// /comando con una copia vieja y sin templates.
test("stalePromptFiles nombra los .prompt.md que dai generaba antes", () => {
  assert.deepEqual(stalePromptFiles(["grill-epic", "tdd"]), ["grill-epic.prompt.md", "tdd.prompt.md"]);
  assert.deepEqual(stalePromptFiles([]), []);
});

test("skillToCursor conserva name/body y serializa description", () => {
  const out = skillToCursor(SKILL);
  assert.match(out, /^---\nname: grill-user-story\n/);
  assert.match(out, /description: "Interroga a un PO/);
  assert.match(out, /El cuerpo con la lógica de la skill\./);
  assert.doesNotMatch(out, /^mode: agent$/m);
  assert.doesNotMatch(out, /^disable-model-invocation:/m);
});

test("constitution difiere el encabezado por asistente pero comparte el núcleo", () => {
  const c = constitution("claude"), p = constitution("copilot"), r = constitution("cursor");
  assert.match(c, /Constitución del proyecto/);
  assert.match(p, /Instrucciones de Copilot/);
  assert.match(r, /\.cursor\/skills\//);
  for (const core of [/No vibe coding/, /TDD/, /link se autora una vez/, /SSH/]) {
    assert.match(c, core);
    assert.match(p, core);
    assert.match(r, core);
  }
});

test("constitutionCursorRule genera rule de Cursor alwaysApply", () => {
  const out = constitutionCursorRule();
  assert.match(out, /^---\ndescription: /);
  assert.match(out, /\nalwaysApply: true\n/);
  assert.match(out, /las skills de dai \(`\.cursor\/skills\/`\)/);
});

// ── helpers aditivos de `dai init` (no destruir config de un repo vivo) ──

test("mergeEnv agrega solo las claves que faltan (aditivo, idempotente)", () => {
  const existing = "API_TOKEN=xyz\nDAI_PM=clickup\n";
  const block = "DAI_PM=md\nDAI_MD_US_DIR=.dai/us\n";
  const out = mergeEnv(existing, block);
  assert.match(out, /API_TOKEN=xyz/);            // conserva lo del proyecto
  assert.match(out, /DAI_PM=clickup/);           // NO pisa la clave existente
  assert.doesNotMatch(out, /DAI_PM=md/);         // no re-agrega DAI_PM
  assert.match(out, /DAI_MD_US_DIR=\.dai\/us/);  // agrega la que faltaba
  assert.equal(mergeEnv(out, block), out);       // idempotente
});

test("mergeEnv crea desde vacío", () => {
  assert.match(mergeEnv("", "DAI_PM=md\n"), /DAI_PM=md/);
});

test("upsertBlock inserta un bloque delimitado sin pisar el resto, e idempotente", () => {
  const proj = "# Constitución del proyecto\n\nReglas propias.\n";
  const a = upsertBlock(proj, "método dai");
  assert.match(a, /Reglas propias\./);                 // conserva lo previo
  assert.match(a, /<!-- dai:start -->\nmétodo dai\n<!-- dai:end -->/);
  const b = upsertBlock(a, "método dai v2");           // re-correr actualiza, no duplica
  assert.equal((b.match(/dai:start/g) || []).length, 1);
  assert.match(b, /método dai v2/);
  assert.doesNotMatch(b, /método dai v1|método dai\n/);
});

test("upsertBlock desde vacío es solo el bloque", () => {
  assert.equal(upsertBlock("", "x"), "<!-- dai:start -->\nx\n<!-- dai:end -->\n");
});

test("reconcileGitignore versiona artefactos de dai y deja fuera solo lo personal", () => {
  const gi = "# Misc\n.claude/\nCLAUDE.md\nnode_modules\n";
  const { text, changed } = reconcileGitignore(gi, { claude: true });
  assert.ok(changed);
  assert.doesNotMatch(text, /^\.claude\/$/m);                 // quita el broad-ignore
  assert.doesNotMatch(text, /^CLAUDE\.md$/m);                 // deja versionar la constitución
  assert.match(text, /node_modules/);                        // no toca lo demás
  assert.match(text, /\.claude\/settings\.local\.json/);     // solo lo personal fuera
  assert.match(text, /^\.env\.dai$/m);                        // dai ignora SU archivo de secretos
  assert.doesNotMatch(text, /^\.env$/m);                      // el .env del equipo NO se toca (ADR-0017)
});

test("reconcileGitignore es idempotente y no duplica", () => {
  const first = reconcileGitignore(".claude/\n", { claude: true }).text;
  const second = reconcileGitignore(first, { claude: true });
  assert.equal(second.changed, false);
  assert.equal(second.text, first);
});

// ── el frontmatter tiene que ser YAML válido, no "válido para nuestro regex" ──
// Copilot lee el SKILL.md crudo con un parser YAML estricto (ADR-0014): una descripción
// con un ': ' suelto tira abajo la skill ENTERA. Vivió escondido porque el parser de acá
// es un regex y porque la conversión a Copilot/Cursor citaba el valor y lo tapaba.
// Le pasó de verdad a doc-to-backlog ("...épicas finales: extrae...") y a grill-epic.

test("yamlScalarIssue caza el ': ' sin comillas (el bug real)", () => {
  assert.match(yamlScalarIssue("NO emite US ni épicas finales: extrae candidatos"), /': ' sin comillas/);
  assert.match(yamlScalarIssue("Se queda a nivel funcional/alcance: define el objetivo"), /': ' sin comillas/);
});

test("yamlScalarIssue acepta lo que YAML acepta", () => {
  assert.equal(yamlScalarIssue("Una descripción normal, sin trampas"), null);
  assert.equal(yamlScalarIssue("grill-epic"), null);
  assert.equal(yamlScalarIssue("Los dos puntos pegados sí:van bien"), null);   // sin espacio, no es mapa
});

test("yamlScalarIssue: citado vale todo", () => {
  assert.equal(yamlScalarIssue('"NO emite US ni épicas finales: extrae candidatos"'), null);
  assert.equal(yamlScalarIssue("'con comillas simples: también'"), null);
});

test("yamlScalarIssue: comentario e indicadores", () => {
  assert.match(yamlScalarIssue("algo #esto no, pero esto sí #comentario"), /' #' sin comillas/);
  assert.match(yamlScalarIssue("- empieza con guion"), /empieza con '-'/);
  assert.match(yamlScalarIssue("*ancla"), /empieza con '\*'/);
  assert.match(yamlScalarIssue(""), /vacío/);
});

test("validateSkill rechaza el frontmatter que Copilot no puede parsear", () => {
  const roto = '---\nname: doc-to-backlog\ndescription: Toma un doc. NO emite US finales: extrae candidatos\n---\n\nbody';
  assert.match(validateSkill(roto), /'description' no es YAML válido[\s\S]*': ' sin comillas[\s\S]*comillas dobles/);
});

test("validateSkill acepta la misma descripción, citada", () => {
  const ok = '---\nname: doc-to-backlog\ndescription: "Toma un doc. NO emite US finales: extrae candidatos"\n---\n\nbody';
  assert.equal(validateSkill(ok), null);
});

// ── Descripciones en BLOQUE YAML (`|` / `>`) — así se escriben las skills reales, con
// descripciones multilínea "USAR CUANDO / NO USAR CUANDO". El parser de dai (regex) las
// leía mal (tomaba solo `|`) y el validador las rechazaba. ──

test("parseFrontmatter lee un description en bloque literal (|) multilínea", () => {
  const md = [
    "---",
    "name: ui-select",
    "description: |",
    "  Combo con búsqueda del framework.",
    "  USAR CUANDO: hay muchas opciones.",
    "  NO USAR CUANDO: pocas opciones fijas.",
    "---",
    "",
    "# Cuerpo de la skill",
  ].join("\n");
  const { name, description, body } = parseFrontmatter(md);
  assert.equal(name, "ui-select");
  assert.equal(description, "Combo con búsqueda del framework.\nUSAR CUANDO: hay muchas opciones.\nNO USAR CUANDO: pocas opciones fijas.");
  assert.equal(body, "# Cuerpo de la skill");
});

test("parseFrontmatter: bloque plegado (>) une líneas con espacio", () => {
  const md = ["---", "name: x", "description: >", "  una", "  descripción", "  plegada", "---", "", "body"].join("\n");
  assert.equal(parseFrontmatter(md).description, "una descripción plegada");
});

test("validateSkill acepta un description en bloque (antes lo rechazaba por el '|')", () => {
  const md = ["---", "name: ui-table", "description: |", "  Tabla del framework.", "  USAR CUANDO: hay que listar datos: filas y columnas.", "---", "", "body"].join("\n");
  assert.equal(validateSkill(md), null);
});

test("skillToCursor emite un description de bloque como escalar válido (round-trip)", () => {
  const md = ["---", "name: ui-x", "description: |", "  linea uno", "  linea: dos", "---", "", "cuerpo"].join("\n");
  const rt = parseFrontmatter(skillToCursor(md));    // convertir y re-parsear
  assert.equal(rt.name, "ui-x");
  assert.equal(rt.description, "linea uno\nlinea: dos");   // multilínea preservada, válido
});

test("parseFrontmatter saca las comillas (si no, skillToCursor citaría dos veces)", () => {
  const md = '---\nname: x\ndescription: "Con \\"comillas\\" adentro: y dos puntos"\n---\n\nbody';
  const { description } = parseFrontmatter(md);
  assert.equal(description, 'Con "comillas" adentro: y dos puntos');
  const cur = skillToCursor(md);
  assert.match(cur, /^description: "Con \\"comillas\\" adentro: y dos puntos"$/m);   // citada UNA vez
  assert.doesNotMatch(cur, /description: "\\"/);                                     // no doble-citada
});

test("las 7 skills que dai distribuye pasan su propia validación", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../../skills/", import.meta.url).pathname;
  const names = readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());
  assert.ok(names.length >= 7, "deberían ser al menos 7 skills");
  for (const n of names) {
    assert.equal(validateSkill(readFileSync(join(root, n, "SKILL.md"), "utf8")), null, `${n} no valida`);
  }
});

// ── .dai/reviews/ en el .gitignore (issue #25) ───────────────────────────────
// Un review.json a medio editar —con hallazgos que un LLM todavía no validó— no tiene
// por qué viajar en un commit. Va ignorado por default; quien quiera versionarlos saca
// la línea a mano.

test("reconcileGitignore ignora .dai/reviews/ por default, en cualquier asistente", () => {
  for (const want of [{}, { claude: true }, { cursor: true }, { claude: true, cursor: true }]) {
    const { text } = reconcileGitignore("", want);
    assert.ok(text.split("\n").some((l) => l.trim() === ".dai/reviews/"), `falta con ${JSON.stringify(want)}`);
  }
});

// `.dai/` entero NO se ignora: ahí vive .dai/jira-fields.json, que SÍ se versiona.
test("reconcileGitignore no ignora .dai/ entero — ahí hay config versionada", () => {
  const { text } = reconcileGitignore("", { claude: true });
  assert.ok(!text.split("\n").some((l) => ["dai", ".dai"].includes(l.trim().replace(/^\/|\/$/g, ""))));
});

// Antes se comparaba el texto crudo, así que a quien ya la tenía sin barra final le
// agregábamos una segunda línea con la misma regla.
test("reconcileGitignore no duplica una regla que ya está escrita distinto", () => {
  for (const existing of [".dai/reviews", "/.dai/reviews/", ".dai/reviews/"]) {
    const { text } = reconcileGitignore(`${existing}\n.env.dai\n`, {});
    const hits = text.split("\n").filter((l) => l.trim().replace(/^\/+|\/+$/g, "") === ".dai/reviews");
    assert.equal(hits.length, 1, `duplicó con '${existing}': ${JSON.stringify(text)}`);
  }
});

test("reconcileGitignore: un comentario que menciona la ruta no cuenta como regla", () => {
  const { text } = reconcileGitignore("# .dai/reviews/ lo ignoramos algún día\n", {});
  assert.ok(text.split("\n").some((l) => l.trim() === ".dai/reviews/"));
});
