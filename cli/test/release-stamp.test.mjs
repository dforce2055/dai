import test from "node:test";
import assert from "node:assert/strict";
import {
  releaseMarker, alreadyStamped, renderReleaseStamp,
  stampPlan, renderStampPlan, stampWarning, SIN_ESTAMPAR,
} from "../lib/release-stamp.mjs";

const EV = { app: "acme-backend", version: "0.5.0", environment: "prod" };
const US = [
  { id: "ACME-482", title: "Checkout sin duplicado" },
  { id: "ACME-491", title: "Alta de póliza" },
  { id: "ACME-503", title: "Recordar medio de pago" },
];

// ── la marca ─────────────────────────────────────────────────────────────────
// Sin marca no hay forma de saber si ya estampamos: redesplegar la misma versión llenaría
// el ticket de comentarios idénticos, y un ticket con cuarenta avisos no lo lee nadie.
test("la marca identifica (app, versión, ambiente) y normaliza la v", () => {
  assert.equal(releaseMarker(EV), "[dai:release app=acme-backend version=0.5.0 env=prod]");
  assert.equal(releaseMarker({ ...EV, version: "v0.5.0" }), releaseMarker(EV));
  assert.equal(releaseMarker({ ...EV, environment: "PROD" }), releaseMarker(EV));
});

test("la misma versión en otro ambiente, o de otra app, es otra marca", () => {
  assert.notEqual(releaseMarker({ ...EV, environment: "pre" }), releaseMarker(EV));
  assert.notEqual(releaseMarker({ ...EV, app: "acme-frontend" }), releaseMarker(EV));
  assert.notEqual(releaseMarker({ ...EV, version: "0.5.1" }), releaseMarker(EV));
});

test("alreadyStamped encuentra la marca dentro del cuerpo del comentario", () => {
  const cuerpo = renderReleaseStamp({ ...EV, date: "09/09/2026 09:25" });
  assert.equal(alreadyStamped([cuerpo], releaseMarker(EV)), true);
  assert.equal(alreadyStamped([cuerpo], releaseMarker({ ...EV, environment: "pre" })), false);
  assert.equal(alreadyStamped([], releaseMarker(EV)), false);
});

test("el comentario dice qué salió, dónde y cuándo, y lleva su marca al final", () => {
  const c = renderReleaseStamp({ ...EV, date: "09/09/2026 09:25", commit: "e8a57d92abc", url: "https://x/r/v0.5.0" });
  assert.match(c, /\*\*acme-backend v0\.5\.0\*\* desplegada en \*\*PROD\*\* — 09\/09\/2026 09:25/);
  assert.match(c, /- commit: `e8a57d92`/);        // corto: el sha largo no lo lee nadie
  assert.match(c, /- release: https:\/\/x\/r\/v0\.5\.0/);
  assert.ok(c.trim().endsWith(releaseMarker(EV)));
});

// ── el alcance ───────────────────────────────────────────────────────────────
// Mostrar "12 US" cuando se van a escribir 9 comentarios es la clase de aviso que la
// gente aprende a ignorar. El número tiene que ser el real.
test("el plan separa lo pendiente de lo ya estampado", () => {
  const plan = stampPlan({ stories: US, stamped: new Set(["ACME-491"]) });
  assert.deepEqual(plan.pendientes.map((s) => s.id), ["ACME-482", "ACME-503"]);
  assert.deepEqual(plan.repetidas.map((s) => s.id), ["ACME-491"]);
  assert.equal(plan.total, 3);
});

test("el aviso dice el número REAL de escrituras y que no se deshace", () => {
  const plan = stampPlan({ stories: US, stamped: new Set(["ACME-491"]) });
  const w = stampWarning(plan);
  assert.match(w, /escribe 2 comentario\(s\)/);
  assert.match(w, /1 ya estampada/);
  assert.match(w, /No se deshace/);
});

test("sin nada pendiente el aviso no asusta: dice que no hay nada que hacer", () => {
  const plan = stampPlan({ stories: US, stamped: new Set(US.map((s) => s.id)) });
  assert.match(stampWarning(plan), /no hay nada para estampar/);
  assert.equal(plan.pendientes.length, 0);
});

test("el render marca cuáles se saltean, para que el número cierre a la vista", () => {
  const plan = stampPlan({ stories: US, stamped: new Set(["ACME-491"]) });
  const out = renderStampPlan(plan, { app: "acme-backend", version: "0.5.0", environment: "prod", tracker: "jira" });
  assert.match(out, /ACME-491.*ya estampada, se saltea/);
  assert.doesNotMatch(out, /ACME-482.*se saltea/);
  assert.match(out, /ambiente: PROD/);
  assert.match(out, /jira · 3 User Storie/);
});

// dai no puede AFIRMAR que no estampó si no pudo leer los comentarios. Afirmar de más
// acá se paga en duplicados que nadie puede borrar.
test("si no se pudieron leer los comentarios, se dice en vez de suponer", () => {
  const plan = stampPlan({ stories: US, stamped: new Set(), unknown: true });
  const out = renderStampPlan(plan, { app: "a", version: "1.0.0", environment: "prod" });
  assert.match(out, /No pude leer los comentarios/);
  assert.match(out, /van a salir repetidos/);
});

test("sin US en el manifiesto lo dice, en vez de mostrar una lista vacía", () => {
  const out = renderStampPlan(stampPlan({ stories: [] }), { app: "a", version: "1.0.0", environment: "prod" });
  assert.match(out, /el manifiesto de esta versión no declara US/);
});

// Estampar es OPCIONAL: decir que no no rompe nada, y se dice una vez qué se pierde.
test("el aviso de lo que se pierde se dice una vez, sin insistir", () => {
  assert.match(SIN_ESTAMPAR, /el registro queda solo en el release note/);
  assert.doesNotMatch(SIN_ESTAMPAR, /deberías|tenés que|error/i);
});
