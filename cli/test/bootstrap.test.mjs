import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, validateSkill, stalePromptFiles, skillToCursor, constitution, constitutionCursorRule, envFor, mergeEnv, upsertBlock, reconcileGitignore } from "../lib/bootstrap.mjs";

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
  assert.match(text, /^\.env$/m);
});

test("reconcileGitignore es idempotente y no duplica", () => {
  const first = reconcileGitignore(".claude/\n", { claude: true }).text;
  const second = reconcileGitignore(first, { claude: true });
  assert.equal(second.changed, false);
  assert.equal(second.text, first);
});
