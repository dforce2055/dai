import { test } from "node:test";
import assert from "node:assert/strict";
import { absolutizeSiteLinks, SITE_DOCS } from "../lib/docs-links.mjs";

test("una captura del sitio queda apuntando al sitio publicado", () => {
  const md = "![Menú del avatar](/tutoriales/jira-1-avatar.png)\n";
  assert.equal(absolutizeSiteLinks(md), `![Menú del avatar](${SITE_DOCS}/tutoriales/jira-1-avatar.png)\n`);
});

test("es idempotente: una URL ya absoluta no se vuelve a reescribir", () => {
  const md = `![x](${SITE_DOCS}/tutoriales/jira-1-avatar.png)`;
  assert.equal(absolutizeSiteLinks(md), md);
});

test("no toca los links relativos entre documentos", () => {
  const md = "Ver [la guía del dev](./guias/dev.md) y [el ADR](../adr/0005-x.md).";
  assert.equal(absolutizeSiteLinks(md), md);
});

test("no toca una ruta absoluta que no es del sitio", () => {
  const md = "Editá [`/etc/hosts`](/etc/hosts) si hace falta.";
  assert.equal(absolutizeSiteLinks(md), md);
});

test("reescribe todas las capturas de un documento", () => {
  const md = "![a](/tutoriales/a.png)\ntexto\n![b](/tutoriales/sub/b.png)\n";
  const out = absolutizeSiteLinks(md);
  assert.equal((out.match(/https:/g) || []).length, 2);
  assert.doesNotMatch(out, /\]\(\/tutoriales/);
});
