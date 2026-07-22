import test from "node:test";
import assert from "node:assert/strict";
import {
  splitCriteria, isGherkin, validateUS, renderValidation,
  parseSpecVersion, bumpSpecVersion, setSpecVersion,
} from "../lib/us-format.mjs";
import { extractAcBlock, acHash } from "../lib/ac-hash.mjs";

// El molde canónico (templates/formato-us.md): criterios etiquetados AC-N con Gherkin.
const CANONICA = `# 🔗 Metadata de trazabilidad

| **spec_version** | \`v2\` |

# Marcar una tarea como completada

## Historia

Como **usuario de la lista**
quiero **marcar una tarea**
para **saber qué me falta**.

## 🔗 Criterios de aceptación

- [ ] **AC-1** —
  - **Dado** una tarea pendiente
  - **Cuando** la marco como completada
  - **Entonces** deja de contar en el total de pendientes.
- [ ] **AC-2** —
  - **Dado** una tarea ya completada
  - **Cuando** la vuelvo a marcar
  - **Entonces** vuelve a pendiente.

## Fuera de scope

- Nada.
`;

// La forma suelta, sin etiquetas AC-N: cada "Dado" abre un criterio.
const SUELTA = `# Finalizar la compra

## Criterios de aceptación

- **Dado** un carrito con productos
- **Cuando** finalizo
- **Entonces** se crea la orden
- **Dado** un carrito vacío
- **Cuando** finalizo
- **Entonces** se rechaza
`;

// ── splitCriteria ────────────────────────────────────────────────────────────
test("splitCriteria: agrupa por etiqueta AC-N cuando la US las usa", () => {
  const cs = splitCriteria(extractAcBlock(CANONICA));
  assert.equal(cs.length, 2);
  assert.deepEqual(cs.map((c) => c.label), ["AC-1", "AC-2"]);
  assert.ok(cs.every(isGherkin), "las dos tienen Dado/Cuando/Entonces");
});

test("splitCriteria: sin etiquetas, cada 'Dado' abre un criterio nuevo", () => {
  const cs = splitCriteria(extractAcBlock(SUELTA));
  assert.equal(cs.length, 2);
  assert.ok(cs.every(isGherkin));
  assert.match(cs[0].text, /carrito con productos/);
  assert.match(cs[1].text, /carrito vacío/);
});

test("splitCriteria: detecta qué parte del Gherkin falta", () => {
  const cs = splitCriteria("- **Dado** algo\n- **Entonces** otra cosa\n");
  assert.equal(cs.length, 1);
  assert.equal(cs[0].cuando, false);
  assert.equal(isGherkin(cs[0]), false);
});

// ── validateUS: lo que BLOQUEA ───────────────────────────────────────────────
// Solo tres cosas frenan, y son exactamente las que hacen imposible el link QUÉ↔CÓMO.

test("validateUS: una US canónica pasa sin advertencias", () => {
  const v = validateUS(CANONICA);
  assert.equal(v.ok, true);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.warnings, [], `warnings inesperados: ${v.warnings.join(" · ")}`);
  assert.equal(v.criteria.length, 2);
});

test("validateUS: sin '# Título' es error, no advertencia", () => {
  const v = validateUS("## Criterios de aceptación\n- Dado a\n- Cuando b\n- Entonces c\n");
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /falta el título/);
});

test("validateUS: sin sección de criterios es error — sin ac_hash no hay link", () => {
  const v = validateUS("# Una US\n\nTexto suelto sin criterios.\n");
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /Criterios de aceptación/);
  assert.equal(v.acHashable, false);
});

test("validateUS: sección de criterios vacía es error", () => {
  const v = validateUS("# Una US\n\n## Criterios de aceptación\n\n## Otra sección\n- x\n");
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /vacía/);
});

// ── validateUS: lo que solo AVISA ────────────────────────────────────────────
// dai opina en su dominio (trazabilidad) y sugiere en el resto. Un criterio sin Gherkin
// completo es peor, pero es una US legítima y frenarla sería un mandato, no una herramienta.

