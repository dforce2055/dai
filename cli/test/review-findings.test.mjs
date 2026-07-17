import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFindings, diffPositions, validateFindings, filterFindings,
  renderFindingBody, renderReviewSummary, SEVERITIES,
} from "../lib/review-findings.mjs";

const DIFF = `diff --git a/src/checkout.ts b/src/checkout.ts
index 1111111..2222222 100644
--- a/src/checkout.ts
+++ b/src/checkout.ts
@@ -10,6 +10,8 @@ export function checkout(cart) {
   const total = sum(cart);
-  if (total > 0) {
+  if (total >= 0) {
+    logger.warn("carrito vacío");
     return pay(total);
   }
 }
diff --git a/src/borrado.ts b/dev/null
--- a/src/borrado.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const x = 1;
-export default x;
`;

// ── diffPositions ────────────────────────────────────────────────────────────

test("diffPositions mapea las líneas nuevas del lado derecho", () => {
  const p = diffPositions(DIFF).get("src/checkout.ts");
  // @@ +10: contexto 10, '+' 11 (if), '+' 12 (logger), contexto 13, 14
  assert.ok(p.right.has(11), "la línea agregada 11 es comentable");
  assert.ok(p.right.has(12), "la línea agregada 12 es comentable");
  assert.ok(p.right.has(10), "el contexto también es parte del hunk");
});

test("diffPositions mapea las borradas del lado izquierdo", () => {
  const p = diffPositions(DIFF).get("src/checkout.ts");
  assert.ok(p.left.has(11), "la línea borrada 11 es comentable en LEFT");
  assert.ok(!p.right.has(999), "una línea fuera del hunk no existe");
});

test("diffPositions no confunde '+++ b/…' y '--- a/…' con contenido", () => {
  const files = diffPositions(DIFF);
  assert.ok(files.has("src/checkout.ts"), "el path sale sin el prefijo b/");
  assert.ok(!files.has("b/src/checkout.ts"));
});

test("diffPositions ignora el lado derecho de un archivo borrado", () => {
  assert.equal(diffPositions(DIFF).has("/dev/null"), false);
});

test("diffPositions con diff vacío o nulo no explota", () => {
  assert.equal(diffPositions("").size, 0);
  assert.equal(diffPositions(null).size, 0);
});

test("diffPositions soporta varios hunks en un archivo", () => {
  const d = `--- a/x.ts
+++ b/x.ts
@@ -1,1 +1,2 @@
+uno
 dos
@@ -50,1 +51,2 @@
+cincuenta
 uno
`;
  const p = diffPositions(d).get("x.ts");
  assert.ok(p.right.has(1), "primer hunk");
  assert.ok(p.right.has(51), "segundo hunk arranca en su propio offset");
  assert.ok(!p.right.has(3), "no inventa líneas entre hunks");
});

// ── validateFindings — el anti-alucinación ───────────────────────────────────

test("validateFindings acepta lo que apunta al diff y rechaza lo que no", () => {
  const pos = diffPositions(DIFF);
  const { valid, rejected } = validateFindings([
    { path: "src/checkout.ts", line: 11, side: "RIGHT", severity: "high", confidence: 1, body: "ok" },
    { path: "src/checkout.ts", line: 999, side: "RIGHT", severity: "high", confidence: 1, body: "línea inventada" },
    { path: "src/no-existe.ts", line: 1, side: "RIGHT", severity: "low", confidence: 1, body: "archivo inventado" },
  ], pos);
  assert.equal(valid.length, 1);
  assert.equal(rejected.length, 2);
  assert.match(rejected[0].reason, /línea 999 no es parte del diff/);
  assert.match(rejected[1].reason, /archivo no aparece en el diff/);
});

