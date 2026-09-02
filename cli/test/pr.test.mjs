import { test } from "node:test";
import assert from "node:assert/strict";
import { composePrBody, prTitle, forgeTool, replaceSection, upsertLinksBlock, renderLinks, bodyGaps, isPlaceholder, sectionBody } from "../lib/pr.mjs";

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

// ── PR sin US: branch exenta (chore/, docs/…) — issues #31, #33 ───────────────
test("prTitle sin US cae al fallback (el último commit), no al ID de otro", () => {
  assert.equal(prTitle({}, null, null, "chore: archivar specs del sprint"), "chore: archivar specs del sprint");
  assert.equal(prTitle({ title: "a mano" }, null, null, "chore: x"), "a mano");
  // Con US, el comportamiento de siempre.
  assert.equal(prTitle({}, "ABC-1", "Compra", "chore: x"), "ABC-1: Compra");
});

test("composePrBody sin US dice que no hay US y no deja el placeholder ABC-###", () => {
  const out = composePrBody(TPL, {
    id: null, noUsReason: "'chore/' está exenta de US", commits: ["chore: archivar specs"],
    branch: "chore/archive-specs", branchUrl: "https://git/tree/chore/archive-specs",
  });
  assert.match(out, /Sin US/);
  assert.match(out, /chore\/' está exenta de US/);
  assert.doesNotMatch(out, /ABC-###/, "el placeholder del template no puede sobrevivir");
  assert.doesNotMatch(out, /- US `/, "sin US no hay línea de US en el bloque de links");
  assert.match(out, /- \[x\] chore: archivar specs/);
  assert.match(out, /branch `chore\/archive-specs`/);
});

// ── El molde del template no puede llegar a la PR publicada ──────────────────
// Bug real: la PR salía con "Descripción" vacía (el comentario HTML no se renderiza)
// y "Cambios realizados" con `Cambio 1/Cambio 2`. Pasaba cada vez que el tracker no
// respondía (sin usTitle) o la base no estaba local (sin commits) — en silencio.

test("--description gana sobre el título de la US", () => {
  const b = composePrBody(TPL, {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia",
    usTitle: "Checkout sin cuenta",
    description: "Corrige el 500 al pagar con carrito vacío: ahora valida antes de cobrar.",
    commits: ["fix: valida carrito"],
  });
  assert.match(b, /Corrige el 500 al pagar con carrito vacío/);
  assert.doesNotMatch(b, /Implementa la US \*\*Checkout sin cuenta\*\*/);
  assert.deepEqual(bodyGaps(b), []);
});

test("--changes gana sobre los commits", () => {
  const b = composePrBody(TPL, {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia", usTitle: "X",
    changes: "- Valida el carrito en el borde\n- Test de regresión del 500",
    commits: ["wip", "fixup"],
  });
  assert.match(b, /- Valida el carrito en el borde/);
  assert.doesNotMatch(b, /- \[x\] wip/);
});

test("sin título de la US ni --description, la Descripción queda sin llenar y bodyGaps lo dice", () => {
  const b = composePrBody(TPL, {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia",
    usTitle: null, commits: ["fix: algo"],
  });
  assert.deepEqual(bodyGaps(b), ["Descripción"]);
});

test("sin commits ni --changes, 'Cambios realizados' queda con el molde y bodyGaps lo dice", () => {
  const b = composePrBody(TPL, {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia",
    usTitle: "Checkout sin cuenta", commits: [],
  });
  assert.deepEqual(bodyGaps(b), ["Cambios realizados"]);
});

test("el peor caso (sin tracker y sin commits) reporta las dos secciones", () => {
  const b = composePrBody(TPL, { id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia" });
  assert.deepEqual(bodyGaps(b), ["Descripción", "Cambios realizados"]);
});

test("una PR sin US también exige descripción (antes ni siquiera se llenaba)", () => {
  const solo = composePrBody(TPL, { noUsReason: "branch chore/", commits: ["chore: bump deps"] });
  assert.deepEqual(bodyGaps(solo), ["Descripción"]);
  const con = composePrBody(TPL, {
    noUsReason: "branch chore/", commits: ["chore: bump deps"],
    description: "Sube las dependencias de dev; sin cambios de comportamiento.",
  });
  assert.deepEqual(bodyGaps(con), []);
});

test("isPlaceholder: un comentario HTML no es contenido (en la PR se ve vacío)", () => {
  assert.equal(isPlaceholder("<!-- Breve propósito de este PR -->"), true);
  assert.equal(isPlaceholder("\n\n"), true);
  assert.equal(isPlaceholder("- [ ] Cambio 1\n- [ ] Cambio 2"), true);
  assert.equal(isPlaceholder("<!-- hint -->\nResuelve el 500 del checkout."), false);
});

test("bodyGaps delata los placeholders de la cabecera (ABC-###, <hash>, vX)", () => {
  const b = "## Descripción\n\nalgo real\n\n## Cambios realizados\n\n- [x] x\n\n- **US:** `ABC-###`\n";
  assert.ok(bodyGaps(b).includes("🔗 Implementa"));
});

test("reconoce la sección aunque el repo tenga su propio heading (emoji, acentos, sufijo)", () => {
  const tpl = "## 📝 Descripción del cambio\n\n<!-- ... -->\n\n### CAMBIOS REALIZADOS\n\n- [ ] Cambio 1\n";
  const b = composePrBody(tpl, {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia",
    usTitle: "Checkout sin cuenta", commits: ["fix: valida carrito"],
  });
  assert.match(b, /## 📝 Descripción del cambio\n\nImplementa la US/);
  assert.match(b, /- \[x\] fix: valida carrito/);
  assert.deepEqual(bodyGaps(b), []);
});

test("si el template del repo no tiene la sección, upsertSection la agrega", () => {
  const b = composePrBody("## Checklist\n\n- [ ] tests\n", {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia",
    description: "Arregla el checkout.", commits: ["fix: carrito"],
  });
  assert.match(b, /## Descripción\n\nArregla el checkout\./);
  assert.match(b, /## Cambios realizados\n\n- \[x\] fix: carrito/);
  assert.match(b, /## Checklist/);           // no se comió lo del repo
  assert.deepEqual(bodyGaps(b), []);
});

test("un heading dentro de un bloque de código no se confunde con una sección", () => {
  const tpl = "## Descripción\n\n<!-- x -->\n\n## Notas\n\n```md\n## Cambios realizados\n- [ ] Cambio 1\n```\n";
  const b = composePrBody(tpl, {
    id: "ABC-7", version: "v1", ac_hash: "aaa", status: "al-dia",
    usTitle: "X", commits: ["fix: y"],
  });
  assert.match(b, /```md\n## Cambios realizados\n- \[ \] Cambio 1\n```/);   // el fence intacto
  assert.match(b, /## Cambios realizados\n\n- \[x\] fix: y/);               // la sección real, agregada
});

test("sectionBody devuelve null cuando la sección no existe", () => {
  assert.equal(sectionBody("## Otra\n\ntexto\n", "Descripción"), null);
  assert.match(sectionBody("## Descripción\n\ntexto\n", "Descripción"), /texto/);
});

// ── El relleno no toca la prosa ──────────────────────────────────────────────
// "verificado con `dai check` ✅" aparecía dos veces en el template: en el dato y en la
// prosa que explica el método. El replace global le metía el estado de ESTA PR a la
// oración general, y quedaba publicado en cada PR del repo.

test("el estado se rellena en la sección, no en la prosa que explica el método", () => {
  const tpl = "> El `implements.yaml` verificado con `dai check` ✅ ata el código a la US.\n\n" +
              "## 🔗 Implementa\n\n- **US:** `ABC-###` @ `vX`  ·  verificado con `dai check` ✅\n\n" +
              "## Descripción\n\nx\n\n## Cambios realizados\n\n- [x] y\n";
  const b = composePrBody(tpl, { id: "ACME-1", version: "v2", ac_hash: "abc", status: "al-dia", description: "x", commits: ["y"] });
  assert.match(b, /> El `implements\.yaml` verificado con `dai check` ✅ ata el código/);  // prosa intacta
  assert.match(b, /\*\*US:\*\* `ACME-1` @ `v2`  ·  verificado con `dai check`: ✅ al día/); // dato relleno
});

test("sin sección '🔗 Implementa' se rellena igual: mejor de más que publicar ABC-###", () => {
  const tpl = "- **US:** `ABC-###` @ `vX` · ac_hash: `<hash>`\n\n## Descripción\n\nx\n\n## Cambios realizados\n\n- [x] y\n";
  const b = composePrBody(tpl, { id: "ACME-1", version: "v2", ac_hash: "abc", status: "al-dia", description: "x", commits: ["y"] });
  assert.doesNotMatch(b, /ABC-###/);
  assert.deepEqual(bodyGaps(b), []);
});

test("cuando el tracker no responde, la PR dice que no se pudo verificar — no que no hay US", () => {
  const tpl = "## 🔗 Implementa\n\n- **US:** `ABC-###` @ `vX`  ·  verificado con `dai check` ✅\n\n" +
              "## Descripción\n\nx\n\n## Cambios realizados\n\n- [x] y\n";
  const b = composePrBody(tpl, { id: "ACME-1", version: "v2", ac_hash: "abc", status: "sin-respuesta", description: "x", commits: ["y"] });
  assert.match(b, /no verificado \(el tracker no respondió\)/);
  assert.doesNotMatch(b, /sin US/);
});