test("validateUS: un criterio sin Gherkin completo avisa pero NO bloquea", () => {
  const v = validateUS("# Una US\n\n## Criterios de aceptación\n- El total se recalcula solo\n");
  assert.equal(v.ok, true, "no bloquea");
  assert.equal(v.warnings.length, 1);
  assert.match(v.warnings[0], /Dado \/ Cuando \/ Entonces/);
});

test("validateUS: un criterio que se mete en el CÓMO avisa", () => {
  const v = validateUS("# Una US\n\n## Criterios de aceptación\n" +
    "- **Dado** un carrito\n- **Cuando** llamo al endpoint /checkout\n- **Entonces** responde 200\n");
  assert.equal(v.ok, true);
  assert.match(v.warnings.join(" "), /menciona implementación/);
});

test("validateUS: un título kilométrico avisa (de ahí sale el nombre de la branch)", () => {
  const v = validateUS("# Confirmación deliberada antes de ejecutar acciones con consecuencias graves para el usuario\n\n" +
    "## Criterios de aceptación\n- **Dado** a\n- **Cuando** b\n- **Entonces** c\n");
  assert.equal(v.ok, true);
  assert.match(v.warnings.join(" "), /palabras/);
});

// El validador nunca puede contradecir al hasher: si dice que hay criterios, acHash da algo.
test("validateUS: si valida, la US tiene ac_hash — validador y hasher no se contradicen", () => {
  for (const md of [CANONICA, SUELTA]) {
    assert.equal(validateUS(md).ok, true);
    assert.notEqual(acHash(md), null);
  }
});

// ── renderValidation ─────────────────────────────────────────────────────────
test("renderValidation: en verde dice cuántos criterios y cuántos son Gherkin", () => {
  const out = renderValidation(validateUS(CANONICA)).join("\n");
  assert.match(out, /✓ formato válido — 2 criterio\(s\), 2 en Gherkin completo/);
});

test("renderValidation: con errores no dice 'formato válido'", () => {
  const out = renderValidation(validateUS("# Sin criterios\n")).join("\n");
  assert.match(out, /✗/);
  assert.doesNotMatch(out, /formato válido/);
});

// ── spec_version ─────────────────────────────────────────────────────────────
test("parseSpecVersion: lo encuentra en la tabla de metadata del molde", () => {
  assert.equal(parseSpecVersion(CANONICA), "v2");
  assert.equal(parseSpecVersion("> **spec_version:** v7\n"), "v7");
  assert.equal(parseSpecVersion("spec version v3"), "v3");
  assert.equal(parseSpecVersion("# Sin versión\n"), null);
});

test("bumpSpecVersion: v1 → v2, y sin versión asume v1", () => {
  assert.equal(bumpSpecVersion("v1"), "v2");
  assert.equal(bumpSpecVersion("v9"), "v10");
  assert.equal(bumpSpecVersion(null), "v2", "sin versión, la US vivía implícitamente en v1");
});

test("setSpecVersion: reescribe la que ya está, sin tocar el resto", () => {
  const out = setSpecVersion(CANONICA, "v3");
  assert.equal(parseSpecVersion(out), "v3");
  assert.match(out, /Marcar una tarea como completada/);
  assert.equal(acHash(out), acHash(CANONICA), "cambiar la versión NO cambia el ac_hash");
});

// Una US traída de un Jira que nunca usó el molde no declara spec_version. Insertarla al
// final la deja donde nadie la ve; va debajo del título, que es donde la busca un humano.
test("setSpecVersion: si no hay, la inserta debajo del título", () => {
  const out = setSpecVersion("# Finalizar la compra\n\n## Criterios de aceptación\n- Dado a\n", "v2");
  const lines = out.split("\n");
  assert.match(lines[0], /^# Finalizar/);
  assert.ok(lines.slice(0, 4).some((l) => /spec_version.*v2/.test(l)), `no quedó arriba: ${JSON.stringify(lines.slice(0, 4))}`);
  assert.equal(parseSpecVersion(out), "v2");
});

test("setSpecVersion: sin título tampoco pierde el contenido", () => {
  const out = setSpecVersion("texto suelto\n", "v2");
  assert.equal(parseSpecVersion(out), "v2");
  assert.match(out, /texto suelto/);
});
