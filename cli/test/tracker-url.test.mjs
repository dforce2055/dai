import { test } from "node:test";
import assert from "node:assert/strict";
import { trackerUrl, deriveTrackerUrl } from "../lib/tracker-url.mjs";

// El bug que motivó este módulo: sin DAI_TRACKER_URL_TEMPLATE, dai devolvía el `id`
// pelado. Como un string es truthy, quien consumía el valor lo escribía como si fuera
// un enlace — un id disfrazado de link, sin un solo aviso. Pasó en PRs reales.

test("sin template ni backend conocido devuelve null, NUNCA el id pelado", () => {
  assert.equal(trackerUrl("ACME-1", { env: {} }), null);
  assert.equal(trackerUrl("ACME-1", { env: { DAI_PM: "md" } }), null);
});

test("DAI_TRACKER_URL_TEMPLATE gana sobre todo lo demás", () => {
  const env = { DAI_PM: "clickup", DAI_TRACKER_URL_TEMPLATE: "https://tracker.acme.test/t/{id}" };
  assert.equal(
    trackerUrl("abc123", { env, liveUrl: "https://app.clickup.com/t/999/abc123" }),
    "https://tracker.acme.test/t/abc123",
  );
});

test("el template reemplaza todas las apariciones de {id}", () => {
  const env = { DAI_TRACKER_URL_TEMPLATE: "https://acme.test/{id}/detalle/{id}" };
  assert.equal(trackerUrl("ACME-7", { env }), "https://acme.test/ACME-7/detalle/ACME-7");
});

test("sin template, la canónica del tracker gana sobre la derivada", () => {
  // ClickUp sabe el team_id; deducirlo desde el id es imposible. Por eso `url` de
  // fetchUS le gana a lo que podemos derivar solos.
  const env = { DAI_PM: "clickup" };
  assert.equal(
    trackerUrl("abc123", { env, liveUrl: "https://app.clickup.com/t/90130000000/abc123" }),
    "https://app.clickup.com/t/90130000000/abc123",
  );
});

test("sin template ni canónica, deriva del backend (offline, sin red)", () => {
  assert.equal(trackerUrl("abc123", { env: { DAI_PM: "clickup" } }), "https://app.clickup.com/t/abc123");
  assert.equal(
    trackerUrl("ACME-42", { env: { DAI_PM: "jira", DAI_JIRA_BASE_URL: "https://acme.atlassian.net" } }),
    "https://acme.atlassian.net/browse/ACME-42",
  );
});

test("jira sin DAI_JIRA_BASE_URL no puede derivar: null", () => {
  assert.equal(trackerUrl("ACME-42", { env: { DAI_PM: "jira" } }), null);
});

test("jira tolera la barra final en la base", () => {
  const env = { DAI_PM: "jira", DAI_JIRA_BASE_URL: "https://acme.atlassian.net///" };
  assert.equal(trackerUrl("ACME-42", { env }), "https://acme.atlassian.net/browse/ACME-42");
});

test("sin id no hay URL", () => {
  assert.equal(trackerUrl(null, { env: { DAI_PM: "clickup" } }), null);
  assert.equal(trackerUrl("", { env: { DAI_TRACKER_URL_TEMPLATE: "https://acme.test/{id}" } }), null);
});

test("deriveTrackerUrl escapa el id", () => {
  assert.equal(deriveTrackerUrl("a b/c", { DAI_PM: "clickup" }), "https://app.clickup.com/t/a%20b%2Fc");
});

test("deriveTrackerUrl ignora DAI_TRACKER_URL_TEMPLATE (es solo la derivación)", () => {
  const env = { DAI_PM: "clickup", DAI_TRACKER_URL_TEMPLATE: "https://acme.test/{id}" };
  assert.equal(deriveTrackerUrl("abc123", env), "https://app.clickup.com/t/abc123");
});

test("DAI_PM es case-insensitive", () => {
  assert.equal(trackerUrl("abc123", { env: { DAI_PM: "ClickUp" } }), "https://app.clickup.com/t/abc123");
});

test("trackerUrl anda sin opciones (defaults sanos, no explota)", () => {
  assert.equal(trackerUrl("ACME-1"), null);
});