// Ojo al elegir la línea: el contexto existe de los DOS lados, así que no sirve para
// probar esto. El hunk agrega 2 líneas, y por eso el derecho llega hasta la 15 y el
// izquierdo solo hasta la 14 — la 15 es la única exclusiva del derecho.
test("validateFindings distingue el lado: una línea de RIGHT no vale en LEFT", () => {
  const pos = diffPositions(DIFF);
  const p = pos.get("src/checkout.ts");
  assert.ok(p.right.has(15) && !p.left.has(15), "premisa: la 15 solo existe a la derecha");
  const { valid, rejected } = validateFindings(
    [{ path: "src/checkout.ts", line: 15, side: "LEFT", severity: "low", confidence: 1, body: "x" }], pos);
  assert.equal(valid.length, 0);
  assert.match(rejected[0].reason, /lado LEFT/);
});

// ── parseFindings ────────────────────────────────────────────────────────────

test("parseFindings acepta un review mínimo y aplica los defaults", () => {
  const r = parseFindings(JSON.stringify({
    findings: [{ path: "a.ts", line: 3, severity: "medium", body: "  algo  " }],
  }));
  assert.equal(r.findings[0].side, "RIGHT", "side default");
  assert.equal(r.findings[0].confidence, 1, "confidence default");
  assert.equal(r.findings[0].body, "algo", "trimea");
  assert.deepEqual(r.good, []);
});

test("parseFindings acepta findings vacío (un review sin hallazgos es válido)", () => {
  assert.deepEqual(parseFindings('{"findings":[]}').findings, []);
});

// Los errores tienen que decir DÓNDE: quien escribe el archivo es un LLM, y
// "Unexpected token" no le sirve para arreglarlo.
test("parseFindings señala el hallazgo y el campo exacto que falla", () => {
  const bad = (o) => () => parseFindings(JSON.stringify(o));
  assert.throws(bad({ findings: [{ line: 1, severity: "low", body: "x" }] }), /findings\[0\].*falta 'path'/);
  assert.throws(bad({ findings: [{ path: "a.ts", line: 0, severity: "low", body: "x" }] }), /a\.ts.*'line'.*entero ≥ 1/);
  assert.throws(bad({ findings: [{ path: "a.ts", line: 1.5, severity: "low", body: "x" }] }), /'line'.*entero/);
  assert.throws(bad({ findings: [{ path: "a.ts", line: 1, severity: "critical", body: "x" }] }), /a\.ts:1.*'severity'.*low \| medium \| high/);
  assert.throws(bad({ findings: [{ path: "a.ts", line: 1, severity: "low" }] }), /a\.ts:1.*falta 'body'/);
  assert.throws(bad({ findings: [{ path: "a.ts", line: 1, severity: "low", body: "x", confidence: 2 }] }), /'confidence'.*entre 0 y 1/);
  assert.throws(bad({ findings: [{ path: "a.ts", line: 1, severity: "low", body: "x", side: "ARRIBA" }] }), /'side'.*RIGHT o LEFT/);
});

test("parseFindings rechaza JSON roto y raíces que no son objeto", () => {
  assert.throws(() => parseFindings("{no json"), /no es JSON válido/);
  assert.throws(() => parseFindings("[]"), /raíz tiene que ser un objeto/);
  assert.throws(() => parseFindings("{}"), /falta el array 'findings'/);
});

// ── filterFindings ───────────────────────────────────────────────────────────

const F = (severity, confidence, line) => ({ path: "a.ts", line, side: "RIGHT", severity, confidence, body: `b${line}` });

test("filterFindings corta por severidad mínima", () => {
  const { kept, suppressed } = filterFindings([F("low", 1, 1), F("high", 1, 2)], { minSeverity: "medium" });
  assert.deepEqual(kept.map((f) => f.line), [2]);
  assert.match(suppressed[0].reason, /severidad low < medium/);
});

test("filterFindings corta por confianza mínima", () => {
  const { kept, suppressed } = filterFindings([F("high", 0.3, 1), F("high", 0.9, 2)], { minConfidence: 0.5 });
  assert.deepEqual(kept.map((f) => f.line), [2]);
  assert.match(suppressed[0].reason, /confianza 0\.3 < 0\.5/);
});

