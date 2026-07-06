import { test } from "node:test";
import assert from "node:assert/strict";
import { jiraIssueUrl, jiraCommentUrl, jiraAuthHeaders, jiraIssueToText, jiraAdapter } from "../lib/pm-jira.mjs";
import { parseUS } from "../lib/us.mjs";
import { withMockFetch, mockResponse } from "./helpers.mjs";

const ENV = { DAI_JIRA_BASE_URL: "https://j.acme.com", DAI_JIRA_EMAIL: "a@b.com", DAI_JIRA_TOKEN: "tok" };

test("[red] jira fetchUS pega a la URL correcta, con auth, y mapea la US", async () => {
  await withMockFetch(
    () => mockResponse(200, { key: "ABC-482", fields: {
      summary: "Finalizar la compra",
      description: "spec_version v2\n\n## Criterios de aceptación\n- Dado un carrito vacío\n- Cuando se finaliza\n- Entonces se rechaza",
    } }),
    async (calls) => {
      const us = await jiraAdapter(ENV).fetchUS("ABC-482");
      assert.match(calls[0].url, /\/rest\/api\/2\/issue\/ABC-482/);
      assert.match(calls[0].opts.headers.Authorization, /^Basic /);
      assert.equal(us.title, "Finalizar la compra");
      assert.equal(us.spec_version, "v2");
    }
  );
});

test("[red] jira fetchUS 404 → null", async () => {
  await withMockFetch(() => mockResponse(404, ""), async () => {
    assert.equal(await jiraAdapter(ENV).fetchUS("NOPE-1"), null);
  });
});

test("[red] jira fetchUS error != 404 → throw", async () => {
  await withMockFetch(() => mockResponse(500, "boom"), async () => {
    await assert.rejects(jiraAdapter(ENV).fetchUS("ABC-1"), /jira 500/);
  });
});

test("[red] jira stamp postea el comentario con la cobertura", async () => {
  await withMockFetch(() => mockResponse(201, {}), async (calls) => {
    const url = await jiraAdapter(ENV).stamp("ABC-482",
      { repo: "frontend", change: "c", version: "v1", ac_hash: "x", status: "al-dia" });
    assert.equal(calls[0].opts.method, "POST");
    assert.match(calls[0].url, /\/issue\/ABC-482\/comment/);
    assert.match(JSON.parse(calls[0].opts.body).body, /Cobertura de ABC-482/);
    assert.match(url, /\/browse\/ABC-482/);
  });
});

test("jiraIssueUrl y jiraCommentUrl (trim de la base)", () => {
  assert.equal(jiraIssueUrl("https://j.acme.com/", "ABC-482"),
    "https://j.acme.com/rest/api/2/issue/ABC-482?fields=summary,description");
  assert.equal(jiraCommentUrl("https://j.acme.com", "ABC-482"),
    "https://j.acme.com/rest/api/2/issue/ABC-482/comment");
});

test("jiraAuthHeaders arma Basic email:token en base64", () => {
  const h = jiraAuthHeaders({ DAI_JIRA_EMAIL: "a@b.com", DAI_JIRA_TOKEN: "tok" });
  const expected = "Basic " + Buffer.from("a@b.com:tok").toString("base64");
  assert.equal(h.Authorization, expected);
});

test("jiraIssueToText + parseUS extraen la US de la respuesta", () => {
  const json = {
    key: "ABC-482",
    fields: {
      summary: "Finalizar la compra del carrito",
      description: "spec_version v3\n\n## Criterios de aceptación\n- Dado un carrito vacío\n- Cuando se finaliza\n- Entonces se rechaza",
    },
  };
  const us = parseUS(jiraIssueToText(json));
  assert.equal(us.title, "Finalizar la compra del carrito");
  assert.equal(us.spec_version, "v3");
  assert.match(us.ac_hash, /^[0-9a-f]{8}$/);
});
