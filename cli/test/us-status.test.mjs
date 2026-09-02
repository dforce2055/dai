// dai · "no hay US" y "no pude preguntar" no son lo mismo.
//
// Los adaptadores ya lo distinguían (404 → null, cualquier otro error → throw), pero el
// estado de cobertura no tenía cómo expresarlo, así que cada caller lo colapsaba: `dai pr`
// publicaba "❓ sin US" en el cuerpo de la PR cuando el tracker no había contestado.

import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageStatus, statusLabel, explainFetchError } from "../lib/us.mjs";
import { fetchLiveUS } from "../lib/pm-adapter.mjs";

test("sin respuesta del tracker el estado es 'sin-respuesta', no 'sin-us'", () => {
  assert.equal(coverageStatus("abc", null, { unreachable: true }), "sin-respuesta");
  assert.equal(coverageStatus("abc", null), "sin-us");                 // el tracker contestó: no está
  assert.equal(coverageStatus("abc", "abc"), "al-dia");
  assert.equal(coverageStatus("abc", "xyz"), "atrasado");
});

test("un hash vivo no puede tapar la falta de respuesta", () => {
  // Defensivo: si algún caller pasa las dos cosas, gana no saber.
  assert.equal(coverageStatus("abc", "abc", { unreachable: true }), "sin-respuesta");
});

test("statusLabel nombra el estado nuevo", () => {
  assert.equal(statusLabel("sin-respuesta"), "⚠️ no verificado");
  assert.equal(statusLabel("sin-us"), "❓ sin US");
});

test("fetchLiveUS distingue la US que no está de la consulta que no se pudo hacer", async () => {
  const noExiste = { kind: "jira", endpoint: "https://x", fetchUS: () => null };
  const caido = { kind: "jira", endpoint: "https://x", fetchUS: () => { throw new Error("fetch failed"); } };
  const ok = { kind: "md", fetchUS: () => ({ id: "ACME-1", ac_hash: "abc" }) };

  const a = await fetchLiveUS(noExiste, "ACME-1");
  assert.equal(a.us, null); assert.equal(a.unreachable, false);

  const b = await fetchLiveUS(caido, "ACME-1");
  assert.equal(b.us, null); assert.equal(b.unreachable, true);
  assert.match(b.reason, /no pude consultar la US ACME-1 en jira/);

  const c = await fetchLiveUS(ok, "ACME-1");
  assert.equal(c.us.ac_hash, "abc"); assert.equal(c.unreachable, false);
});

test("sin id no se consulta nada (branch exenta)", async () => {
  const adapter = { kind: "jira", fetchUS: () => { throw new Error("no debería llamarse"); } };
  const r = await fetchLiveUS(adapter, null);
  assert.deepEqual(r, { us: null, unreachable: false, reason: null });
});

test("explainFetchError dice qué se consultaba, contra qué y qué mirar", () => {
  const red = explainFetchError(new Error("fetch failed"), { kind: "jira", endpoint: "https://acme.atlassian.net", id: "ACME-1" });
  assert.match(red, /no pude consultar la US ACME-1 en jira · https:\/\/acme\.atlassian\.net/);
  assert.match(red, /NODE_EXTRA_CA_CERTS/);
  assert.match(red, /dai doctor/);

  const auth = explainFetchError(new Error("jira 401: token expired"), { kind: "jira", id: "ACME-1" });
  assert.match(auth, /rechazó las credenciales/);

  const server = explainFetchError(new Error("clickup 503: unavailable"), { kind: "clickup", id: "ACME-1" });
  assert.match(server, /es del tracker, no tuyo/);

  // Nunca se queda mudo, aunque el error no traiga mensaje.
  assert.match(explainFetchError(null, {}), /no pude consultar el tracker/);
});