test("filterFindings con tope conserva lo MÁS grave, no lo primero", () => {
  const { kept, suppressed } = filterFindings([F("low", 1, 1), F("high", 1, 2), F("medium", 1, 3)], { maxComments: 2 });
  assert.deepEqual(kept.map((f) => f.severity), ["high", "medium"]);
  assert.match(suppressed[0].reason, /tope de --max-comments/);
});

test("filterFindings desempata por confianza dentro de la misma severidad", () => {
  const { kept } = filterFindings([F("high", 0.5, 1), F("high", 0.99, 2)], { maxComments: 1 });
  assert.deepEqual(kept.map((f) => f.line), [2]);
});

test("filterFindings sin opciones no filtra nada", () => {
  assert.equal(filterFindings([F("low", 0, 1)]).kept.length, 1);
});

test("filterFindings valida --min-severity", () => {
  assert.throws(() => filterFindings([], { minSeverity: "urgente" }), /valores low \| medium \| high/);
});

// ── Render ───────────────────────────────────────────────────────────────────

// El comentario se postea con el token del humano: el forge lo atribuye a él SIN badge
// de bot. Sin marca, el compañero no puede saber que lo escribió una máquina.
test("renderFindingBody marca severidad y deja claro que lo escribió dai", () => {
  const b = renderFindingBody(F("medium", 1, 1));
  assert.match(b, /🟡 \*\*Medium\*\*/);
  assert.match(b, /dai-review/);
  assert.match(b, /firmada por un humano/);
});

test("renderReviewSummary cuenta los inline por severidad", () => {
  const s = renderReviewSummary({ us: "ACME-482", version: "v1", checkStatus: "✅ al día", dod: "4/5", summary: "Buen PR.", good: ["tests claros"] },
    { kept: [F("high", 1, 1), F("high", 1, 2), F("low", 1, 3)] });
  assert.match(s, /## 🤖 dai-review/);
  assert.match(s, /\*\*US:\*\* `ACME-482` @ v1 · `dai check`: ✅ al día/);
  assert.match(s, /\*\*Definition of Done:\*\* 4\/5/);
  assert.match(s, /Dejé \*\*3\*\* comentarios en línea: 2 🔴 High · 1 🔵 Low/);
  assert.match(s, /- tests claros/);
  assert.match(s, /La aprobación la firma un humano/);
});

test("renderReviewSummary sin US lo dice en vez de inventar", () => {
  assert.match(renderReviewSummary({ good: [] }, {}), /no declara implementar una US/);
});

test("renderReviewSummary singulariza 1 comentario", () => {
  assert.match(renderReviewSummary({ good: [] }, { kept: [F("low", 1, 1)] }), /Dejé \*\*1\*\* comentario en línea/);
});

test("renderReviewSummary sin hallazgos no finge que dejó comentarios", () => {
  assert.match(renderReviewSummary({ good: [] }, { kept: [] }), /Sin comentarios en línea/);
});

// Nada se cae en silencio: lo filtrado y lo descartado se listan.
test("renderReviewSummary lista lo suprimido y lo descartado en <details>", () => {
  const s = renderReviewSummary({ good: [] }, {
    kept: [],
    suppressed: [{ finding: F("low", 0.2, 7), reason: "confianza 0.2 < 0.5" }],
    rejected: [{ finding: F("high", 1, 99), reason: "la línea 99 no es parte del diff (lado RIGHT)" }],
  });
  assert.match(s, /<summary>Suprimidos por el filtro \(1\)<\/summary>/);
  assert.match(s, /confianza 0\.2 < 0\.5/);
  assert.match(s, /<summary>Descartados: no apuntan al diff \(1\)<\/summary>/);
  assert.match(s, /`a\.ts:99`/);
});

test("renderReviewSummary omite los <details> cuando no hay nada que listar", () => {
  const s = renderReviewSummary({ good: [] }, { kept: [F("low", 1, 1)] });
  assert.doesNotMatch(s, /<details>/);
});

test("SEVERITIES va de menor a mayor", () => {
  assert.deepEqual(SEVERITIES, ["low", "medium", "high"]);
});
