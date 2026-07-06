import { test } from "node:test";
import assert from "node:assert/strict";
import { composePrBody, prTitle, forgeTool, replaceSection } from "../lib/pr.mjs";

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
    id: "86ajcjwzk", version: "v1", ac_hash: "51abbfa0", status: "al-dia",
    usTitle: "Checkout para cliente sin cuenta",
    commits: ["feat: valida carrito vacío", "test: guard de checkout"],
  });
  assert.match(b, /Implementa la US \*\*Checkout para cliente sin cuenta\*\* \(`86ajcjwzk`\)/);
  assert.match(b, /- \[x\] feat: valida carrito vacío/);
  assert.match(b, /- \[x\] test: guard de checkout/);
  assert.doesNotMatch(b, /Cambio 1/);  // placeholder reemplazado
});

test("composePrBody rellena la cabecera 🔗 Implementa", () => {
  const b = composePrBody(TPL, { id: "86ajcjwzk", version: "v1", ac_hash: "51abbfa0", status: "al-dia" });
  assert.match(b, /`86ajcjwzk`/);
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
  assert.match(b, /US: https:\/\/ck\/t\/X-1/);
  assert.match(b, /branch `feature\/X-1-x`: https:\/\/gh\/tree\/x/);
  assert.match(b, /commit `abcdef12`: https:\/\/gh\/commit/);
});

test("composePrBody sin sección Enlaces igual apénda los links", () => {
  const b = composePrBody("## 🔗 Implementa\n- **US:** `ABC-###`\n", { id: "X-1", version: "v1", ac_hash: "a", status: "al-dia", usUrl: "u" });
  assert.match(b, /US: u/);
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
