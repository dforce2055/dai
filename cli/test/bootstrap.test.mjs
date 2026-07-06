import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, skillToPrompt, constitution, envFor } from "../lib/bootstrap.mjs";

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

test("skillToPrompt cambia el frontmatter a formato Copilot y conserva el cuerpo", () => {
  const out = skillToPrompt(SKILL);
  assert.match(out, /^---\nmode: agent\n/);
  assert.match(out, /description: "Interroga a un PO/);
  assert.match(out, /El cuerpo con la lógica de la skill\./);
  assert.doesNotMatch(out, /^name:/m); // el frontmatter de dai no viaja
});

test("constitution difiere el encabezado por asistente pero comparte el núcleo", () => {
  const c = constitution("claude"), p = constitution("copilot");
  assert.match(c, /Constitución del proyecto/);
  assert.match(p, /Instrucciones de Copilot/);
  for (const core of [/No vibe coding/, /TDD/, /link se autora una vez/, /SSH/]) {
    assert.match(c, core);
    assert.match(p, core);
  }
});
