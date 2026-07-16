import { test } from "node:test";
import assert from "node:assert/strict";
import { daiFetch, tlsErrorCode, tlsHint } from "../lib/http.mjs";
import { withMockFetch, mockResponse } from "./helpers.mjs";

test("tlsErrorCode encuentra el código aunque undici lo anide en cause", () => {
  const inner = Object.assign(new Error("self signed"), { code: "SELF_SIGNED_CERT_IN_CHAIN" });
  const outer = Object.assign(new TypeError("fetch failed"), { cause: inner });
  assert.equal(tlsErrorCode(outer), "SELF_SIGNED_CERT_IN_CHAIN");
  assert.equal(tlsErrorCode(inner), "SELF_SIGNED_CERT_IN_CHAIN");
});

test("tlsErrorCode ignora lo que no es TLS", () => {
  assert.equal(tlsErrorCode(Object.assign(new Error("x"), { code: "ECONNREFUSED" })), null);
  assert.equal(tlsErrorCode(new Error("plano")), null);
  assert.equal(tlsErrorCode(undefined), null);
});

test("tlsErrorCode no cicla con un cause circular", () => {
  const a = Object.assign(new Error("a"), { code: "ENOTFOUND" });
  a.cause = a;
  assert.equal(tlsErrorCode(a), null);
});

test("tlsHint manda a NODE_EXTRA_CA_CERTS y desaconseja el atajo peligroso", () => {
  const h = tlsHint("jira.acme.com", "SELF_SIGNED_CERT_IN_CHAIN");
  assert.match(h, /jira\.acme\.com/);
  assert.match(h, /NODE_EXTRA_CA_CERTS/);
  assert.match(h, /--use-system-ca/);
  assert.match(h, /proxy corporativo/);
  assert.match(h, /NO uses NODE_TLS_REJECT_UNAUTHORIZED=0/);
});

test("[red] daiFetch traduce el fallo de TLS a un error accionable", async () => {
  const inner = Object.assign(new Error("self signed certificate in certificate chain"), { code: "SELF_SIGNED_CERT_IN_CHAIN" });
  await withMockFetch(
    () => { throw Object.assign(new TypeError("fetch failed"), { cause: inner }); },
    async () => {
      await assert.rejects(daiFetch("https://jira.acme.com/rest/api/3/issue"), (e) => {
        assert.match(e.message, /no pude verificar el certificado TLS de jira\.acme\.com/);
        assert.match(e.message, /NODE_EXTRA_CA_CERTS/);
        assert.equal(e.cause.cause, inner);   // el error original queda para depurar
        return true;
      });
    },
  );
});

test("[red] daiFetch deja pasar los errores que no son de TLS, sin disfrazarlos", async () => {
  await withMockFetch(
    () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }); },
    async () => { await assert.rejects(daiFetch("https://nope.invalid"), /ENOTFOUND/); },
  );
});

test("[red] daiFetch no toca la respuesta cuando todo anda", async () => {
  await withMockFetch(() => mockResponse(200, { key: "X-1" }), async (calls) => {
    const res = await daiFetch("https://j.acme.com/x", { method: "POST" });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { key: "X-1" });
    assert.equal(calls[0].opts.method, "POST");
  });
});
