import { test } from "node:test";
import assert from "node:assert/strict";
import { composePrBody, prTitle, forgeTool, replaceSection, upsertLinksBlock, renderLinks } from "../lib/pr.mjs";

const TPL = `## 🔗 Implementa

- **US:** \`ABC-###\` @ \`vX\`  ·  ac_hash: \`<hash>\`  ·  verificado con \`dai check\` ✅

## Descripción

<!-- ... -->

## Cambios realizados

- [ ] Cambio 1
- [ ] Cambio 2

## Enlaces relacionados

<!-- US en el tracker -->
`;

test("replaceSection reemplaza solo el cuerpo de la sección", () => {
  const out = replaceSection(TPL, "Descripción", "texto nuevo");
  assert.match(out, /## Descripción\n\ntexto nuevo/);
  assert.doesNotMatch(out, /<!-- \.\.\. -->/);
  assert.match(out, /## Cambios realizados/); // no tocó las demás
});

test("composePrBody precarga Descripción desde la US y Cambios desde commits", () => {
  const b = composePrBody(TPL, {
    id: "86acme731", version: "v1", ac_hash: "51abbfa0", status: "al-dia",
    usTitle: "Checkout para cliente sin cuenta",
    commits: ["feat: valida carrito vacío", "test: guard de checkout"],
  });
  assert.match(b, /Implementa la US \*\*Checkout para cliente sin cuenta\*\* \(`86acme731`\)/);
  assert.match(b, /- \[x\] feat: valida carrito vacío/);
  assert.match(b, /- \[x\] test: guard de checkout/);
  assert.doesNotMatch(b, /Cambio 1/);  // placeholder reemplazado
});

test("composePrBody rellena la cabecera 🔗 Implementa", () => {
  const b = composePrBody(TPL, { id: "86acme731", version: "v1", ac_hash: "51abbfa0", status: "al-dia" });
  assert.match(b, /`86acme731`/);
  assert.match(b, /@ `v1`/);
  assert.match(b, /ac_hash: `51abbfa0`/);
  assert.match(b, /dai check`: ✅ al día/);
  assert.doesNotMatch(b, /ABC-###/);
});

test("composePrBody inyecta los enlaces en la sección Enlaces", () => {
  const b = composePrBody(TPL, {
    id: "X-1", version: "v1", ac_hash: "aaa", status: "al-dia",
    usUrl: "https://ck/t/X-1", branch: "feature/X-1-x", branchUrl: "https://gh/tree/x", commit: "abcdef1234", commitUrl: "https://gh/commit/abcdef1234",
  });
  assert.match(b, /- US `X-1`: https:\/\/ck\/t\/X-1/);
  assert.match(b, /branch `feature\/X-1-x`: https:\/\/gh\/tree\/x/);
  assert.match(b, /commit `abcdef12`: https:\/\/gh\/commit/);
});

test("composePrBody sin sección Enlaces igual apénda los links", () => {
  const b = composePrBody("## 🔗 Implementa\n- **US:** `ABC-###`\n", { id: "X-1", version: "v1", ac_hash: "a", status: "al-dia", usUrl: "u" });
  assert.match(b, /## Enlaces relacionados/);
  assert.match(b, /- US `X-1`: u/);
});

// ── El bloque delimitado ─────────────────────────────────────────────────────
// Regresión de PRs reales: un agente reescribió "Enlaces relacionados" y se llevó
// puestos los links de dai sin dejar rastro. El bloque va marcado para que se pueda
// detectar, regenerar y —sobre todo— para que quien edite vea que es de dai.

test("el bloque de links va delimitado por marcadores dai:links", () => {
  const b = composePrBody(TPL, { id: "X-1", version: "v1", ac_hash: "a", status: "al-dia", usUrl: "https://ck/t/X-1" });
  assert.match(b, /<!-- dai:links:start[\s\S]*?dai:links:end -->/);
  assert.match(b, /no editar a mano/);
});

test("upsertLinksBlock es idempotente: regenera el bloque, no lo duplica", () => {
  const d = { id: "X-1", usUrl: "https://ck/t/X-1", branch: "f/x", branchUrl: "https://gh/tree/x" };
  const once = upsertLinksBlock(TPL, d);
  const twice = upsertLinksBlock(once, d);
  assert.equal(twice, once);
  assert.equal(twice.match(/dai:links:start/g).length, 1);
});

test("upsertLinksBlock regenera el bloque con los datos nuevos", () => {
  const viejo = upsertLinksBlock(TPL, { id: "X-1", usUrl: "https://ck/t/VIEJA" });
  const nuevo = upsertLinksBlock(viejo, { id: "X-2", usUrl: "https://ck/t/NUEVA" });
  assert.match(nuevo, /- US `X-2`: https:\/\/ck\/t\/NUEVA/);
  assert.doesNotMatch(nuevo, /VIEJA/);
  assert.equal(nuevo.match(/dai:links:start/g).length, 1);
});

test("upsertLinksBlock preserva el hint del template (dai suma, no borra)", () => {
  const tpl = "## Enlaces relacionados\n\n<!-- sumá acá docs, issues, PRs relacionadas -->\n";
  const b = upsertLinksBlock(tpl, { id: "X-1", usUrl: "u" });
  assert.match(b, /sumá acá docs, issues/);
  assert.match(b, /- US `X-1`: u/);
});

// El hint va ANTES del bloque: le habla a quien edita y dice "el bloque de abajo".
// El template real tiene una línea en blanco entre el heading y el hint, y con eso
// el bloque se colaba en el medio y dejaba al hint hablando de algo que estaba arriba.
test("upsertLinksBlock deja el hint arriba del bloque, aun con línea en blanco", () => {
  const tpl = "## Enlaces relacionados\n\n<!--\n  el bloque de abajo lo llena dai\n-->\n\n---\n";
  const b = upsertLinksBlock(tpl, { id: "X-1", usUrl: "u" });
  assert.ok(b.indexOf("el bloque de abajo") < b.indexOf("dai:links:start"), "el hint debe ir antes del bloque");
  assert.match(b, /---/);   // no se comió la sección siguiente
});

test("upsertLinksBlock no se roba el hint de la sección siguiente", () => {
  const tpl = "## Enlaces relacionados\n\n---\n\n## Otra sección\n\n<!-- hint ajeno -->\n";
  const b = upsertLinksBlock(tpl, { id: "X-1", usUrl: "u" });
  assert.ok(b.indexOf("dai:links:end") < b.indexOf("hint ajeno"), "el bloque va en su sección, no debajo del hint ajeno");
  assert.match(b, /## Otra sección\n\n<!-- hint ajeno -->/);
});

test("upsertLinksBlock preserva el texto que el humano sumó debajo del bloque", () => {
  const d = { id: "X-1", usUrl: "u" };
  const conNota = upsertLinksBlock(TPL, d) + "\n- Depende de la PR #92 del backend.\n";
  const regenerado = upsertLinksBlock(conNota, d);
  assert.match(regenerado, /Depende de la PR #92 del backend/);
});

// Sin URL no inventa la línea: un id pelado escrito como si fuera un link es
// exactamente lo que rompió las PRs reales (ver lib/tracker-url.mjs).
test("sin usUrl, el bloque OMITE la línea de la US en vez de escribir el id pelado", () => {
  const b = composePrBody(TPL, { id: "X-1", version: "v1", ac_hash: "a", status: "al-dia", usUrl: null });
  assert.match(b, /dai:links:start/);
  assert.doesNotMatch(b, /- US `X-1`:/);
});

test("prTitle: --title gana; si no, ID + título de la US; si no, solo ID", () => {
  assert.equal(prTitle({ title: "Custom" }, "X-1", "Checkout"), "Custom");
  assert.equal(prTitle({}, "X-1", "Checkout"), "X-1: Checkout");
  assert.equal(prTitle({}, "X-1", null), "X-1");
});

test("forgeTool elige gh o glab", () => {
  assert.equal(forgeTool("github"), "gh");
  assert.equal(forgeTool("gitlab"), "glab");
});
